(function () {
  'use strict';

  const root = window.StockSandbox = window.StockSandbox || {};
  const MAX_COMPANIES = 1;
  const MAX_CANDLES = 1200;
  const MAX_TRADES = 300;
  const MAX_TRADE_QUANTITY = 100000000;
  const MAX_POSITION = 1000000000;
  const MAX_ACCOUNT_VALUE = 1e30;
  const MIN_PRICE = 0.01;
  const MAX_PRICE = 1e12;
  const SCHEMA_VERSION = 2;
  const COMPANY_ID = 'company-main';

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function finiteNumber(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function cleanDisplayText(value, fallback, maxLength) {
    const text = String(value || fallback).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, maxLength);
    return text || fallback;
  }
  function randomUint32() {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const buffer = new Uint32Array(1); window.crypto.getRandomValues(buffer); return buffer[0] || 0x9e3779b9;
    }
    return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 0x9e3779b9;
  }
  function random01(state) {
    let x = state.rngState >>> 0; if (x === 0) x = 0x9e3779b9; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; state.rngState = x >>> 0; return state.rngState / 4294967296;
  }
  function gaussian(state) { const u1 = Math.max(random01(state), 1e-12); const u2 = random01(state); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); }
  function normalizeCompanyInput(input) {
    const source = input && typeof input === 'object' ? input : {};
    return { name: cleanDisplayText(source.name, 'テスト企業', 40), ticker: String(source.ticker || 'TEST').trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '').slice(0, 10) || 'TEST', price: clamp(finiteNumber(source.price, 1000), MIN_PRICE, MAX_PRICE), marketCap: clamp(finiteNumber(source.marketCap, 10000), 0, 1e12), per: clamp(finiteNumber(source.per, 15), -10000, 10000), volatility: clamp(finiteNumber(source.volatility, 30), 0, 500), drift: clamp(finiteNumber(source.drift, 5), -500, 500), sensitivity: clamp(finiteNumber(source.sensitivity, 1), 0, 10), logicMode: source.logicMode === 'linked' ? 'linked' : 'free' };
  }
  function makeCompany(state, input) {
    const clean = normalizeCompanyInput(input);
    return { id: COMPANY_ID, name: clean.name, ticker: clean.ticker, price: clean.price, marketCap: clean.marketCap, per: clean.per, volatility: clean.volatility, drift: clean.drift, sensitivity: clean.sensitivity, logicMode: clean.logicMode, metricBasePrice: clean.price, metricBaseMarketCap: clean.marketCap, metricBasePer: clean.per, pendingShock: 0, lastChange: 0, candles: [{ day: Math.max(1, state.day || 1), open: clean.price, high: clean.price, low: clean.price, close: clean.price }] };
  }
  function createDefaultState(seed) {
    const state = { schemaVersion: SCHEMA_VERSION, rngState: (seed >>> 0) || randomUint32(), sequence: 0, day: 1, marketMood: 0, marketVolatility: 100, cash: 1000000, initialCash: 1000000, realizedProfit: 0, allowNegativeCash: false, allowShort: false, tradeFeePercent: 0, selectedCompanyId: COMPANY_ID, positions: Object.create(null), trades: [], companies: [] };
    state.companies.push(makeCompany(state, { name: 'テスト企業', ticker: 'TEST', price: 1000, marketCap: 10000, per: 15, volatility: 30, drift: 5, sensitivity: 1, logicMode: 'free' }));
    for (let index = 0; index < 59; index += 1) stepOneDay(state);
    return state;
  }
  function currentCompany(state) { return state && Array.isArray(state.companies) ? state.companies[0] || null : null; }
  function updateLastChange(company) {
    const candles = company.candles; const last = candles[candles.length - 1]; const previous = candles.length > 1 ? candles[candles.length - 2] : null; const base = previous ? previous.close : last.open; company.lastChange = base > 0 ? ((last.close / base) - 1) * 100 : 0;
  }
  function syncLinkedMetrics(company) {
    if (company.logicMode !== 'linked' || company.metricBasePrice <= 0) return; const ratio = company.price / company.metricBasePrice; company.marketCap = clamp(company.metricBaseMarketCap * ratio, 0, 1e12); company.per = clamp(company.metricBasePer * ratio, -10000, 10000);
  }
  function setCurrentPrice(state, value) {
    const company = currentCompany(state); if (!company) return null; const price = clamp(finiteNumber(value, company.price), MIN_PRICE, MAX_PRICE); const last = company.candles[company.candles.length - 1]; company.price = price; if (last) { last.close = price; last.high = Math.max(last.open, last.high, price); last.low = Math.max(MIN_PRICE, Math.min(last.open, last.low, price)); } updateLastChange(company); syncLinkedMetrics(company); return company;
  }
  function adjustCurrentPrice(state, percent) { const company = currentCompany(state); if (!company) return null; const safePercent = clamp(finiteNumber(percent, 0), -99.99, 100000); return setCurrentPrice(state, company.price * (1 + safePercent / 100)); }
  function updateCompany(state, input) {
    const company = currentCompany(state); if (!company) return { ok: false, message: 'テスト企業が見つかりません。' }; const source = input && typeof input === 'object' ? input : {};
    if (Object.prototype.hasOwnProperty.call(source, 'name')) company.name = cleanDisplayText(source.name, 'テスト企業', 40);
    if (Object.prototype.hasOwnProperty.call(source, 'ticker')) company.ticker = String(source.ticker || 'TEST').trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '').slice(0, 10) || 'TEST';
    if (Object.prototype.hasOwnProperty.call(source, 'marketCap')) { company.marketCap = clamp(finiteNumber(source.marketCap, company.marketCap), 0, 1e12); company.metricBaseMarketCap = company.marketCap; company.metricBasePrice = company.price; }
    if (Object.prototype.hasOwnProperty.call(source, 'per')) { company.per = clamp(finiteNumber(source.per, company.per), -10000, 10000); company.metricBasePer = company.per; company.metricBasePrice = company.price; }
    if (Object.prototype.hasOwnProperty.call(source, 'volatility')) company.volatility = clamp(finiteNumber(source.volatility, company.volatility), 0, 500);
    if (Object.prototype.hasOwnProperty.call(source, 'drift')) company.drift = clamp(finiteNumber(source.drift, company.drift), -500, 500);
    if (Object.prototype.hasOwnProperty.call(source, 'sensitivity')) company.sensitivity = clamp(finiteNumber(source.sensitivity, company.sensitivity), 0, 10);
    if (Object.prototype.hasOwnProperty.call(source, 'logicMode')) { company.logicMode = source.logicMode === 'linked' ? 'linked' : 'free'; company.metricBasePrice = company.price; company.metricBaseMarketCap = company.marketCap; company.metricBasePer = company.per; }
    if (Object.prototype.hasOwnProperty.call(source, 'price')) setCurrentPrice(state, source.price);
    return { ok: true, company };
  }
  function stepCompany(state, company) {
    const previous = company.candles[company.candles.length - 1]; const previousClose = previous ? previous.close : company.price; const dailyVol = (company.volatility / 100) / Math.sqrt(252); const dailyDrift = (company.drift / 100) / 252; const moodEffect = (state.marketMood / 100) * 0.0012; const noise = gaussian(state) * dailyVol; const rareShock = random01(state) < 0.012 ? gaussian(state) * dailyVol * 3.5 * Math.max(0.25, company.sensitivity) : 0; const directedShock = clamp(company.pendingShock / 100, -0.95, 10) * company.sensitivity; company.pendingShock = 0; const gap = gaussian(state) * dailyVol * 0.18; const open = clamp(previousClose * Math.exp(gap), MIN_PRICE, MAX_PRICE); const rawReturn = dailyDrift + moodEffect + noise + rareShock + directedShock; const close = clamp(open * Math.exp(clamp(rawReturn, -3, 3)), MIN_PRICE, MAX_PRICE); const span = Math.max(Math.abs(close - open), open * dailyVol * (0.25 + random01(state) * 0.75)); const high = clamp(Math.max(open, close) + span * (0.25 + random01(state)), MIN_PRICE, MAX_PRICE); const low = clamp(Math.min(open, close) - span * (0.25 + random01(state)), MIN_PRICE, MAX_PRICE); company.price = close; company.candles.push({ day: state.day, open, high: Math.max(open, close, high), low: Math.max(MIN_PRICE, Math.min(open, close, low)), close }); if (company.candles.length > MAX_CANDLES) company.candles.splice(0, company.candles.length - MAX_CANDLES); updateLastChange(company); syncLinkedMetrics(company);
  }
  function stepOneDay(state) { state.day += 1; const company = currentCompany(state); if (company) stepCompany(state, company); }
  function stepMarket(state, days) { const safeDays = clamp(Math.floor(finiteNumber(days, 1)), 1, 200); for (let index = 0; index < safeDays; index += 1) stepOneDay(state); }
  function injectShock(state, percent) { const company = currentCompany(state); if (!company) return false; const safePercent = clamp(finiteNumber(percent, 0), -95, 1000); company.pendingShock = clamp(company.pendingShock + safePercent, -95, 1000); return true; }
  function ensurePosition(state) { if (!state.positions || typeof state.positions !== 'object') state.positions = Object.create(null); if (!state.positions[COMPANY_ID]) state.positions[COMPANY_ID] = { quantity: 0, averagePrice: 0 }; return state.positions[COMPANY_ID]; }
  function executeTrade(state, side, quantity) {
    const company = currentCompany(state); if (!company) return { ok: false, message: 'テスト企業が見つかりません。' }; const qty = Math.floor(clamp(finiteNumber(quantity, 0), 0, MAX_TRADE_QUANTITY)); if (qty <= 0) return { ok: false, message: '株数は1以上にしてください。' }; if (side !== 'buy' && side !== 'sell') return { ok: false, message: '売買方向が不正です。' }; const price = clamp(finiteNumber(company.price, MIN_PRICE), MIN_PRICE, MAX_PRICE); const feeRate = clamp(finiteNumber(state.tradeFeePercent, 0), 0, 10) / 100; const gross = price * qty; const fee = gross * feeRate; if (!Number.isFinite(gross) || !Number.isFinite(fee)) return { ok: false, message: '取引金額が大きすぎます。' }; const position = ensurePosition(state); const oldQty = clamp(finiteNumber(position.quantity, 0), -MAX_POSITION, MAX_POSITION); const oldAverage = clamp(finiteNumber(position.averagePrice, 0), 0, MAX_PRICE); const delta = side === 'buy' ? qty : -qty; const newQty = oldQty + delta; if (!Number.isFinite(newQty) || Math.abs(newQty) > MAX_POSITION) return { ok: false, message: '保有数の安全上限を超えます。' }; if (side === 'buy' && !state.allowNegativeCash && state.cash < gross + fee) return { ok: false, message: '現金が足りません。株数を減らしてください。' }; if (side === 'sell' && !state.allowShort && oldQty < qty) return { ok: false, message: '持っている株数を超えて売る場合は「空売り」を有効にしてください。' }; let realized = 0; let newAverage = oldAverage; if (oldQty === 0 || Math.sign(oldQty) === Math.sign(delta)) { const oldNotional = Math.abs(oldQty) * oldAverage; const addedNotional = Math.abs(delta) * price; newAverage = (oldNotional + addedNotional) / Math.max(1, Math.abs(newQty)); } else { const closingQty = Math.min(Math.abs(oldQty), Math.abs(delta)); realized = oldQty > 0 ? (price - oldAverage) * closingQty : (oldAverage - price) * closingQty; if (newQty === 0) newAverage = 0; else if (Math.sign(newQty) !== Math.sign(oldQty)) newAverage = price; } const cashDelta = side === 'buy' ? -(gross + fee) : gross - fee; const nextCash = finiteNumber(state.cash, 0) + cashDelta; const nextRealized = finiteNumber(state.realizedProfit, 0) + realized - fee; if (![nextCash, nextRealized, newAverage].every(Number.isFinite) || Math.abs(nextCash) > MAX_ACCOUNT_VALUE || Math.abs(nextRealized) > MAX_ACCOUNT_VALUE) return { ok: false, message: '口座の数値が安全上限を超えます。' }; position.quantity = newQty; position.averagePrice = newQty === 0 ? 0 : newAverage; state.cash = nextCash; state.realizedProfit = nextRealized; const trade = { id: 'trade-' + state.day + '-' + (state.sequence += 1), day: state.day, companyId: COMPANY_ID, companyName: company.name, ticker: company.ticker, side, quantity: qty, price, fee, realized }; state.trades.unshift(trade); if (state.trades.length > MAX_TRADES) state.trades.length = MAX_TRADES; return { ok: true, trade };
  }
  function portfolioValue(state) { const company = currentCompany(state); const position = state.positions && state.positions[COMPANY_ID] ? state.positions[COMPANY_ID] : { quantity: 0, averagePrice: 0 }; const marketValue = company ? position.quantity * company.price : 0; const unrealized = !company || !position.quantity ? 0 : position.quantity > 0 ? (company.price - position.averagePrice) * position.quantity : (position.averagePrice - company.price) * Math.abs(position.quantity); const total = state.cash + marketValue; return { cash: state.cash, marketValue, total, profit: total - state.initialCash, realized: state.realizedProfit, unrealized };
  }
  root.Engine = { SCHEMA_VERSION, COMPANY_ID, MAX_COMPANIES, MAX_CANDLES, MAX_TRADES, MAX_TRADE_QUANTITY, MAX_POSITION, MAX_ACCOUNT_VALUE, MIN_PRICE, MAX_PRICE, clamp, finiteNumber, cleanDisplayText, normalizeCompanyInput, createDefaultState, currentCompany, setCurrentPrice, adjustCurrentPrice, updateCompany, stepMarket, injectShock, executeTrade, portfolioValue };
}());
