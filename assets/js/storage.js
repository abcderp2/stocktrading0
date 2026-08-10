(function () {
  'use strict';

  const root = window.StockSandbox = window.StockSandbox || {};
  const STORAGE_KEY = 'stocktrading0.state.v3';
  const LEGACY_KEYS = ['stocktrading0.state.v2', 'stocktrading0.state.v1'];
  const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
  const MAX_LOCAL_SAVE_BYTES = 2500000;
  const LOCAL_CANDLE_LIMITS = [600, 360, 240, 120];
  const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

  function isFiniteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
  function cleanText(value, maxLength, fallback) {
    const text = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim() : '';
    return (text || fallback).slice(0, maxLength);
  }
  function safeId(value, maxLength) {
    const text = typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
    if (!text || UNSAFE_KEYS.has(text) || !/^[A-Za-z0-9._-]+$/.test(text)) return '';
    return text;
  }
  function safeNumber(value, min, max, fallback) { return isFiniteNumber(value) ? Math.min(max, Math.max(min, value)) : fallback; }
  function byteSize(text) {
    if (typeof Blob === 'function') return new Blob([text]).size;
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
    return String(text).length * 2;
  }
  function validateDate(value, engine) { return engine.parseIsoDate(value) ? value : ''; }
  function validateCandle(candle, engine) {
    if (!candle || typeof candle !== 'object') return null;
    const source = Array.isArray(candle)
      ? { day: candle[0], date: candle[1], open: candle[2], high: candle[3], low: candle[4], close: candle[5] }
      : candle;
    const day = Math.floor(safeNumber(source.day, 1, 1000000000, NaN));
    const date = validateDate(source.date, engine);
    const open = safeNumber(source.open, engine.MIN_PRICE, engine.MAX_PRICE, NaN);
    const high = safeNumber(source.high, engine.MIN_PRICE, engine.MAX_PRICE, NaN);
    const low = safeNumber(source.low, engine.MIN_PRICE, engine.MAX_PRICE, NaN);
    const close = safeNumber(source.close, engine.MIN_PRICE, engine.MAX_PRICE, NaN);
    if (!date || ![day, open, high, low, close].every(Number.isFinite)) return null;
    return { day, date, open, high: Math.max(open, close, high), low: Math.max(engine.MIN_PRICE, Math.min(open, close, low)), close };
  }
  function validateCompany(company, engine, stateDay, currentDate) {
    if (!company || typeof company !== 'object' || Array.isArray(company)) return null;
    const id = safeId(company.id, 80); if (id !== engine.COMPANY_ID) return null;
    const sourceCandles = Array.isArray(company.candles) ? company.candles.slice(-engine.MAX_CANDLES) : [];
    if (!sourceCandles.length) return null;
    const candles = sourceCandles.map((item) => validateCandle(item, engine)); if (candles.some((item) => !item)) return null;
    for (let index = 1; index < candles.length; index += 1) {
      if (candles[index].day <= candles[index - 1].day || candles[index].date <= candles[index - 1].date) return null;
    }
    const last = candles[candles.length - 1]; if (last.day !== stateDay || last.date !== currentDate) return null;
    const price = last.close;
    return {
      id: engine.COMPANY_ID,
      name: cleanText(company.name, 40, 'テスト企業'),
      ticker: cleanText(company.ticker, 10, 'TEST').toUpperCase().replace(/[^A-Z0-9._-]/g, '') || 'TEST',
      price,
      marketCap: safeNumber(company.marketCap, 0, 1e12, 10000),
      per: safeNumber(company.per, -10000, 10000, 15),
      volatility: safeNumber(company.volatility, 0, 500, 30),
      drift: safeNumber(company.drift, -500, 500, 5),
      sensitivity: safeNumber(company.sensitivity, 0, 10, 1),
      logicMode: company.logicMode === 'linked' ? 'linked' : 'free',
      metricBasePrice: safeNumber(company.metricBasePrice, engine.MIN_PRICE, engine.MAX_PRICE, price),
      metricBaseMarketCap: safeNumber(company.metricBaseMarketCap, 0, 1e12, company.marketCap || 10000),
      metricBasePer: safeNumber(company.metricBasePer, -10000, 10000, company.per || 15),
      pendingShock: safeNumber(company.pendingShock, -95, 1000, 0),
      lastChange: safeNumber(company.lastChange, -10000, 100000, 0),
      candles
    };
  }
  function validateTrade(trade, engine, stateDay, currentDate, company) {
    if (!trade || typeof trade !== 'object' || Array.isArray(trade)) return null;
    if (trade.side !== 'buy' && trade.side !== 'sell') return null;
    const day = Math.floor(safeNumber(trade.day, 1, stateDay, NaN));
    const date = validateDate(trade.date, engine);
    const quantity = Math.floor(safeNumber(trade.quantity, 1, engine.MAX_TRADE_QUANTITY, NaN));
    if (!date || date > currentDate || !Number.isFinite(day) || !Number.isFinite(quantity)) return null;
    return {
      id: safeId(trade.id, 80) || 'trade-imported-' + day + '-' + quantity,
      day, date, companyId: engine.COMPANY_ID, companyName: company.name, ticker: company.ticker, side: trade.side, quantity,
      price: safeNumber(trade.price, engine.MIN_PRICE, engine.MAX_PRICE, engine.MIN_PRICE),
      fee: safeNumber(trade.fee, 0, engine.MAX_ACCOUNT_VALUE, 0),
      realized: safeNumber(trade.realized, -engine.MAX_ACCOUNT_VALUE, engine.MAX_ACCOUNT_VALUE, 0)
    };
  }
  function validateState(input) {
    const engine = root.Engine;
    if (!engine || !input || typeof input !== 'object' || Array.isArray(input)) throw new Error('保存データの形式が不正です。');
    if (input.schemaVersion !== engine.SCHEMA_VERSION) throw new Error('この保存データのバージョンには対応していません。');
    const day = Math.floor(safeNumber(input.day, 1, 1000000000, NaN));
    const currentDate = validateDate(input.currentDate, engine);
    if (!Number.isFinite(day) || !currentDate) throw new Error('保存データの日付が不正です。');
    const sourceCompany = Array.isArray(input.companies) ? input.companies[0] : null;
    const company = validateCompany(sourceCompany, engine, day, currentDate); if (!company) throw new Error('テスト企業またはチャートデータが不正です。');
    const positions = Object.create(null);
    const rawPosition = input.positions && typeof input.positions === 'object' && !Array.isArray(input.positions) ? input.positions[engine.COMPANY_ID] : null;
    if (rawPosition && typeof rawPosition === 'object' && !Array.isArray(rawPosition)) {
      const quantity = Math.trunc(safeNumber(rawPosition.quantity, -engine.MAX_POSITION, engine.MAX_POSITION, 0));
      positions[engine.COMPANY_ID] = { quantity, averagePrice: quantity === 0 ? 0 : safeNumber(rawPosition.averagePrice, engine.MIN_PRICE, engine.MAX_PRICE, company.price) };
    }
    const sourceTrades = Array.isArray(input.trades) ? input.trades.slice(0, engine.MAX_TRADES) : [];
    const trades = sourceTrades.map((item) => validateTrade(item, engine, day, currentDate, company));
    if (trades.some((item) => !item)) throw new Error('取引履歴の形式が不正です。');
    return {
      schemaVersion: engine.SCHEMA_VERSION,
      rngState: Math.floor(safeNumber(input.rngState, 1, 0xffffffff, 0x9e3779b9)) >>> 0,
      sequence: Math.floor(safeNumber(input.sequence, 0, 1000000000, 0)),
      day, currentDate,
      calendarMode: input.calendarMode === 'everyday' ? 'everyday' : 'weekdays',
      marketMood: safeNumber(input.marketMood, -100, 100, 0),
      marketVolatility: safeNumber(input.marketVolatility, 10, 300, 100),
      cash: safeNumber(input.cash, -engine.MAX_ACCOUNT_VALUE, engine.MAX_ACCOUNT_VALUE, 1000000),
      initialCash: safeNumber(input.initialCash, 0.01, engine.MAX_ACCOUNT_VALUE, 1000000),
      realizedProfit: safeNumber(input.realizedProfit, -engine.MAX_ACCOUNT_VALUE, engine.MAX_ACCOUNT_VALUE, 0),
      allowNegativeCash: input.allowNegativeCash === true,
      allowShort: input.allowShort === true,
      tradeFeePercent: safeNumber(input.tradeFeePercent, 0, 10, 0),
      selectedCompanyId: engine.COMPANY_ID,
      positions, trades, companies: [company]
    };
  }
  function makeCompactSnapshot(validated, candleLimit) {
    const engine = root.Engine; const limit = Math.max(1, Math.min(candleLimit, engine.MAX_CANDLES)); const company = validated.companies[0];
    return {
      schemaVersion: validated.schemaVersion, rngState: validated.rngState, sequence: validated.sequence, day: validated.day, currentDate: validated.currentDate,
      calendarMode: validated.calendarMode, marketMood: validated.marketMood, marketVolatility: validated.marketVolatility,
      cash: validated.cash, initialCash: validated.initialCash, realizedProfit: validated.realizedProfit,
      allowNegativeCash: validated.allowNegativeCash, allowShort: validated.allowShort, tradeFeePercent: validated.tradeFeePercent,
      selectedCompanyId: engine.COMPANY_ID, positions: validated.positions, trades: validated.trades,
      companies: [{ ...company, candles: company.candles.slice(-limit).map((candle) => [candle.day, candle.date, candle.open, candle.high, candle.low, candle.close]) }]
    };
  }
  function saveState(state) {
    try {
      const validated = validateState(state); let lastError = null;
      for (const limit of LOCAL_CANDLE_LIMITS) {
        const text = JSON.stringify(makeCompactSnapshot(validated, limit)); if (byteSize(text) > MAX_LOCAL_SAVE_BYTES) continue;
        try { localStorage.setItem(STORAGE_KEY, text); return { ok: true, savedCandleLimit: limit }; } catch (error) { lastError = error; }
      }
      return { ok: false, message: lastError ? '端末の保存容量が不足しています。JSONバックアップを書き出してください。' : '保存データが大きすぎます。' };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : '保存できませんでした。' }; }
  }
  function legacyToV3(input) {
    const engine = root.Engine; if (!input || typeof input !== 'object') throw new Error('旧保存データの形式が不正です。');
    const companies = Array.isArray(input.companies) ? input.companies : [];
    let source = companies.find((item) => item && item.id === input.selectedCompanyId) || companies[0];
    if (!source || !Array.isArray(source.candles) || !source.candles.length) throw new Error('旧保存データにチャートがありません。');
    const candles = source.candles.slice(-engine.MAX_CANDLES); const dates = engine.tradingDatesEnding(engine.todayIso(), candles.length, 'weekdays');
    const converted = engine.createDefaultState(Number(input.rngState) || 123456789, dates[dates.length - 1]); const company = converted.companies[0];
    company.name = cleanText(source.name, 40, 'テスト企業'); company.ticker = cleanText(source.ticker, 10, 'TEST').toUpperCase().replace(/[^A-Z0-9._-]/g, '') || 'TEST';
    company.marketCap = safeNumber(source.marketCap, 0, 1e12, 10000); company.per = safeNumber(source.per, -10000, 10000, 15);
    company.volatility = safeNumber(source.volatility, 0, 500, 30); company.drift = safeNumber(source.drift, -500, 500, 5); company.sensitivity = safeNumber(source.sensitivity, 0, 10, 1); company.logicMode = source.logicMode === 'linked' ? 'linked' : 'free';
    company.candles = candles.map((raw, index) => {
      const c = Array.isArray(raw) ? { day: raw[0], open: raw[1], high: raw[2], low: raw[3], close: raw[4] } : raw;
      const open = safeNumber(c.open, engine.MIN_PRICE, engine.MAX_PRICE, engine.START_PRICE); const close = safeNumber(c.close, engine.MIN_PRICE, engine.MAX_PRICE, open);
      return { day: index + 1, date: dates[index], open, high: Math.max(open, close, safeNumber(c.high, engine.MIN_PRICE, engine.MAX_PRICE, Math.max(open, close))), low: Math.max(engine.MIN_PRICE, Math.min(open, close, safeNumber(c.low, engine.MIN_PRICE, engine.MAX_PRICE, Math.min(open, close)))), close };
    });
    const last = company.candles[company.candles.length - 1]; company.price = last.close; converted.day = last.day; converted.currentDate = last.date;
    company.metricBasePrice = company.price; company.metricBaseMarketCap = company.marketCap; company.metricBasePer = company.per;
    converted.marketMood = safeNumber(input.marketMood, -100, 100, 0); converted.cash = safeNumber(input.cash, -engine.MAX_ACCOUNT_VALUE, engine.MAX_ACCOUNT_VALUE, 1000000); converted.initialCash = safeNumber(input.initialCash, 0.01, engine.MAX_ACCOUNT_VALUE, 1000000); converted.realizedProfit = safeNumber(input.realizedProfit, -engine.MAX_ACCOUNT_VALUE, engine.MAX_ACCOUNT_VALUE, 0);
    converted.allowNegativeCash = input.allowNegativeCash === true; converted.allowShort = input.allowShort === true; converted.tradeFeePercent = safeNumber(input.tradeFeePercent, 0, 10, 0); converted.positions = Object.create(null); converted.trades = [];
    return validateState(converted);
  }
  function parseAnyState(raw) {
    const parsed = JSON.parse(raw); if (parsed && parsed.schemaVersion === root.Engine.SCHEMA_VERSION) return validateState(parsed);
    if (parsed && (parsed.schemaVersion === 2 || parsed.schemaVersion === 1)) return legacyToV3(parsed);
    throw new Error('この保存データのバージョンには対応していません。');
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        if (byteSize(raw) > MAX_IMPORT_BYTES) return { ok: false, message: '端末内の保存データが大きすぎます。' };
        return { ok: true, state: parseAnyState(raw), migrated: false };
      }
      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key); if (!legacy) continue;
        if (byteSize(legacy) > MAX_IMPORT_BYTES) continue;
        const state = parseAnyState(legacy); return { ok: true, state, migrated: true, legacyKey: key };
      }
      return { ok: false, empty: true };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : '保存データを読み込めませんでした。' }; }
  }
  function clearState() { try { localStorage.removeItem(STORAGE_KEY); return true; } catch (_error) { return false; } }
  function exportState(state) {
    const validated = validateState(state); const text = JSON.stringify(makeCompactSnapshot(validated, root.Engine.MAX_CANDLES));
    if (byteSize(text) > MAX_IMPORT_BYTES) throw new Error('バックアップが8MBを超えました。');
    const blob = new Blob([text], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'kabuka-asobiba-save-v3.json'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file) {
    if (!(file instanceof File)) throw new Error('ファイルを選択してください。'); if (file.size > MAX_IMPORT_BYTES) throw new Error('JSONは8MB以下にしてください。');
    const text = typeof file.text === 'function' ? await file.text() : await new Promise((resolve, reject) => { const reader = new FileReader(); reader.addEventListener('load', () => resolve(String(reader.result || ''))); reader.addEventListener('error', () => reject(new Error('ファイルを読み込めませんでした。'))); reader.readAsText(file); });
    if (byteSize(text) > MAX_IMPORT_BYTES) throw new Error('JSONは8MB以下にしてください。'); return parseAnyState(text);
  }

  root.Storage = { STORAGE_KEY, LEGACY_KEYS, MAX_IMPORT_BYTES, MAX_LOCAL_SAVE_BYTES, validateState, saveState, loadState, clearState, exportState, importFile, legacyToV3 };
}());
