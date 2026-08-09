(function () {
  'use strict';

  const root = window.StockSandbox;
  const engine = root.Engine;
  const storage = root.Storage;
  if (!engine || !storage || !root.Chart) return;

  const $ = (id) => document.getElementById(id);
  const elements = {
    saveStatus: $('save-status'), dayLabel: $('day-label'), step1: $('step-1'), step5: $('step-5'), step20: $('step-20'),
    togglePlay: $('toggle-play'), playSpeed: $('play-speed'), marketMood: $('market-mood'), moodValue: $('mood-value'),
    marketVolatility: $('market-volatility'), marketVolatilityValue: $('market-volatility-value'), customShock: $('custom-shock'),
    applyShock: $('apply-shock'), chartOlder: $('chart-older'), chartNewer: $('chart-newer'), chartZoomIn: $('chart-zoom-in'),
    chartZoomOut: $('chart-zoom-out'), chartReset: $('chart-reset'), selectedName: $('selected-name'), selectedTicker: $('selected-ticker'),
    currentPrice: $('current-price'), priceChange: $('price-change'), ohlcOpen: $('ohlc-open'), ohlcHigh: $('ohlc-high'),
    ohlcLow: $('ohlc-low'), ohlcClose: $('ohlc-close'), metricMarketCap: $('metric-market-cap'), metricPer: $('metric-per'),
    metricVolatility: $('metric-volatility'), metricDrift: $('metric-drift'), portfolioTotal: $('portfolio-total'),
    portfolioCash: $('portfolio-cash'), positionQty: $('position-qty'), portfolioProfit: $('portfolio-profit'),
    tradeQuantity: $('trade-quantity'), buyButton: $('buy-button'), sellButton: $('sell-button'), allowNegativeCash: $('allow-negative-cash'),
    allowShort: $('allow-short'), tradeFee: $('trade-fee'), tradeMessage: $('trade-message'), tradeLog: $('trade-log'),
    companySelect: $('company-select'), companyName: $('company-name'), companyTicker: $('company-ticker'), companyPrice: $('company-price'),
    companyMarketCap: $('company-market-cap'), companyPer: $('company-per'), companyVolatility: $('company-volatility'), companyDrift: $('company-drift'),
    companySensitivity: $('company-sensitivity'), companyLogicMode: $('company-logic-mode'), updateCompany: $('update-company'),
    addCompany: $('add-company'), randomCompany: $('random-company'), deleteCompany: $('delete-company'), companyMessage: $('company-message'),
    exportData: $('export-data'), importData: $('import-data'), newWorld: $('new-world'), resetData: $('reset-data'), dataMessage: $('data-message')
  };

  let state;
  let playTimer = null;
  let saveTimer = null;
  const chart = new root.Chart.CandlestickChart($('market-chart'));

  function formatMoney(value) {
    if (!Number.isFinite(value)) return '-';
    if (Math.abs(value) >= 1e15) return '¥' + value.toExponential(3);
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency', currency: 'JPY', maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0
    }).format(value);
  }

  function formatNumber(value, digits) {
    if (!Number.isFinite(value)) return '-';
    if (Math.abs(value) >= 1e12) return value.toExponential(3);
    return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
  }

  function setSignedClass(element, value) {
    element.classList.remove('positive', 'negative');
    if (value > 0) element.classList.add('positive');
    if (value < 0) element.classList.add('negative');
  }

  function currentCompany() { return engine.currentCompany(state); }

  function currentPosition() {
    const company = currentCompany();
    if (!company) return { quantity: 0, averagePrice: 0 };
    return state.positions[company.id] || { quantity: 0, averagePrice: 0 };
  }

  function announce(element, message, isWarning) {
    element.textContent = message;
    element.classList.toggle('warning', Boolean(isWarning));
  }

  function persistNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!state) return;
    const result = storage.saveState(state);
    elements.saveStatus.textContent = result.ok ? '端末内に保存済み' : '保存できません';
    if (!result.ok) announce(elements.dataMessage, result.message || '保存できませんでした。', true);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    elements.saveStatus.textContent = '保存待ち';
    saveTimer = setTimeout(persistNow, 1000);
  }

  function renderCompanySelect() {
    const fragment = document.createDocumentFragment();
    for (const company of state.companies) {
      fragment.appendChild(new Option(company.name + ' (' + company.ticker + ')', company.id));
    }
    elements.companySelect.replaceChildren(fragment);
    elements.companySelect.value = state.selectedCompanyId;
  }

  function renderCompanyEditor() {
    const company = currentCompany();
    if (!company) return;
    elements.companyName.value = company.name;
    elements.companyTicker.value = company.ticker;
    elements.companyPrice.value = String(company.price);
    elements.companyMarketCap.value = String(company.marketCap);
    elements.companyPer.value = String(company.per);
    elements.companyVolatility.value = String(company.volatility);
    elements.companyDrift.value = String(company.drift);
    elements.companySensitivity.value = String(company.sensitivity);
    elements.companyLogicMode.value = company.logicMode;
  }

  function renderTradeLog() {
    const fragment = document.createDocumentFragment();
    const recent = state.trades.slice(0, 20);
    for (const trade of recent) {
      const item = document.createElement('li');
      const side = trade.side === 'buy' ? '買い' : '売り';
      item.textContent = 'D' + trade.day + ' ' + trade.companyName + ' ' + side + ' ' + formatNumber(trade.quantity, 0) + '株 @ ' + formatMoney(trade.price);
      fragment.appendChild(item);
    }
    if (!recent.length) {
      const item = document.createElement('li');
      item.textContent = 'まだ取引はありません。';
      fragment.appendChild(item);
    }
    elements.tradeLog.replaceChildren(fragment);
  }

  function renderChartAndMetrics() {
    const company = currentCompany();
    if (!company) return;
    const last = company.candles[company.candles.length - 1];
    const companyTrades = state.trades.filter((trade) => trade.companyId === company.id);
    elements.selectedName.textContent = company.name;
    elements.selectedTicker.textContent = company.ticker;
    elements.currentPrice.textContent = formatMoney(company.price);
    elements.priceChange.textContent = (company.lastChange >= 0 ? '+' : '') + formatNumber(company.lastChange, 2) + '%';
    setSignedClass(elements.priceChange, company.lastChange);
    if (last) {
      elements.ohlcOpen.textContent = formatMoney(last.open); elements.ohlcHigh.textContent = formatMoney(last.high);
      elements.ohlcLow.textContent = formatMoney(last.low); elements.ohlcClose.textContent = formatMoney(last.close);
    }
    elements.metricMarketCap.textContent = formatNumber(company.marketCap, 1) + ' 億円';
    elements.metricPer.textContent = formatNumber(company.per, 1) + ' 倍';
    elements.metricVolatility.textContent = formatNumber(company.volatility, 1) + '%';
    elements.metricDrift.textContent = (company.drift >= 0 ? '+' : '') + formatNumber(company.drift, 1) + '%';
    chart.setData(company.candles, companyTrades);
  }

  function renderPortfolio() {
    const portfolio = engine.portfolioValue(state);
    const position = currentPosition();
    elements.portfolioTotal.textContent = formatMoney(portfolio.total);
    elements.portfolioCash.textContent = formatMoney(portfolio.cash);
    elements.positionQty.textContent = formatNumber(position.quantity, 0);
    elements.portfolioProfit.textContent = formatMoney(portfolio.profit);
    setSignedClass(elements.portfolioProfit, portfolio.profit);
  }

  function renderSettings() {
    elements.dayLabel.textContent = 'Day ' + state.day;
    elements.marketMood.value = String(state.marketMood); elements.moodValue.textContent = String(Math.round(state.marketMood));
    elements.marketVolatility.value = String(state.marketVolatility); elements.marketVolatilityValue.textContent = String(Math.round(state.marketVolatility));
    elements.allowNegativeCash.checked = state.allowNegativeCash; elements.allowShort.checked = state.allowShort;
    elements.tradeFee.value = String(state.tradeFeePercent); elements.deleteCompany.disabled = state.companies.length <= 1;
  }

  function renderAll(options) {
    const settings = options || {};
    renderCompanySelect();
    if (settings.editor !== false) renderCompanyEditor();
    renderChartAndMetrics(); renderPortfolio(); renderSettings(); renderTradeLog();
  }

  function companyFormValue() {
    return {
      name: elements.companyName.value, ticker: elements.companyTicker.value, price: Number(elements.companyPrice.value),
      marketCap: Number(elements.companyMarketCap.value), per: Number(elements.companyPer.value),
      volatility: Number(elements.companyVolatility.value), drift: Number(elements.companyDrift.value),
      sensitivity: Number(elements.companySensitivity.value), logicMode: elements.companyLogicMode.value
    };
  }

  function advance(days) { engine.stepMarket(state, days); renderAll({ editor: false }); scheduleSave(); }

  function setPlaying(enabled) {
    clearInterval(playTimer); playTimer = null;
    elements.togglePlay.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    elements.togglePlay.textContent = enabled ? '停止' : '自動再生';
    if (!enabled) return;
    playTimer = setInterval(() => advance(1), Number(elements.playSpeed.value) || 650);
  }

  function applyTrade(side) {
    state.allowNegativeCash = elements.allowNegativeCash.checked; state.allowShort = elements.allowShort.checked;
    state.tradeFeePercent = engine.clamp(Number(elements.tradeFee.value) || 0, 0, 10);
    const company = currentCompany();
    const result = engine.executeTrade(state, company.id, side, elements.tradeQuantity.value);
    if (!result.ok) { announce(elements.tradeMessage, result.message, true); return; }
    const label = side === 'buy' ? '買い' : '売り';
    announce(elements.tradeMessage, label + 'を架空約定しました。' + formatNumber(result.trade.quantity, 0) + '株 @ ' + formatMoney(result.trade.price), false);
    renderAll({ editor: false }); scheduleSave();
  }

  function applyRandomDraft() {
    const draft = engine.randomCompanyDraft(state);
    elements.companyName.value = draft.name; elements.companyTicker.value = draft.ticker; elements.companyPrice.value = String(draft.price);
    elements.companyMarketCap.value = String(draft.marketCap); elements.companyPer.value = String(draft.per);
    elements.companyVolatility.value = String(draft.volatility); elements.companyDrift.value = String(draft.drift);
    elements.companySensitivity.value = String(draft.sensitivity); elements.companyLogicMode.value = draft.logicMode;
    announce(elements.companyMessage, '入力欄へ架空企業案を作りました。まだ市場には追加していません。', false);
  }

  function createFreshState() { setPlaying(false); state = engine.createDefaultState(); renderAll(); scheduleSave(); }

  elements.step1.addEventListener('click', () => advance(1));
  elements.step5.addEventListener('click', () => advance(5));
  elements.step20.addEventListener('click', () => advance(20));
  elements.togglePlay.addEventListener('click', () => { const next = !playTimer; setPlaying(next); if (!next) persistNow(); });
  elements.playSpeed.addEventListener('change', () => { if (playTimer) setPlaying(true); });
  elements.chartOlder.addEventListener('click', () => chart.panBy(20));
  elements.chartNewer.addEventListener('click', () => chart.panBy(-20));
  elements.chartZoomIn.addEventListener('click', () => chart.zoomBy(0.8));
  elements.chartZoomOut.addEventListener('click', () => chart.zoomBy(1.25));
  elements.chartReset.addEventListener('click', () => chart.resetView());

  elements.marketMood.addEventListener('input', () => {
    state.marketMood = engine.clamp(Number(elements.marketMood.value) || 0, -100, 100);
    elements.moodValue.textContent = String(Math.round(state.marketMood)); scheduleSave();
  });
  elements.marketVolatility.addEventListener('input', () => {
    state.marketVolatility = engine.clamp(Number(elements.marketVolatility.value) || 100, 10, 300);
    elements.marketVolatilityValue.textContent = String(Math.round(state.marketVolatility)); scheduleSave();
  });

  document.querySelectorAll('.event-button').forEach((button) => {
    button.addEventListener('click', () => {
      const company = currentCompany(); const shock = Number(button.dataset.shock) || 0;
      engine.injectShock(state, company.id, shock);
      announce(elements.tradeMessage, company.name + 'へ' + (shock >= 0 ? '+' : '') + shock + '%の材料を予約しました。次の日に反映します。', false);
      scheduleSave();
    });
  });

  elements.applyShock.addEventListener('click', () => {
    const company = currentCompany(); const shock = engine.clamp(Number(elements.customShock.value) || 0, -95, 1000);
    engine.injectShock(state, company.id, shock);
    announce(elements.tradeMessage, company.name + 'へ' + (shock >= 0 ? '+' : '') + formatNumber(shock, 1) + '%の材料を予約しました。', false); scheduleSave();
  });

  elements.buyButton.addEventListener('click', () => applyTrade('buy'));
  elements.sellButton.addEventListener('click', () => applyTrade('sell'));
  elements.allowNegativeCash.addEventListener('change', () => { state.allowNegativeCash = elements.allowNegativeCash.checked; scheduleSave(); });
  elements.allowShort.addEventListener('change', () => { state.allowShort = elements.allowShort.checked; scheduleSave(); });
  elements.tradeFee.addEventListener('change', () => {
    state.tradeFeePercent = engine.clamp(Number(elements.tradeFee.value) || 0, 0, 10); elements.tradeFee.value = String(state.tradeFeePercent); scheduleSave();
  });
  elements.companySelect.addEventListener('change', () => { state.selectedCompanyId = elements.companySelect.value; chart.resetView(); renderAll(); scheduleSave(); });

  elements.updateCompany.addEventListener('click', () => {
    const company = currentCompany(); const result = engine.updateCompany(state, company.id, companyFormValue());
    if (!result.ok) { announce(elements.companyMessage, result.message, true); return; }
    announce(elements.companyMessage, '現在の架空銘柄へ反映しました。', false); renderAll(); scheduleSave();
  });

  elements.addCompany.addEventListener('click', () => {
    const result = engine.addCompany(state, companyFormValue());
    if (!result.ok) { announce(elements.companyMessage, result.message, true); return; }
    chart.resetView();
    announce(elements.companyMessage, result.company.name + 'を市場へ追加しました。', false); renderAll(); scheduleSave();
  });

  elements.randomCompany.addEventListener('click', applyRandomDraft);
  elements.deleteCompany.addEventListener('click', () => {
    const company = currentCompany(); if (!company) return;
    if (!window.confirm(company.name + 'をこの架空市場から削除しますか。')) return;
    const result = engine.removeCompany(state, company.id);
    if (!result.ok) { announce(elements.companyMessage, result.message, true); return; }
    chart.resetView();
    announce(elements.companyMessage, '銘柄を削除しました。', false); renderAll(); scheduleSave();
  });

  elements.exportData.addEventListener('click', () => {
    try { storage.exportState(state); announce(elements.dataMessage, 'JSONを書き出しました。端末側のダウンロード先を確認してください。', false); }
    catch (error) { announce(elements.dataMessage, error instanceof Error ? error.message : '書き出せませんでした。', true); }
  });

  elements.importData.addEventListener('change', async () => {
    const file = elements.importData.files && elements.importData.files[0]; if (!file) return;
    try {
      const imported = await storage.importFile(file); setPlaying(false); state = imported; chart.resetView(); renderAll(); scheduleSave();
      announce(elements.dataMessage, '検証済みJSONを読み込みました。', false);
    } catch (error) {
      announce(elements.dataMessage, error instanceof Error ? error.message : 'JSONを読み込めませんでした。', true);
    } finally { elements.importData.value = ''; }
  });

  elements.newWorld.addEventListener('click', () => {
    if (!window.confirm('現在の世界を置き換えます。先にJSONを書き出すと後から戻せます。続けますか。')) return;
    createFreshState(); announce(elements.dataMessage, '新しい乱数シードで世界を作りました。', false);
  });

  elements.resetData.addEventListener('click', () => {
    if (!window.confirm('このブラウザー内の保存データを削除して初期状態へ戻しますか。')) return;
    storage.clearState(); createFreshState(); announce(elements.dataMessage, '端末内データを初期化しました。', false);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (playTimer) {
        setPlaying(false);
        announce(elements.tradeMessage, '省電力のため、画面が非表示になったので自動再生を停止しました。', false);
      }
      persistNow();
    }
  });
  window.addEventListener('pagehide', persistNow);

  const loaded = storage.loadState();
  if (loaded.ok) state = loaded.state;
  else {
    state = engine.createDefaultState();
    if (loaded.message) announce(elements.dataMessage, loaded.message + ' 初期状態を作りました。', true);
  }
  renderAll(); scheduleSave();
}());