(function () {
  'use strict';

  const root = window.StockSandbox = window.StockSandbox || {};
  const STORAGE_KEY = 'stocktrading0.state.v1';
  const MAX_IMPORT_BYTES = 1024 * 1024;

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function safeString(value, maxLength, fallback) {
    const text = typeof value === 'string' ? value.trim() : '';
    return (text || fallback).slice(0, maxLength);
  }

  function safeNumber(value, min, max, fallback) {
    return isFiniteNumber(value) ? Math.min(max, Math.max(min, value)) : fallback;
  }

  function validateCandle(candle) {
    if (!candle || typeof candle !== 'object') return null;
    const day = Math.floor(safeNumber(candle.day, 1, 1000000000, 1));
    const open = safeNumber(candle.open, 0.01, 1e12, NaN);
    const high = safeNumber(candle.high, 0.01, 1e12, NaN);
    const low = safeNumber(candle.low, 0.01, 1e12, NaN);
    const close = safeNumber(candle.close, 0.01, 1e12, NaN);
    if (![open, high, low, close].every(Number.isFinite)) return null;
    return {
      day,
      open,
      high: Math.max(open, close, high),
      low: Math.max(0.01, Math.min(open, close, low)),
      close
    };
  }

  function validateCompany(company, engine) {
    if (!company || typeof company !== 'object') return null;
    const id = safeString(company.id, 80, '');
    if (!id) return null;
    const candles = Array.isArray(company.candles)
      ? company.candles.slice(-engine.MAX_CANDLES).map(validateCandle).filter(Boolean)
      : [];
    if (!candles.length) return null;
    const price = safeNumber(company.price, engine.MIN_PRICE, engine.MAX_PRICE, candles[candles.length - 1].close);
    return {
      id,
      name: safeString(company.name, 40, '無名株式会社'),
      ticker: safeString(company.ticker, 10, 'NONE').toUpperCase().replace(/[^A-Z0-9._-]/g, '') || 'NONE',
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

  function validateTrade(trade, validCompanyIds) {
    if (!trade || typeof trade !== 'object') return null;
    const companyId = safeString(trade.companyId, 80, '');
    if (!validCompanyIds.has(companyId)) return null;
    const side = trade.side === 'sell' ? 'sell' : 'buy';
    return {
      id: safeString(trade.id, 80, 'trade-imported'),
      day: Math.floor(safeNumber(trade.day, 1, 1000000000, 1)),
      companyId,
      companyName: safeString(trade.companyName, 40, '無名株式会社'),
      ticker: safeString(trade.ticker, 10, 'NONE'),
      side,
      quantity: Math.floor(safeNumber(trade.quantity, 1, 100000000, 1)),
      price: safeNumber(trade.price, 0.01, 1e12, 0.01),
      fee: safeNumber(trade.fee, 0, 1e18, 0),
      realized: safeNumber(trade.realized, -1e18, 1e18, 0)
    };
  }

  function validateState(input) {
    const engine = root.Engine;
    if (!engine || !input || typeof input !== 'object') {
      throw new Error('保存データの形式が不正です。');
    }
    if (input.schemaVersion !== engine.SCHEMA_VERSION) {
      throw new Error('この保存データのバージョンには対応していません。');
    }

    const companies = Array.isArray(input.companies)
      ? input.companies.slice(0, engine.MAX_COMPANIES).map((item) => validateCompany(item, engine)).filter(Boolean)
      : [];
    if (!companies.length) throw new Error('有効な架空企業がありません。');

    const ids = new Set(companies.map((company) => company.id));
    const positions = {};
    if (input.positions && typeof input.positions === 'object' && !Array.isArray(input.positions)) {
      for (const company of companies) {
        const position = input.positions[company.id];
        if (!position || typeof position !== 'object') continue;
        positions[company.id] = {
          quantity: safeNumber(position.quantity, -100000000, 100000000, 0),
          averagePrice: safeNumber(position.averagePrice, 0, 1e12, 0)
        };
      }
    }

    const trades = Array.isArray(input.trades)
      ? input.trades.slice(0, engine.MAX_TRADES).map((item) => validateTrade(item, ids)).filter(Boolean)
      : [];

    const selected = safeString(input.selectedCompanyId, 80, companies[0].id);
    return {
      schemaVersion: engine.SCHEMA_VERSION,
      rngState: Math.floor(safeNumber(input.rngState, 1, 0xffffffff, 0x9e3779b9)) >>> 0,
      sequence: Math.floor(safeNumber(input.sequence, 0, 1000000000, 0)),
      day: Math.floor(safeNumber(input.day, 1, 1000000000, 1)),
      marketMood: safeNumber(input.marketMood, -100, 100, 0),
      marketVolatility: safeNumber(input.marketVolatility, 10, 300, 100),
      cash: safeNumber(input.cash, -1e18, 1e18, 1000000),
      initialCash: safeNumber(input.initialCash, 0.01, 1e18, 1000000),
      realizedProfit: safeNumber(input.realizedProfit, -1e18, 1e18, 0),
      allowNegativeCash: input.allowNegativeCash === true,
      allowShort: input.allowShort === true,
      tradeFeePercent: safeNumber(input.tradeFeePercent, 0, 10, 0),
      selectedCompanyId: ids.has(selected) ? selected : companies[0].id,
      positions,
      trades,
      companies
    };
  }

  function saveState(state) {
    try {
      const validated = validateState(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '保存できませんでした。' };
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ok: false, empty: true };
      if (new Blob([raw]).size > MAX_IMPORT_BYTES) {
        localStorage.removeItem(STORAGE_KEY);
        return { ok: false, message: '保存データが大きすぎるため初期化しました。' };
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
    const text = JSON.stringify(validated, null, 2);
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
    if (file.size > MAX_IMPORT_BYTES) throw new Error('JSONは1MB以下にしてください。');
    const text = typeof file.text === 'function' ? await file.text() : await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result || '')));
      reader.addEventListener('error', () => reject(new Error('ファイルを読み込めませんでした。')));
      reader.readAsText(file);
    });
    if (new Blob([text]).size > MAX_IMPORT_BYTES) throw new Error('JSONは1MB以下にしてください。');
    return validateState(JSON.parse(text));
  }

  root.Storage = {
    STORAGE_KEY,
    MAX_IMPORT_BYTES,
    validateState,
    saveState,
    loadState,
    clearState,
    exportState,
    importFile
  };
}());
