// Handschrift-Feld: Pointer Events, Palm-Rejection, glatte Linien, Rückgängig.
// Koordinaten werden normalisiert gespeichert, damit Layout-Wechsel nichts verwischt.

const GUIDE_ALPHA = 0.35;

export class HandwritingPad {
  constructor(canvas, { onChange } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: false });
    this.onChange = onChange || (() => {});
    this.strokes = [];
    this.current = null;
    this.activePointerId = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._resize = this._resize.bind(this);

    canvas.addEventListener("pointerdown", this._onDown);
    canvas.addEventListener("pointermove", this._onMove);
    canvas.addEventListener("pointerup", this._onUp);
    canvas.addEventListener("pointercancel", this._onUp);
    canvas.addEventListener("pointerleave", this._onUp);
    window.addEventListener("resize", this._resize);
    this._resize();
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this._onDown);
    this.canvas.removeEventListener("pointermove", this._onMove);
    this.canvas.removeEventListener("pointerup", this._onUp);
    this.canvas.removeEventListener("pointercancel", this._onUp);
    this.canvas.removeEventListener("pointerleave", this._onUp);
    window.removeEventListener("resize", this._resize);
  }

  get hasInk() {
    return this.strokes.length > 0;
  }

  get colors() {
    const style = getComputedStyle(document.body);
    return {
      ink: style.getPropertyValue("--ink").trim() || "#1d2b2a",
      line: style.getPropertyValue("--accent").trim() || "#146c62",
    };
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.redraw();
  }

  _point(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  _isPalm(event) {
    if (!event.isPrimary || this.activePointerId !== null) return true;
    if (event.pointerType === "mouse" && event.button !== 0) return true;
    // Ein breiter Fingerkontakt ist meist die Handfläche, nicht die Stiftspitze.
    if (event.pointerType === "touch" && (event.width > 34 || event.height > 34)) return true;
    return false;
  }

  _onDown(event) {
    if (this._isPalm(event)) return;
    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.current = [this._point(event)];
  }

  _onMove(event) {
    if (event.pointerId !== this.activePointerId || !this.current) return;
    event.preventDefault();
    const point = this._point(event);
    const last = this.current[this.current.length - 1];
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    if (distance > 0.002) this.current.push(point);
    this.redraw();
  }

  _onUp(event) {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    if (this.current?.length) {
      if (this.current.length === 1) {
        const p = this.current[0];
        this.current.push({ x: p.x + 0.0005, y: p.y + 0.0005 });
      }
      this.strokes.push(this.current);
    }
    this.current = null;
    this.activePointerId = null;
    this.redraw();
    this.onChange(this.hasInk);
  }

  undo() {
    this.strokes.pop();
    this.redraw();
    this.onChange(this.hasInk);
  }

  clear() {
    this.strokes = [];
    this.current = null;
    this.activePointerId = null;
    this.redraw();
    this.onChange(false);
  }

  _drawGuides(ctx, width, height) {
    const { line } = this.colors;
    ctx.save();
    ctx.globalAlpha = GUIDE_ALPHA;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 7]);
    for (const fraction of [0.28, 0.6, 0.85]) {
      const y = Math.round(height * fraction) + 0.5;
      ctx.beginPath();
      ctx.moveTo(width * 0.06, y);
      ctx.lineTo(width * 0.94, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawStroke(ctx, stroke, width, height, ink) {
    if (stroke.length < 2) return;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(2.6, Math.min(width, height) * 0.011);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke[0].x * width, stroke[0].y * height);
    if (stroke.length === 2) {
      ctx.lineTo(stroke[1].x * width, stroke[1].y * height);
    } else {
      for (let i = 1; i < stroke.length - 1; i += 1) {
        const current = stroke[i];
        const next = stroke[i + 1];
        const midX = ((current.x + next.x) / 2) * width;
        const midY = ((current.y + next.y) / 2) * height;
        ctx.quadraticCurveTo(current.x * width, current.y * height, midX, midY);
      }
      const last = stroke[stroke.length - 1];
      ctx.lineTo(last.x * width, last.y * height);
    }
    ctx.stroke();
  }

  redraw() {
    if (!this.width || !this.height) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this._drawGuides(ctx, this.width, this.height);
    const { ink } = this.colors;
    for (const stroke of this.strokes) this._drawStroke(ctx, stroke, this.width, this.height, ink);
    if (this.current) this._drawStroke(ctx, this.current, this.width, this.height, ink);
  }

  /**
   * Erzeugt ein zugeschnittenes PNG auf weißem Hintergrund (ohne Hilfslinien).
   * Rückgabe: Base64 ohne Data-URL-Präfix – passt direkt in die Gemini-API.
   */
  toPNG() {
    const all = this.current ? [...this.strokes, this.current] : this.strokes;
    if (!all.length) return null;

    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    for (const stroke of all) {
      for (const point of stroke) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
    const padX = 0.02;
    const padY = 0.035;
    minX = Math.max(0, minX - padX);
    minY = Math.max(0, minY - padY);
    maxX = Math.min(1, maxX + padX);
    maxY = Math.min(1, maxY + padY);
    const srcW = Math.max(0.01, (maxX - minX) * this.width);
    const srcH = Math.max(0.01, (maxY - minY) * this.height);
    const scale = Math.min(1, 1100 / srcW, 1100 / srcH);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(srcW * scale));
    out.height = Math.max(1, Math.round(srcH * scale));
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-minX * this.width, -minY * this.height);
    const { ink } = this.colors;
    for (const stroke of all) this._drawStroke(ctx, stroke, this.width, this.height, ink);
    ctx.restore();
    return out.toDataURL("image/png").split(",")[1] || null;
  }
}
