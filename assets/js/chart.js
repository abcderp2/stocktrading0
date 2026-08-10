(function () {
  'use strict';

  const root = window.StockSandbox = window.StockSandbox || {};
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function cssColor(name, fallback) { const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return value || fallback; }
  function priceText(value) {
    if (!Number.isFinite(value)) return '-';
    if (Math.abs(value) >= 1e9) return value.toExponential(2);
    if (Math.abs(value) >= 10000) return Math.round(value).toLocaleString('ja-JP');
    if (Math.abs(value) >= 100) return value.toFixed(1);
    return value.toFixed(2);
  }
  function shortDate(value) {
    if (typeof value !== 'string') return '';
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    return Number(parts[1]) + '/' + Number(parts[2]);
  }

  class CandlestickChart {
    constructor(canvas, options) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.data = []; this.trades = [];
      this.visibleCount = 70; this.offsetFromEnd = 0; this.activePointers = new Map(); this.pointerStartX = null; this.pointerStartOffset = 0;
      this.pointerMoved = false; this.lastPinchDistance = null; this.frame = 0; this.selectedIndex = -1;
      this.onSelect = options && typeof options.onSelect === 'function' ? options.onSelect : null;
      if (typeof ResizeObserver === 'function') { this.resizeObserver = new ResizeObserver(() => this.requestDraw()); this.resizeObserver.observe(canvas); }
      else window.addEventListener('resize', () => this.requestDraw(), { passive: true });
      this.bindEvents();
    }
    bindEvents() {
      this.canvas.addEventListener('wheel', (event) => { event.preventDefault(); this.zoomBy(Math.sign(event.deltaY) > 0 ? 1.15 : 0.87); }, { passive: false });
      this.canvas.addEventListener('pointerdown', (event) => {
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); this.canvas.setPointerCapture(event.pointerId); this.pointerMoved = false;
        if (this.activePointers.size === 1) { this.pointerStartX = event.clientX; this.pointerStartOffset = this.offsetFromEnd; }
        if (this.activePointers.size === 2) this.lastPinchDistance = this.currentPinchDistance();
      });
      this.canvas.addEventListener('pointermove', (event) => {
        if (!this.activePointers.has(event.pointerId)) return;
        const previous = this.activePointers.get(event.pointerId); if (Math.abs(event.clientX - previous.x) > 3 || Math.abs(event.clientY - previous.y) > 3) this.pointerMoved = true;
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.activePointers.size >= 2) {
          const distance = this.currentPinchDistance(); if (this.lastPinchDistance && distance > 0) this.zoomBy(this.lastPinchDistance / distance); this.lastPinchDistance = distance; return;
        }
        if (this.pointerStartX === null) return;
        const width = Math.max(1, this.canvas.getBoundingClientRect().width); const pixelsPerCandle = width / Math.max(1, this.visibleCount);
        const deltaCandles = Math.round((this.pointerStartX - event.clientX) / Math.max(3, pixelsPerCandle));
        this.offsetFromEnd = clamp(this.pointerStartOffset + deltaCandles, 0, Math.max(0, this.data.length - this.visibleCount)); this.requestDraw();
      });
      const end = (event) => {
        const wasSingle = this.activePointers.size === 1; this.activePointers.delete(event.pointerId);
        if (wasSingle && !this.pointerMoved) this.selectAtClientX(event.clientX);
        if (this.activePointers.size < 2) this.lastPinchDistance = null; if (this.activePointers.size === 0) this.pointerStartX = null;
      };
      this.canvas.addEventListener('pointerup', end); this.canvas.addEventListener('pointercancel', end);
      this.canvas.addEventListener('dblclick', () => this.resetView());
    }
    currentPinchDistance() {
      const points = Array.from(this.activePointers.values()); if (points.length < 2) return 0;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }
    visibleSlice() {
      const count = Math.min(this.visibleCount, this.data.length); const end = Math.max(count, this.data.length - this.offsetFromEnd); const start = Math.max(0, end - count);
      return { start, end, items: this.data.slice(start, end) };
    }
    selectAtClientX(clientX) {
      if (!this.data.length) return;
      const rect = this.canvas.getBoundingClientRect(); const { start, items } = this.visibleSlice(); if (!items.length) return;
      const plotLeft = 58; const plotRight = 14; const plotWidth = Math.max(1, rect.width - plotLeft - plotRight); const x = clamp(clientX - rect.left - plotLeft, 0, plotWidth - 1);
      const indexInVisible = clamp(Math.floor(x / (plotWidth / items.length)), 0, items.length - 1); this.selectedIndex = start + indexInVisible;
      if (this.onSelect) this.onSelect(this.data[this.selectedIndex]); this.requestDraw();
    }
    setData(candles, trades) {
      this.data = Array.isArray(candles) ? candles : []; this.trades = Array.isArray(trades) ? trades : [];
      this.offsetFromEnd = clamp(this.offsetFromEnd, 0, Math.max(0, this.data.length - this.visibleCount));
      if (this.selectedIndex >= this.data.length) this.selectedIndex = this.data.length - 1; this.requestDraw();
    }
    selectLatest() {
      if (!this.data.length) return; this.selectedIndex = this.data.length - 1; if (this.onSelect) this.onSelect(this.data[this.selectedIndex]); this.requestDraw();
    }
    panBy(candles) { this.offsetFromEnd = clamp(this.offsetFromEnd + Math.round(Number(candles) || 0), 0, Math.max(0, this.data.length - this.visibleCount)); this.requestDraw(); }
    zoomBy(factor) {
      const safeFactor = clamp(Number(factor) || 1, 0.5, 2); this.visibleCount = clamp(Math.round(this.visibleCount * safeFactor), 12, 260);
      this.offsetFromEnd = clamp(this.offsetFromEnd, 0, Math.max(0, this.data.length - this.visibleCount)); this.requestDraw();
    }
    resetView() { this.offsetFromEnd = 0; this.visibleCount = clamp(this.data.length || 70, 40, 90); this.selectLatest(); this.requestDraw(); }
    requestDraw() { cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(() => this.draw()); }
    resizeCanvas() {
      const rect = this.canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(280, Math.round(rect.width * dpr)); const height = Math.max(240, Math.round(rect.height * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { width: rect.width, height: rect.height };
    }
    draw() {
      const { width, height } = this.resizeCanvas(); const ctx = this.ctx;
      const panel = cssColor('--panel-soft', '#f8fafc'); const text = cssColor('--text', '#111827'); const muted = cssColor('--muted', '#64748b'); const border = cssColor('--border', '#d1d5db');
      const positive = cssColor('--positive', '#047857'); const negative = cssColor('--negative', '#b91c1c'); const accent = cssColor('--accent', '#0f766e');
      ctx.clearRect(0, 0, width, height); ctx.fillStyle = panel; ctx.fillRect(0, 0, width, height);
      if (!this.data.length) { ctx.fillStyle = muted; ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('チャートデータがありません', width / 2, height / 2); return; }
      const { start, items: visible } = this.visibleSlice(); const plot = { left: 58, right: 14, top: 18, bottom: 38 };
      const plotWidth = Math.max(1, width - plot.left - plot.right); const plotHeight = Math.max(1, height - plot.top - plot.bottom);
      let low = Infinity; let high = -Infinity;
      for (const candle of visible) { if (Number.isFinite(candle.low)) low = Math.min(low, candle.low); if (Number.isFinite(candle.high)) high = Math.max(high, candle.high); }
      if (!Number.isFinite(low) || !Number.isFinite(high)) return;
      if (high <= low) { high += Math.max(1, high * 0.01); low = Math.max(0, low - Math.max(1, low * 0.01)); }
      const padding = (high - low) * 0.08; high += padding; low = Math.max(0, low - padding); const range = Math.max(1e-9, high - low);
      const xStep = plotWidth / visible.length; const bodyWidth = clamp(xStep * 0.62, 1.5, 13); const y = (price) => plot.top + ((high - price) / range) * plotHeight;
      ctx.lineWidth = 1; ctx.strokeStyle = border; ctx.fillStyle = muted; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let index = 0; index <= 4; index += 1) {
        const price = high - range * index / 4; const py = plot.top + plotHeight * index / 4;
        ctx.beginPath(); ctx.moveTo(plot.left, py); ctx.lineTo(width - plot.right, py); ctx.globalAlpha = 0.45; ctx.stroke(); ctx.globalAlpha = 1; ctx.fillText(priceText(price), plot.left - 6, py);
      }
      for (let index = 0; index < visible.length; index += 1) {
        const candle = visible[index]; const cx = plot.left + xStep * index + xStep / 2; const openY = y(candle.open); const closeY = y(candle.close); const highY = y(candle.high); const lowY = y(candle.low);
        const up = candle.close >= candle.open; ctx.strokeStyle = up ? positive : negative; ctx.fillStyle = up ? positive : negative;
        ctx.beginPath(); ctx.moveTo(cx, highY); ctx.lineTo(cx, lowY); ctx.stroke(); ctx.fillRect(cx - bodyWidth / 2, Math.min(openY, closeY), bodyWidth, Math.max(1, Math.abs(closeY - openY)));
        if (start + index === this.selectedIndex) { ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.strokeRect(cx - Math.max(bodyWidth / 2 + 4, 5), plot.top, Math.max(bodyWidth + 8, 10), plotHeight); ctx.lineWidth = 1; }
      }
      ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; const labelSlots = Math.min(5, visible.length);
      for (let index = 0; index < labelSlots; index += 1) {
        const dataIndex = Math.round(index * (visible.length - 1) / Math.max(1, labelSlots - 1)); const candle = visible[dataIndex]; const cx = plot.left + xStep * dataIndex + xStep / 2;
        ctx.fillText(shortDate(candle.endDate || candle.date), cx, height - plot.bottom + 10);
      }
      const tradeDates = new Set(this.trades.map((trade) => trade.date));
      visible.forEach((candle, index) => {
        const date = candle.endDate || candle.date; if (!tradeDates.has(date)) return; const cx = plot.left + xStep * index + xStep / 2; ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(cx, y(candle.close), 3.5, 0, Math.PI * 2); ctx.fill();
      });
      const last = visible[visible.length - 1]; if (last) { const py = y(last.close); ctx.strokeStyle = text; ctx.globalAlpha = 0.55; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(plot.left, py); ctx.lineTo(width - plot.right, py); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    }
  }
  root.Chart = { CandlestickChart };
}());
