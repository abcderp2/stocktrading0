'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function assert(condition, message) { if (!condition) throw new Error(message); }
function expectThrow(fn, message) { let threw = false; try { fn(); } catch (_error) { threw = true; } assert(threw, message); }
global.window = global; if (!global.crypto) global.crypto = webcrypto;
const memoryStore = new Map();
global.localStorage = { getItem(key) { return memoryStore.has(key) ? memoryStore.get(key) : null; }, setItem(key, value) { memoryStore.set(key, String(value)); }, removeItem(key) { memoryStore.delete(key); } };
for (const file of ['assets/js/market-engine.js', 'assets/js/storage.js']) vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
const engine = global.StockSandbox.Engine; const storage = global.StockSandbox.Storage;
assert(engine && storage, 'engine and storage must load');
assert(engine.SCHEMA_VERSION === 4, 'schema version must be 4');
assert(engine.START_PRICE === 1000, 'initial price constant must be 1000');
assert(engine.HISTORY_YEARS === 20, 'initial history must target 20 years');
assert(engine.MAX_CANDLES >= 7300, 'daily cap must cover about 20 years even in everyday mode');

const state = engine.createDefaultState(123456789, '2026-08-10');
const company = engine.currentCompany(state);
assert(company && company.name === 'テスト企業', 'default company should be テスト企業');
assert(company.price === 1000, 'current price should start at exactly 1000 yen');
assert(company.candles.length > 5000 && company.candles.length < 6000, 'weekday 20-year history should be roughly 5000 daily candles');
assert(company.candles[0].date.startsWith('2006-'), 'history should reach roughly 20 years back');
assert(company.candles[company.candles.length - 1].date === '2026-08-10', 'history should end at supplied current date');
assert(company.candles.every((candle) => Number.isFinite(candle.volume) && candle.volume >= 1000), 'all daily candles need bounded fictional volume');
assert(company.candles.every((candle, index, items) => index === 0 || candle.date > items[index - 1].date), 'daily dates must be strictly increasing');

assert(engine.nextMarketDate('2026-08-14', 'weekdays') === '2026-08-17', 'weekday calendar should skip weekends');
assert(engine.nextMarketDate('2026-12-30', 'weekdays') === '2027-01-04', 'weekday calendar should skip simplified year-end/New Year closure');
assert(engine.nextMarketDate('2026-08-14', 'everyday') === '2026-08-15', '365-day market should include weekends');

const daily = engine.aggregateCandles(company.candles, '1d');
const weekly = engine.aggregateCandles(company.candles, '1w');
const monthly = engine.aggregateCandles(company.candles, '1m');
assert(daily.length === company.candles.length, 'daily aggregation should preserve daily count');
assert(weekly.length > 900 && weekly.length < daily.length, 'weekly aggregation should cover long history with fewer bars');
assert(monthly.length >= 230 && monthly.length <= 242, 'monthly aggregation should be about 20 years');
assert(weekly.every((candle) => Number.isFinite(candle.volume) && candle.volume >= 0), 'weekly volume must aggregate');
assert(monthly.every((candle) => Number.isFinite(candle.volume) && candle.volume >= 0), 'monthly volume must aggregate');

const fiveYears = engine.filterCandlesByRange(daily, '5y', state.currentDate);
const twentyYears = engine.filterCandlesByRange(daily, '20y', state.currentDate);
assert(fiveYears.length > 1200 && fiveYears.length < 1400, '5-year range should be roughly 5 trading years');
assert(twentyYears.length === daily.length, '20-year range should include initial history');
const stats = engine.marketStats(company, state.currentDate);
assert(stats.high52 >= stats.low52 && stats.highAll >= stats.lowAll, 'market stats should have valid high/low ordering');
assert(stats.volume === company.candles[company.candles.length - 1].volume, 'current volume statistic should use latest candle');

const beforeDay = state.day; const beforeDate = state.currentDate;
engine.stepMarket(state, 1);
assert(state.day === beforeDay + 1, 'market step should advance sequence');
assert(state.currentDate > beforeDate, 'market step should advance market date');
assert(company.candles[company.candles.length - 1].date === state.currentDate, 'new candle should use current market date');

const beforeCash = state.cash;
let result = engine.executeTrade(state, 'buy', 1);
assert(result.ok, 'basic buy should succeed');
assert(state.cash < beforeCash, 'buy should reduce cash');
assert(result.trade.date === state.currentDate, 'trade should store exact market date');
result = engine.executeTrade(state, 'sell', 1);
assert(result.ok, 'closing sale should succeed');

const priceBeforeEvent = company.price; const volumeBeforeEvent = company.candles[company.candles.length - 1].volume;
engine.applyFictionEvent(state, 80);
assert(company.price > priceBeforeEvent, 'positive fictional event should move price up');
assert(company.candles[company.candles.length - 1].volume >= volumeBeforeEvent, 'fictional event should raise or preserve volume');

const saveResult = storage.saveState(state);
assert(saveResult.ok, '20-year valid state should save locally');
assert(saveResult.savedCandleLimit >= 5000, 'normal 20-year weekday history should keep full long history locally');
const raw = memoryStore.get(storage.STORAGE_KEY);
assert(typeof raw === 'string' && Buffer.byteLength(raw, 'utf8') <= storage.MAX_LOCAL_SAVE_BYTES, 'local save must stay within byte budget');
const loaded = storage.loadState();
assert(loaded.ok, 'saved v4 state should reload');
assert(loaded.state.schemaVersion === 4, 'reloaded state should stay v4');
assert(loaded.state.companies[0].candles.length >= 5000, 'reloaded state should keep about 20 years');
assert(loaded.state.companies[0].candles.every((candle) => Number.isFinite(candle.volume)), 'reloaded candles should keep volume');

const canonical = storage.validateState(loaded.state);
const brokenDate = JSON.parse(JSON.stringify(canonical));
brokenDate.companies[0].candles[1].date = brokenDate.companies[0].candles[0].date;
expectThrow(() => storage.validateState(brokenDate), 'non-increasing dates must be rejected');

const v3 = JSON.parse(JSON.stringify(canonical));
v3.schemaVersion = 3;
v3.companies[0].candles = v3.companies[0].candles.slice(-120).map((candle) => [candle.day, candle.date, candle.open, candle.high, candle.low, candle.close]);
delete v3.companies[0].price;
const migrated = storage.parseAnyState(JSON.stringify(v3));
assert(migrated.schemaVersion === 4, 'v3 data should migrate to v4');
assert(migrated.companies[0].candles.length > 5000, 'v3 migration should fill missing long history');
assert(migrated.companies[0].candles.every((candle) => Number.isFinite(candle.volume)), 'v3 migration should add fictional volume');
assert(migrated.currentDate === canonical.currentDate, 'migration should preserve current date');

const controlled = engine.normalizeCompanyInput({ name: '安全\u202e表示\n会社', ticker: 'SAFE', price: 1000 });
assert(!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(controlled.name), 'invisible control characters must be removed');
console.log('OK: 20-year market, aggregation, trading, storage and migration smoke tests passed');
