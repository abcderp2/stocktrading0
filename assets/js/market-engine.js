(function () {
  'use strict';

  const root = window.StockSandbox = window.StockSandbox || {};
  const MAX_COMPANIES = 40;
  const MAX_CANDLES = 1200;
  const MAX_TRADES = 300;
  const MAX_TRADE_QUANTITY = 100000000;
  const MAX_POSITION = 1000000000;
  const MAX_ACCOUNT_VALUE = 1e30;
  const MIN_PRICE = 0.01;
  const MAX_PRICE = 1e12;
  const SCHEMA_VERSION = 1;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cleanDisplayText(value, fallback, maxLength) {
    const text = String(value || fallback)
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
      .trim()
      .slice(0, maxLength);
    return text || fallback;
  }

  function randomUint32() {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return buffer[0] || 0x9e3779b9;
    }
    return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 0x9e3779b9;
  }

  function random01(state) {
    let x = state.rngState >>> 0;
    if (x === 0) x = 0x9e3779b9;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state.rngState = x >>> 0;
    return (state.rngState >>> 0) / 4294967296;
  }

  function gaussian(state) {
    const u1 = Math.max(random01(state), 1e-12);
    const u2 = random01(state);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function newId(state, prefix) {
    state.sequence = (state.sequence || 0) + 1;
    return prefix + '-' + state.sequence.toString(36) + '-' + Math.floor(random01(state) * 0xffffff).toString(36);
  }

  function normalizeCompanyInput(input) {
    const source = input && typeof input === 'object' ? input : {};
    const price = clamp(finiteNumber(source.price, 1000), MIN_PRICE, MAX_PRICE);
    return {
      name: cleanDisplayText(source.name, '無名株式会社', 40),
      ticker: String(source.ticker || 'NONE').trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '').slice(0, 10) || 'NONE',
      price,
      marketCap: clamp(finiteNumber(source.marketCap, 1000), 0, 1e12),
      per: clamp(finiteNumber(source.per, 15), -10000, 10000),
      volatility: clamp(finiteNumber(source.volatility, 30), 0, 500),
      drift: clamp(finiteNumber(source.drift, 5), -500, 500),
      sensitivity: clamp(finiteNumber(source.sensitivity, 1), 0, 10),
      logicMode: source.logicMode === 'linked' ? 'linked' : 'free'
    };
  }

  function makeCompany(state, input) {
    const clean = normalizeCompanyInput(input);
    const initialCandle = {
      day: Math.max(1, state.day || 1),
      open: clean.price,
      high: clean.price,
      low: clean.price,
      close: clean.price
    };
    return {
      id: newId(state, 'company'),
      name: clean.name,
      ticker: clean.ticker,
      price: clean.price,
      marketCap: clean.marketCap,
      per: clean.per,
      volatility: clean.volatility,
      drift: clean.drift,
      sensitivity: clean.sensitivity,
      logicMode: clean.logicMode,
      metricBasePrice: clean.price,
      metricBaseMarketCap: clean.marketCap,
      metricBasePer: clean.per,
      pendingShock: 0,
      lastChange: 0,
      candles: [initialCandle]
    };
  }

  function createDefaultState(seed) {
    const state = {
      schemaVersion: SCHEMA_VERSION,
      rngState: (seed >>> 0) || randomUint32(),
      sequence: 0,
      day: 1,
      marketMood: 0,
      marketVolatility: 100,
      cash: 1000000,
      initialCash: 1000000,
      realizedProfit: 0,
      allowNegativeCash: false,
      allowShort: false,
      tradeFeePercent: 0,
      selectedCompanyId: '',
      positions: {},
      trades: [],
      companies: []
    };

    state.companies.push(makeCompany(state, {
      name: '青空技研', ticker: 'AOZR', price: 860, marketCap: 2400, per: 18.2,
      volatility: 32, drift: 9, sensitivity: 1.2, logicMode: 'linked'
    }));
    state.companies.push(makeCompany(state, {
      name: '北斗食品', ticker: 'HKTF', price: 1420, marketCap: 5100, per: 13.8,
      volatility: 18, drift: 3, sensitivity: 0.7, logicMode: 'free'
    }));
    state.companies.push(makeCompany(state, {
      name: '月光エナジー', ticker: 'GEKO', price: 390, marketCap: 880, per: 44.5,
      volatility: 58, drift: 15, sensitivity: 1.8, logicMode: 'free'
    }));
    state.selectedCompanyId = state.companies[0].id;

    for (let index = 0; index < 59; index += 1) {
      stepOneDay(state);
    }
    return state;
  }

  function currentCompany(state) {
    return state.companies.find((company) => company.id === state.selectedCompanyId) || state.companies[0] || null;
  }

  function stepCompany(state, company) {
    const previous = company.candles[company.candles.length - 1];
    const previousClose = previous ? previous.close : company.price;
    const annualVol = (company.volatility / 100) * (state.marketVolatility / 100);
    const dailyVol = annualVol / Math.sqrt(252);
    const dailyDrift = (company.drift / 100) / 252;
    const moodEffect = (state.marketMood / 100) * 0.0012;
    const noise = gaussian(state) * dailyVol;
    const rareShock = random01(state) < 0.012
      ? gaussian(state) * dailyVol * 3.5 * Math.max(0.25, company.sensitivity)
      : 0;
    const directedShock = clamp(company.pendingShock / 100, -0.95, 10) * company.sensitivity;
    company.pendingShock = 0;

    const gap = gaussian(state) * dailyVol * 0.18;
    const open = clamp(previousClose * Math.exp(gap), MIN_PRICE, MAX_PRICE);
    const rawReturn = dailyDrift + moodEffect + noise + rareShock + directedShock;
    const close = clamp(open * Math.exp(clamp(rawReturn, -3, 3)), MIN_PRICE, MAX_PRICE);
    const span = Math.max(Math.abs(close - open), open * dailyVol * (0.25 + random01(state) * 0.75));
    const high = clamp(Math.max(open, close) + span * (0.25 + random01(state)), MIN_PRICE, MAX_PRICE);
    const low = clamp(Math.min(open, close) - span * (0.25 + random01(state)), MIN_PRICE, MAX_PRICE);

    const safeHigh = Math.max(open, close, high);
    const safeLow = Math.max(MIN_PRICE, Math.min(open, close, low));

    company.price = close;
    company.lastChange = previousClose > 0 ? ((close / previousClose) - 1) * 100 : 0;

    if (company.logicMode === 'linked' && company.metricBasePrice > 0) {
      const ratio = close / company.metricBasePrice;
      company.marketCap = clamp(company.metricBaseMarketCap * ratio, 0, 1e12);
      company.per = clamp(company.metricBasePer * ratio, -10000, 10000);
    }

    company.candles.push({
      day: state.day,
      open,
      high: safeHigh,
      low: safeLow,
      close
    });
    if (company.candles.length > MAX_CANDLES) {
      company.candles.splice(0, company.candles.length - MAX_CANDLES);
    }
  }

  function stepOneDay(state) {
    state.day += 1;
    for (const company of state.companies) {
      stepCompany(state, company);
    }
  }

  function stepMarket(state, days) {
    const safeDays = clamp(Math.floor(finiteNumber(days, 1)), 1, 200);
    for (let index = 0; index < safeDays; index += 1) {
      stepOneDay(state);
    }
  }

  function injectShock(state, companyId, percent) {
    const company = state.companies.find((item) => item.id === companyId);
    if (!company) return false;
    const safePercent = clamp(finiteNumber(percent, 0), -95, 1000);
    company.pendingShock = clamp(company.pendingShock + safePercent, -95, 1000);
    return true;
  }

  function addCompany(state, input) {
    if (state.companies.length >= MAX_COMPANIES) {
      return { ok: false, message: '銘柄数の上限は' + MAX_COMPANIES + '社です。' };
    }
    const company = makeCompany(state, input);
    state.companies.push(company);
    state.selectedCompanyId = company.id;
    return { ok: true, company };
  }

  function updateCompany(state, companyId, input) {
    const company = state.companies.find((item) => item.id === companyId);
    if (!company) return { ok: false, message: '銘柄が見つかりません。' };
    const clean = normalizeCompanyInput(input);
    const last = company.candles[company.candles.length - 1];
    const oldPrice = company.price;

    company.name = clean.name;
    company.ticker = clean.ticker;
    company.price = clean.price;
    company.marketCap = clean.marketCap;
    company.per = clean.per;
    company.volatility = clean.volatility;
    company.drift = clean.drift;
    company.sensitivity = clean.sensitivity;
    company.logicMode = clean.logicMode;
    company.metricBasePrice = clean.price;
    company.metricBaseMarketCap = clean.marketCap;
    company.metricBasePer = clean.per;
    company.lastChange = oldPrice > 0 ? ((clean.price / oldPrice) - 1) * 100 : 0;

    if (last) {
      last.close = clean.price;
      last.high = Math.max(last.open, last.high, clean.price);
      last.low = Math.max(MIN_PRICE, Math.min(last.open, last.low, clean.price));
    }
    return { ok: true, company };
  }

  function removeCompany(state, companyId) {
    if (state.companies.length <= 1) {
      return { ok: false, message: '最低1社は残してください。' };
    }
    const position = state.positions[companyId];
    if (position && Math.abs(position.quantity) > 1e-9) {
      return { ok: false, message: '保有中の銘柄は削除できません。先に建玉を0にしてください。' };
    }
    const index = state.companies.findIndex((item) => item.id === companyId);
    if (index < 0) return { ok: false, message: '銘柄が見つかりません。' };
    state.companies.splice(index, 1);
    delete state.positions[companyId];
    state.selectedCompanyId = state.companies[Math.max(0, index - 1)].id;
    return { ok: true };
  }

  function ensurePosition(state, companyId) {
    if (!state.positions[companyId]) {
      state.positions[companyId] = { quantity: 0, averagePrice: 0 };
    }
    return state.positions[companyId];
  }

  function executeTrade(state, companyId, side, quantity) {
    const company = state.companies.find((item) => item.id === companyId);
    if (!company) return { ok: false, message: '銘柄が見つかりません。' };
    const qty = Math.floor(clamp(finiteNumber(quantity, 0), 0, MAX_TRADE_QUANTITY));
    if (qty <= 0) return { ok: false, message: '数量は1以上にしてください。' };
    if (side !== 'buy' && side !== 'sell') return { ok: false, message: '売買方向が不正です。' };

    const price = clamp(finiteNumber(company.price, MIN_PRICE), MIN_PRICE, MAX_PRICE);
    const feeRate = clamp(finiteNumber(state.tradeFeePercent, 0), 0, 10) / 100;
    const gross = price * qty;
    const fee = gross * feeRate;
    if (!Number.isFinite(gross) || !Number.isFinite(fee)) {
      return { ok: false, message: '取引金額が大きすぎます。' };
    }

    const position = ensurePosition(state, companyId);
    const oldQty = clamp(finiteNumber(position.quantity, 0), -MAX_POSITION, MAX_POSITION);
    const oldAverage = clamp(finiteNumber(position.averagePrice, 0), 0, MAX_PRICE);
    const delta = side === 'buy' ? qty : -qty;
    const newQty = oldQty + delta;
    if (!Number.isFinite(newQty) || Math.abs(newQty) > MAX_POSITION) {
      return { ok: false, message: '1銘柄の建玉上限は' + MAX_POSITION.toLocaleString('ja-JP') + '株です。' };
    }

    if (side === 'buy' && !state.allowNegativeCash && state.cash < gross + fee) {
      return { ok: false, message: '現金が不足しています。「現金マイナスを許可」を使うこともできます。' };
    }
    if (side === 'sell' && !state.allowShort && oldQty < qty) {
      return { ok: false, message: '保有数を超えて売るには「空売りを許可」を有効にしてください。' };
    }

    let realized = 0;
    let newAverage = oldAverage;
    if (oldQty === 0 || Math.sign(oldQty) === Math.sign(delta)) {
      const oldNotional = Math.abs(oldQty) * oldAverage;
      const addedNotional = Math.abs(delta) * price;
      newAverage = (oldNotional + addedNotional) / Math.max(1, Math.abs(newQty));
    } else {
      const closingQty = Math.min(Math.abs(oldQty), Math.abs(delta));
      if (oldQty > 0) {
        realized = (price - oldAverage) * closingQty;
      } else {
        realized = (oldAverage - price) * closingQty;
      }
      if (newQty === 0) {
        newAverage = 0;
      } else if (Math.sign(newQty) !== Math.sign(oldQty)) {
        newAverage = price;
      }
    }

    const cashDelta = side === 'buy' ? -(gross + fee) : (gross - fee);
    const nextCash = finiteNumber(state.cash, 0) + cashDelta;
    const nextRealized = finiteNumber(state.realizedProfit, 0) + realized - fee;
    if (!Number.isFinite(nextCash) || Math.abs(nextCash) > MAX_ACCOUNT_VALUE ||
        !Number.isFinite(nextRealized) || Math.abs(nextRealized) > MAX_ACCOUNT_VALUE) {
      return { ok: false, message: '口座数値が安全上限を超えるため、この取引は実行できません。' };
    }

    position.quantity = newQty;
    position.averagePrice = newAverage;
    state.cash = nextCash;
    state.realizedProfit = nextRealized;

    const trade = {
      id: newId(state, 'trade'),
      day: state.day,
      companyId,
      companyName: company.name,
      ticker: company.ticker,
      side,
      quantity: qty,
      price,
      fee,
      realized
    };
    state.trades.unshift(trade);
    if (state.trades.length > MAX_TRADES) state.trades.length = MAX_TRADES;

    return { ok: true, trade };
  }

  function portfolioValue(state) {
    let marketValue = 0;
    let unrealized = 0;
    for (const company of state.companies) {
      const position = state.positions[company.id];
      if (!position || !position.quantity) continue;
      marketValue += position.quantity * company.price;
      if (position.quantity > 0) {
        unrealized += (company.price - position.averagePrice) * position.quantity;
      } else {
        unrealized += (position.averagePrice - company.price) * Math.abs(position.quantity);
      }
    }
    const total = state.cash + marketValue;
    return {
      cash: state.cash,
      marketValue,
      total,
      profit: total - state.initialCash,
      realized: state.realizedProfit,
      unrealized
    };
  }

  function randomCompanyDraft(state) {
    const first = ['青空', '白銀', '紅葉', '星雲', '海風', '未来', '光輪', '北極', '南風', '水晶', '虹色', '大地'];
    const second = ['技研', '食品', '物流', 'エナジー', '製薬', 'ロボティクス', '商事', '電機', '交通', 'バイオ', '素材', '通信'];
    const name = first[Math.floor(random01(state) * first.length)] + second[Math.floor(random01(state) * second.length)];
    const ticker = 'F' + Math.floor(random01(state) * 9999).toString().padStart(4, '0');
    const price = Math.round((50 + random01(state) * 5000) * 100) / 100;
    return {
      name,
      ticker,
      price,
      marketCap: Math.round((50 + random01(state) * 30000) * 10) / 10,
      per: Math.round((-20 + random01(state) * 100) * 10) / 10,
      volatility: Math.round((8 + random01(state) * 90) * 10) / 10,
      drift: Math.round((-20 + random01(state) * 60) * 10) / 10,
      sensitivity: Math.round((0.3 + random01(state) * 2.7) * 10) / 10,
      logicMode: random01(state) > 0.5 ? 'linked' : 'free'
    };
  }

  root.Engine = {
    SCHEMA_VERSION,
    MAX_COMPANIES,
    MAX_CANDLES,
    MAX_TRADES,
    MAX_TRADE_QUANTITY,
    MAX_POSITION,
    MAX_ACCOUNT_VALUE,
    MIN_PRICE,
    MAX_PRICE,
    clamp,
    finiteNumber,
    createDefaultState,
    currentCompany,
    stepMarket,
    injectShock,
    addCompany,
    updateCompany,
    removeCompany,
    executeTrade,
    portfolioValue,
    randomCompanyDraft,
    normalizeCompanyInput
  };
}());