'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrow(fn, message) {
  let threw = false;
  try { fn(); } catch (_error) { threw = true; }
  assert(threw, message);
}

global.window = global;
if (!global.crypto) global.crypto = webcrypto;

const memoryStore = new Map();
global.localStorage = {
  getItem(key) { return memoryStore.has(key) ? memoryStore.get(key) : null; },
  setItem(key, value) { memoryStore.set(key, String(value)); },
  removeItem(key) { memoryStore.delete(key); }
};

for (const file of ['assets/js/market-engine.js', 'assets/js/storage.js']) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}

const engine = global.StockSandbox.Engine;
const storage = global.StockSandbox.Storage;
assert(engine && storage, 'engine and storage must load');

const state = engine.createDefaultState(123456789);
assert(state.day === 60, 'default world should start after 60 generated days');
assert(state.companies.length === 3, 'default world should have 3 companies');
assert(state.companies.every((company) => company.candles.length === 60), 'default companies should have 60 candles');

const first = state.companies[0];
const initialDay = state.day;
engine.stepMarket(state, 5);
assert(state.day === initialDay + 5, 'market stepping should advance the day');
assert(first.candles[first.candles.length - 1].day === state.day, 'latest candle should match current day');
assert(first.candles.every((candle) => [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)), 'candles must stay finite');

const beforeCash = state.cash;
let result = engine.executeTrade(state, first.id, 'buy', 1);
assert(result.ok, 'basic buy should succeed');
assert(state.cash < beforeCash, 'buy should reduce cash');
result = engine.executeTrade(state, first.id, 'sell', 1);
assert(result.ok, 'closing sale should succeed');
assert(state.positions[first.id].quantity === 0, 'round trip should close position');

result = engine.executeTrade(state, first.id, 'sell', 1);
assert(!result.ok, 'short sale should be blocked by default');
state.allowShort = true;
result = engine.executeTrade(state, first.id, 'sell', 1);
assert(result.ok && state.positions[first.id].quantity === -1, 'short sale should work when enabled');
result = engine.executeTrade(state, first.id, 'buy', 1);
assert(result.ok && state.positions[first.id].quantity === 0, 'buy should close short position');

state.positions[first.id] = { quantity: engine.MAX_POSITION, averagePrice: first.price };
result = engine.executeTrade(state, first.id, 'buy', 1);
assert(!result.ok, 'position safety limit must be enforced');
state.positions[first.id] = { quantity: 0, averagePrice: 0 };

for (let index = state.companies.length; index < engine.MAX_COMPANIES; index += 1) {
  const added = engine.addCompany(state, {
    name: '試験会社' + index,
    ticker: 'T' + index,
    price: 100 + index,
    marketCap: 1000,
    per: 15,
    volatility: 30,
    drift: 5,
    sensitivity: 1,
    logicMode: 'free'
  });
  assert(added.ok, 'company creation should work up to the limit');
}
assert(state.companies.length === engine.MAX_COMPANIES, 'company limit should be reachable');
assert(!engine.addCompany(state, { name: '上限超過', ticker: 'OVER', price: 100 }).ok, 'company limit must reject overflow');

for (let index = 0; index < 6; index += 1) engine.stepMarket(state, 200);
assert(state.companies.every((company) => company.candles.length <= engine.MAX_CANDLES), 'runtime candle cap must be enforced');

const saveResult = storage.saveState(state);
assert(saveResult.ok, 'large valid state should still save locally');
const raw = memoryStore.get(storage.STORAGE_KEY);
assert(typeof raw === 'string' && Buffer.byteLength(raw, 'utf8') <= storage.MAX_LOCAL_SAVE_BYTES, 'local snapshot must respect byte budget');
const loaded = storage.loadState();
assert(loaded.ok, 'saved state should load');
assert(loaded.state.companies.length === engine.MAX_COMPANIES, 'all companies should survive local save');
assert(loaded.state.companies.every((company) => company.candles.length <= 600), 'local snapshot should cap persisted candle history');
assert(loaded.state.companies.every((company) => company.candles[company.candles.length - 1].day === loaded.state.day), 'loaded charts must end on current day');

const canonical = storage.validateState(loaded.state);
const duplicate = JSON.parse(JSON.stringify(canonical));
duplicate.companies[1].id = duplicate.companies[0].id;
expectThrow(() => storage.validateState(duplicate), 'duplicate company ids must be rejected');

const unsafeId = JSON.parse(JSON.stringify(canonical));
unsafeId.companies[0].id = '__proto__';
expectThrow(() => storage.validateState(unsafeId), 'prototype-like ids must be rejected');

const brokenDays = JSON.parse(JSON.stringify(canonical));
const candles = brokenDays.companies[0].candles;
if (candles.length > 1) candles[candles.length - 1].day = candles[candles.length - 2].day;
expectThrow(() => storage.validateState(brokenDays), 'non-increasing candle days must be rejected');

const controlledName = engine.normalizeCompanyInput({ name: '安全\u202e表示\n会社', ticker: 'SAFE', price: 100 });
assert(!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(controlledName.name), 'invisible control characters must be removed from display names');

console.log('OK: smoke tests passed');
