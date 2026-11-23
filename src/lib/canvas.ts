interface Point {
  x: number;
  y: number;
}

interface PadOptions {
  color?: string;
  width?: number;
}

/** Zeichenfläche mit Pointer-Events (Maus, Stift, Touch) und PNG-Export. */
export class WritingPad {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private strokes: Point[][] = [];
  private active: Point[] | null = null;
  private color: string;
  private width: number;
  private readonly logicalWidth = 760;
  private readonly logicalHeight = 220;

  constructor(canvas: HTMLCanvasElement, options: PadOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas wird von diesem Browser nicht unterstützt.');
    this.ctx = ctx;
    this.color = options.color ?? '#173b44';
    this.width = options.width ?? 3.5;
    this.setupCanvas();
    this.attachEvents();
  }

  setStyle(color: string, width: number): void {
    this.color = color;
    this.width = width;
  }

  clear(): void {
    this.strokes = [];
    this.active = null;
    this.redraw();
  }

  undo(): void {
    this.strokes.pop();
    this.redraw();
  }

  isEmpty(): boolean {
    return this.strokes.length === 0;
  }

  /** Exportiert nur den beschriebenen Bereich auf weißem Grund, um die API-Anfrage klein zu halten. */
  toPngDataUrl(): string | null {
    if (this.isEmpty()) return null;
    const points = this.strokes.flat();
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const pad = 22;
    const left = Math.max(0, Math.min(...xs) - this.width - pad);
    const top = Math.max(0, Math.min(...ys) - this.width - pad);
    const right = Math.min(this.logicalWidth, Math.max(...xs) + this.width + pad);
    const bottom = Math.min(this.logicalHeight, Math.max(...ys) + this.width + pad);
    const cropWidth = Math.max(60, right - left);
    const cropHeight = Math.max(40, bottom - top);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.min(900, Math.ceil(cropWidth));
    exportCanvas.height = Math.ceil(exportCanvas.width * (cropHeight / cropWidth));
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;
    const scale = exportCanvas.width / cropWidth;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cropWidth, cropHeight);
    ctx.translate(-left, -top);
    this.drawStrokes(ctx, this.strokes);
    return exportCanvas.toDataURL('image/png');
  }

  private setupCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.logicalWidth * dpr;
    this.canvas.height = this.logicalHeight * dpr;
    this.canvas.style.aspectRatio = `${this.logicalWidth} / ${this.logicalHeight}`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  private attachEvents(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) return;
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
      this.active = [this.toPoint(event)];
      this.strokes.push(this.active);
      this.redraw();
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.active || !event.isPrimary) return;
      event.preventDefault();
      this.active.push(this.toPoint(event));
      this.redraw();
    });

    const finish = () => {
      if (this.active && this.active.length === 1) {
        // Ein einzelner Punkt soll trotzdem sichtbar bleiben (z. B. ein Punkt bei „i“).
        this.active.push({ x: this.active[0].x + 0.1, y: this.active[0].y + 0.1 });
      }
      this.active = null;
      this.redraw();
    };
    this.canvas.addEventListener('pointerup', finish);
    this.canvas.addEventListener('pointercancel', finish);
  }

  private toPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.logicalWidth,
      y: ((event.clientY - rect.top) / rect.height) * this.logicalHeight,
    };
  }

  private redraw(): void {
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    this.drawStrokes(this.ctx, this.strokes);
  }

  private drawStrokes(ctx: CanvasRenderingContext2D, strokes: Point[][]): void {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let index = 1; index < stroke.length - 1; index += 1) {
        const midX = (stroke[index].x + stroke[index + 1].x) / 2;
        const midY = (stroke[index].y + stroke[index + 1].y) / 2;
        ctx.quadraticCurveTo(stroke[index].x, stroke[index].y, midX, midY);
      }
      const last = stroke[stroke.length - 1];
      ctx.lineTo(last.x, last.y);
      if (stroke.length === 1) ctx.lineTo(last.x + 0.1, last.y + 0.1);
      ctx.stroke();
    }
    ctx.restore();
  }
}
