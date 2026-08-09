(function () {
  'use strict';

  const root = window.StockSandbox = window.StockSandbox || {};
  const STORAGE_KEY = 'stocktrading0.state.v1';
  const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
  const MAX_LOCAL_SAVE_BYTES = 2500000;
  const LOCAL_CANDLE_LIMITS = [600, 360, 240, 120];
  const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function cleanText(value, maxLength, fallback) {
    const text = typeof value === 'string'
      ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim()
      : '';
    return (text || fallback).slice(0, maxLength);
  }

  function safeId(value, maxLength) {
    const text = typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
    if (!text || UNSAFE_KEYS.has(text) || !/^[A-Za-z0-9._-]+$/.test(text)) return '';
    return text;
  }

  function safeNumber(value, min, max, fallback) {
    return isFiniteNumber(value) ? Math.min(max, Math.max(min, value)) : fallback;
  }

  function byteSize(text) {
    return new Blob([text]).size;
  }

  function validateCandle(candle) {
    if (!candle || typeof candle !== 'object') return null;
    const source = Array.isArray(candle)
      ? { day: candle[0], open: candle[1], high: candle[2], low: candle[3], close: candle[4] }
      : candle;
    const day = Math.floor(safeNumber(source.day, 1, 1000000000, NaN));
    const open = safeNumber(source.open, 0.01, 1e12, NaN);
    const high = safeNumber(source.high, 0.01, 1e12, NaN);
    const low = safeNumber(source.low, 0.01, 1e12, NaN);
    const close = safeNumber(source.close, 0.01, 1e12, NaN);
    if (![day, open, high, low, close].every(Number.isFinite)) return null;
    return {
      day,
      open,
      high: Math.max(open, close, high),
      low: Math.max(0.01, Math.min(open, close, low)),
      close
    };
  }

  function validateCompany(company, engine, stateDay) {
    if (!company || typeof company !== 'object' || Array.isArray(company)) return null;
    const id = safeId(company.id, 80);
    if (!id) return null;
    const sourceCandles = Array.isArray(company.candles) ? company.candles.slice(-engine.MAX_CANDLES) : [];
    if (!sourceCandles.length) return null;
    const candles = sourceCandles.map(validateCandle);
    if (candles.some((item) => !item)) return null;
    for (let index = 1; index < candles.length; index += 1) {
      if (candles[index].day <= candles[index - 1].day) return null;
    }
    if (candles[candles.length - 1].day !== stateDay) return null;

    const price = candles[candles.length - 1].close;
    return {
      id,
      name: cleanText(company.name, 40, '無名株式会社'),
      ticker: cleanText(company.ticker, 10, 'NONE').toUpperCase().replace(/[^A-Z0-9._-]/g, '') || 'NONE',
      price,
      marketCap: safeNumber(company.marketCap, 0, 1e12, 0),
      per: safeNumber(company.per, -10000, 10000, 0),
      volatility: safeNumber(company.volatility, 0, 500, 30),
      drift: safeNumber(company.drift, -500, 500, 0),
      sensitivity: safeNumber(company.sensitivity, 0, 10, 1),
      logicMode: company.logicMode === 'linked' ? 'linked' : 'free',
      metricBasePrice: safeNumber(company.metricBasePrice, engine.MIN_PRICE, engine.MAX_PRICE, price),
      metricBaseMarketCap: safeNumber(company.metricBaseMarketCap, 0, 1e12, company.marketCap || 0),
      metricBasePer: safeNumber(company.metricBasePer, -10000, 10000, company.per || 0),
      pendingShock: safeNumber(company.pendingShock, -95, 1000, 0),
      lastChange: safeNumber(company.lastChange, -10000, 100000, 0),
      candles
    };
  }

  function validateTrade(trade, companyMap, engine, stateDay) {
    if (!trade || typeof trade !== 'object' || Array.isArray(trade)) return null;
    const companyId = safeId(trade.companyId, 80);
    const company = companyMap.get(companyId);
    if (!company || (trade.side !== 'buy' && trade.side !== 'sell')) return null;
    const day = Math.floor(safeNumber(trade.day, 1, stateDay, NaN));
    const quantity = Math.floor(safeNumber(trade.quantity, 1, engine.MAX_TRADE_QUANTITY, NaN));
    if (!Number.isFinite(day) || !Number.isFinite(quantity)) return null;
    return {
      id: safeId(trade.id, 80) || 'trade-imported-' + day + '-' + quantity,
      day,
      companyId,
      companyName: company.name,
      ticker: company.ticker,
      side: trade.side,
      quantity,
      price: safeNumber(trade.price, engine.MIN_PRICE, engine.MAX_PRICE, engine.MIN_PRICE),
      fee: safeNumber(trade.fee, 0, engine.MAX_ACCOUNT_VALUE, 0),
      realized: safeNumber(trade.realized, -engine.MAX_ACCOUNT_VALUE, engine.MAX_ACCOUNT_VALUE, 0)
    };
  }

  function validateState(input) {
    const engine = root.Engine;
    if (!engine || !input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('保存データの形式が不正です。');
    }
    if (input.schemaVersion !== engine.SCHEMA_VERSION) {
      throw new Error('この保存データのバージョンには対応していません。');
    }

    const day = Math.floor(safeNumber(input.day, 1, 1000000000, NaN));
    if (!Number.isFinite(day)) throw new Error('保存データの日付が不正です。');

    const sourceCompanies = Array.isArray(input.companies) ? input.companies.slice(0, engine.MAX_COMPANIES) : [];
    const companies = sourceCompanies.map((item) => validateCompany(item, engine, day));
    if (!companies.length || companies.some((item) => !item)) {
      throw new Error('架空企業またはチャートデータが不正です。');
    }

    const ids = new Set(companies.map((company) => company.id));
    if (ids.size !== companies.length) throw new Error('架空企業IDが重複しています。');
    const companyMap = new Map(companies.map((company) => [company.id, company]));

    const positions = Object.create(null);
    if (input.positions && typeof input.positions === 'object' && !Array.isArray(input.positions)) {
      for (const company of companies) {
        const position = Object.prototype.hasOwnProperty.call(input.positions, company.id)
          ? input.positions[company.id]
          : null;
        if (!position || typeof position !== 'object' || Array.isArray(position)) continue;
        const quantity = Math.trunc(safeNumber(position.quantity, -engine.MAX_POSITION, engine.MAX_POSITION, 0));
        positions[company.id] = {
          quantity,
          averagePrice: quantity === 0 ? 0 : safeNumber(position.averagePrice, engine.MIN_PRICE, engine.MAX_PRICE, company.price)
        };
      }
    }

    const sourceTrades = Array.isArray(input.trades) ? input.trades.slice(0, engine.MAX_TRADES) : [];
    const trades = sourceTrades.map((item) => validateTrade(item, companyMap, engine, day));
    if (trades.some((item) => !item)) throw new Error('取引履歴の形式が不正です。');

    const selected = safeId(input.selectedCompanyId, 80);
    return {
      schemaVersion: engine.SCHEMA_VERSION,
      rngState: Math.floor(safeNumber(input.rngState, 1, 0xffffffff, 0x9e3779b9)) >>> 0,
      sequence: Math.floor(safeNumber(input.sequence, 0, 1000000000, 0)),
      day,
      marketMood: safeNumber(input.marketMood, -100, 100, 0),
      marketVolatility: safeNumber(input.marketVolatility, 10, 300, 100),
      cash: safeNumber(input.cash, -engine.MAX_ACCOUNT_VALUE, engine.MAX_ACCOUNT_VALUE, 1000000),
      initialCash: safeNumber(input.initialCash, 0.01, engine.MAX_ACCOUNT_VALUE, 1000000),
      realizedProfit: safeNumber(input.realizedProfit, -engine.MAX_ACCOUNT_VALUE, engine.MAX_ACCOUNT_VALUE, 0),
      allowNegativeCash: input.allowNegativeCash === true,
      allowShort: input.allowShort === true,
      tradeFeePercent: safeNumber(input.tradeFeePercent, 0, 10, 0),
      selectedCompanyId: ids.has(selected) ? selected : companies[0].id,
      positions,
      trades,
      companies
    };
  }

  function makeCompactSnapshot(validated, candleLimit) {
    const limit = Math.max(1, Math.min(candleLimit, root.Engine.MAX_CANDLES));
    return {
      schemaVersion: validated.schemaVersion,
      rngState: validated.rngState,
      sequence: validated.sequence,
      day: validated.day,
      marketMood: validated.marketMood,
      marketVolatility: validated.marketVolatility,
      cash: validated.cash,
      initialCash: validated.initialCash,
      realizedProfit: validated.realizedProfit,
      allowNegativeCash: validated.allowNegativeCash,
      allowShort: validated.allowShort,
      tradeFeePercent: validated.tradeFeePercent,
      selectedCompanyId: validated.selectedCompanyId,
      positions: validated.positions,
      trades: validated.trades,
      companies: validated.companies.map((company) => ({
        id: company.id,
        name: company.name,
        ticker: company.ticker,
        price: company.price,
        marketCap: company.marketCap,
        per: company.per,
        volatility: company.volatility,
        drift: company.drift,
        sensitivity: company.sensitivity,
        logicMode: company.logicMode,
        metricBasePrice: company.metricBasePrice,
        metricBaseMarketCap: company.metricBaseMarketCap,
        metricBasePer: company.metricBasePer,
        pendingShock: company.pendingShock,
        lastChange: company.lastChange,
        candles: company.candles.slice(-limit).map((candle) => [
          candle.day, candle.open, candle.high, candle.low, candle.close
        ])
      }))
    };
  }

  function saveState(state) {
    try {
      const validated = validateState(state);
      const limits = Array.from(new Set(LOCAL_CANDLE_LIMITS.map((limit) => Math.min(limit, root.Engine.MAX_CANDLES))));
      let lastError = null;
      for (const limit of limits) {
        const text = JSON.stringify(makeCompactSnapshot(validated, limit));
        if (byteSize(text) > MAX_LOCAL_SAVE_BYTES) continue;
        try {
          localStorage.setItem(STORAGE_KEY, text);
          return { ok: true, savedCandleLimit: limit };
        } catch (error) {
          lastError = error;
        }
      }
      return {
        ok: false,
        message: lastError instanceof Error
          ? '端末の保存容量が不足しています。JSONを書き出してから古いデータを整理してください。'
          : '保存データが大きすぎます。JSONを書き出してから古いデータを整理してください。'
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '保存できませんでした。' };
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ok: false, empty: true };
      if (byteSize(raw) > MAX_IMPORT_BYTES) {
        return { ok: false, message: '端末内の保存データが大きすぎるため読み込みませんでした。' };
      }
      return { ok: true, state: validateState(JSON.parse(raw)) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '保存データを読み込めませんでした。' };
    }
  }

  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function exportState(state) {
    const validated = validateState(state);
    const text = JSON.stringify(makeCompactSnapshot(validated, root.Engine.MAX_CANDLES));
    if (byteSize(text) > MAX_IMPORT_BYTES) {
      throw new Error('完全バックアップが8MBを超えました。銘柄数または履歴を減らしてから書き出してください。');
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stocktrading0-save-v1.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importFile(file) {
    if (!(file instanceof File)) throw new Error('ファイルを選択してください。');
    if (file.size > MAX_IMPORT_BYTES) throw new Error('JSONは8MB以下にしてください。');
    const text = typeof file.text === 'function' ? await file.text() : await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result || '')));
      reader.addEventListener('error', () => reject(new Error('ファイルを読み込めませんでした。')));
      reader.readAsText(file);
    });
    if (byteSize(text) > MAX_IMPORT_BYTES) throw new Error('JSONは8MB以下にしてください。');
    return validateState(JSON.parse(text));
  }

  root.Storage = {
    STORAGE_KEY,
    MAX_IMPORT_BYTES,
    MAX_LOCAL_SAVE_BYTES,
    validateState,
    saveState,
    loadState,
    clearState,
    exportState,
    importFile
  };
}());