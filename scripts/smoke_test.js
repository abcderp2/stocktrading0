'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function assert(condition, message) { if (!condition) throw new Error(message); }
function expectThrow(fn, message) { let threw = false; try { fn(); } catch (_error) { threw = true; } assert(threw, message); }

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

const state = engine.createDefaultState(123456789, '2026-08-10');
const company = engine.currentCompany(state);
assert(state.schemaVersion === 3, 'schema v3 is required');
assert(state.currentDate === '2026-08-10', 'fixed anchor date should be preserved');
assert(state.day === 60 && company.candles.length === 60, 'initial chart should contain 60 market sessions');
assert(company.price === 1000 && company.candles.at(-1).close === 1000, 'initial current price must be exactly 1000 yen');
assert(company.name === 'テスト企業', 'initial name must be テスト企業');
assert(company.candles.every((candle) => engine.parseIsoDate(candle.date)), 'every candle needs a valid ISO date');
assert(company.candles.every((candle) => { const d = engine.parseIsoDate(candle.date); return d.getDay() !== 0 && d.getDay() !== 6; }), 'weekday calendar must exclude weekends');

state.currentDate = '2026-08-14';
company.candles.at(-1).date = '2026-08-14';
engine.stepMarket(state, 1);
assert(state.currentDate === '2026-08-17', 'weekday calendar must skip weekend');
state.calendarMode = 'everyday';
state.currentDate = '2026-08-14';
company.candles.at(-1).date = '2026-08-14';
engine.stepMarket(state, 1);
assert(state.currentDate === '2026-08-15', '365-day calendar must include Saturday');

engine.setCurrentPrice(state, 1234.56);
assert(engine.currentCompany(state).price === 1234.56, 'direct price editing must work');
const daily = engine.aggregateCandles(company.candles, '1d');
const weekly = engine.aggregateCandles(company.candles, '1w');
const monthly = engine.aggregateCandles(company.candles, '1m');
assert(daily.length === company.candles.length, 'daily bars must preserve source count');
assert(weekly.length > 0 && weekly.length < daily.length, 'weekly bars must aggregate daily candles');
assert(monthly.length > 0 && monthly.length <= weekly.length, 'monthly bars must aggregate further');
assert(weekly.every((bar) => bar.startDate <= bar.endDate && bar.high >= Math.max(bar.open, bar.close) && bar.low <= Math.min(bar.open, bar.close)), 'weekly OHLC must be valid');
assert(engine.candlesForView(company.candles, '1d', '1m', state.currentDate).length <= daily.length, 'range filter must not expand data');

const beforeCash = state.cash;
let result = engine.executeTrade(state, 'buy', 1);
assert(result.ok && state.cash < beforeCash, 'basic buy should work');
assert(result.trade.date === state.currentDate, 'trade should keep exact market date');
result = engine.executeTrade(state, 'sell', 1);
assert(result.ok && state.positions[engine.COMPANY_ID].quantity === 0, 'round trip should close position');

for (let index = 0; index < 7; index += 1) engine.stepMarket(state, 200);
assert(company.candles.length <= engine.MAX_CANDLES, 'candle cap must be enforced');
const saveResult = storage.saveState(state);
assert(saveResult.ok, 'valid v3 state should save');
const raw = memoryStore.get(storage.STORAGE_KEY);
assert(typeof raw === 'string' && new Blob([raw]).size <= storage.MAX_LOCAL_SAVE_BYTES, 'local save must respect byte budget');
const loaded = storage.loadState();
assert(loaded.ok && loaded.state.schemaVersion === 3, 'saved v3 state should load');
assert(loaded.state.companies[0].candles.every((candle) => engine.parseIsoDate(candle.date)), 'loaded candles must keep dates');

const canonical = storage.validateState(loaded.state);
const duplicateDate = JSON.parse(JSON.stringify(canonical));
if (duplicateDate.companies[0].candles.length > 1) duplicateDate.companies[0].candles.at(-1).date = duplicateDate.companies[0].candles.at(-2).date;
expectThrow(() => storage.validateState(duplicateDate), 'duplicate/non-increasing dates must be rejected');
const brokenDate = JSON.parse(JSON.stringify(canonical));
brokenDate.currentDate = '2026-02-31';
expectThrow(() => storage.validateState(brokenDate), 'invalid calendar dates must be rejected');

memoryStore.delete(storage.STORAGE_KEY);
const v2 = {
  schemaVersion: 2,
  rngState: 123,
  sequence: 0,
  day: 2,
  marketMood: 0,
  marketVolatility: 100,
  cash: 1000000,
  initialCash: 1000000,
  realizedProfit: 0,
  allowNegativeCash: false,
  allowShort: false,
  tradeFeePercent: 0,
  selectedCompanyId: 'company-main',
  positions: {},
  trades: [],
  companies: [{ id: 'company-main', name: '旧テスト', ticker: 'OLD', price: 1000, marketCap: 10000, per: 15, volatility: 30, drift: 5, sensitivity: 1, logicMode: 'free', candles: [{ day: 1, open: 900, high: 1000, low: 850, close: 950 }, { day: 2, open: 950, high: 1050, low: 900, close: 1000 }] }]
};
memoryStore.set('stocktrading0.state.v2', JSON.stringify(v2));
const migrated = storage.loadState();
assert(migrated.ok && migrated.migrated === true, 'v2 local data should migrate');
assert(migrated.state.schemaVersion === 3 && migrated.state.companies[0].name === '旧テスト', 'migration should preserve selected company identity');
assert(migrated.state.companies[0].candles.every((candle) => engine.parseIsoDate(candle.date)), 'migration should attach valid dates');
assert(memoryStore.has('stocktrading0.state.v2'), 'migration must not delete legacy data');

console.log('OK: calendar, OHLC aggregation, trading, storage, and migration smoke tests passed');
