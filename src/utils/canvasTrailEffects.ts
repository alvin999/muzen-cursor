import { CursorRect } from '../core/cursorStore';

export interface TrailColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

export interface CanvasTrailConfig {
  laserDurationMs?: number;
  laserWidth?: number;
  sparkleDensity?: number;
  ribbonDurationMs?: number;
}

interface LaserBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  age: number;
  maxAge: number;
  width: number;
  color: TrailColor;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  age: number;
  maxAge: number;
  color: TrailColor;
}

interface RibbonNode {
  topX: number;
  topY: number;
  botX: number;
  botY: number;
  age: number;
  color: TrailColor;
}

/**
 * Canvas 殘影特效引擎：負責繪製 雷射軌跡 (laser)、星塵粒子 (sparkle) 與 速度線 (ribbon)
 */
export class CanvasTrailEffects {
  private beams: LaserBeam[] = [];
  private particles: SparkleParticle[] = [];
  private ribbonNodes: RibbonNode[] = [];

  private readonly MAX_BEAMS = 12;
  private readonly MAX_PARTICLES = 120;
  private readonly MAX_RIBBON_NODES = 16;
  private ribbonMaxAgeMs = 220;

  public spawn(
    mode: 'laser' | 'sparkle' | 'ribbon',
    origin: CursorRect,
    target: CursorRect,
    color: TrailColor,
    charge: number,
    config?: CanvasTrailConfig
  ): void {
    const ox = origin.x + origin.width / 2;
    const oy = origin.y + origin.height / 2;
    const tx = target.x + target.width / 2;
    const ty = target.y + target.height / 2;
    const dist = Math.hypot(tx - ox, ty - oy);

    if (dist < 2) return;

    if (mode === 'laser') {
      const baseDur = typeof config?.laserDurationMs === 'number' ? config.laserDurationMs : 220;
      const baseWidth = typeof config?.laserWidth === 'number' ? config.laserWidth : 2.2;
      if (this.beams.length >= this.MAX_BEAMS) this.beams.shift();
      this.beams.push({
        x1: ox,
        y1: oy,
        x2: tx,
        y2: ty,
        age: 0,
        maxAge: baseDur + Math.round(charge * 100),
        width: Math.max(1.0, Math.min(8.0, baseWidth + charge * 2.0)),
        color
      });
      return;
    }

    if (mode === 'sparkle') {
      const density = typeof config?.sparkleDensity === 'number' ? config.sparkleDensity : 1.0;
      const rawCount = (Math.round(dist / 22) + 5 + Math.round(charge * 8)) * density;
      const count = Math.min(36, Math.max(3, Math.round(rawCount)));
      for (let i = 0; i < count; i++) {
        if (this.particles.length >= this.MAX_PARTICLES) this.particles.shift();
        const t = Math.random();
        const jitter = (Math.random() - 0.5) * Math.min(origin.height * 0.7, 14);
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.02 + Math.random() * (0.06 + charge * 0.05);
        this.particles.push({
          x: ox + (tx - ox) * t + (Math.random() - 0.5) * 6,
          y: oy + (ty - oy) * t + jitter,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.015,
          size: 1.8 + Math.random() * 2.2,
          age: 0,
          maxAge: 260 + Math.random() * 180,
          color
        });
      }
      return;
    }

    if (mode === 'ribbon') {
      if (typeof config?.ribbonDurationMs === 'number') {
        this.ribbonMaxAgeMs = Math.max(80, config.ribbonDurationMs);
      }
      if (this.ribbonNodes.length === 0) {
        this.ribbonNodes.push({
          topX: ox,
          topY: origin.y + 1,
          botX: ox,
          botY: origin.y + origin.height - 1,
          age: 0,
          color
        });
      }
      if (this.ribbonNodes.length >= this.MAX_RIBBON_NODES) {
        this.ribbonNodes.shift();
      }
      this.ribbonNodes.push({
        topX: tx,
        topY: target.y + 1,
        botX: tx,
        botY: target.y + target.height - 1,
        age: 0,
        color
      });
    }
  }

  public stepAndDraw(
    ctx: CanvasRenderingContext2D,
    dtMs: number,
    viewW: number,
    viewH: number,
    dpr: number
  ): boolean {
    const clampedDt = Math.max(1, Math.min(dtMs, 50));

    // 更新狀態並剔除過期項目
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].age += clampedDt;
      if (this.beams[i].age >= this.beams[i].maxAge) this.beams.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += clampedDt;
      if (p.age >= p.maxAge) {
        this.particles.splice(i, 1);
      } else {
        p.x += p.vx * clampedDt;
        p.y += p.vy * clampedDt;
        p.vy += 0.00012 * clampedDt; // 微幅重力漂浮
      }
    }

    for (let i = this.ribbonNodes.length - 1; i >= 0; i--) {
      this.ribbonNodes[i].age += clampedDt;
      if (this.ribbonNodes[i].age >= this.ribbonMaxAgeMs) {
        this.ribbonNodes.splice(i, 1);
      }
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);

    // 1. 繪製雷射軌跡 (Laser Beam)
    for (const b of this.beams) {
      const progress = b.age / b.maxAge;
      const alpha = Math.pow(1 - progress, 1.5);
      const grad = ctx.createLinearGradient(b.x1, b.y1, b.x2, b.y2);
      grad.addColorStop(0, `rgba(${b.color.r}, ${b.color.g}, ${b.color.b}, 0)`);
      grad.addColorStop(0.35, `rgba(${b.color.r}, ${b.color.g}, ${b.color.b}, ${(alpha * 0.65).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${b.color.r}, ${b.color.g}, ${b.color.b}, ${alpha.toFixed(3)})`);

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(0.8, b.width * (1 - progress * 0.5));
      ctx.lineCap = 'round';
      ctx.shadowColor = b.color.hex;
      ctx.shadowBlur = 10 * alpha;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. 繪製星塵粒子 (Sparkle Dust)
    for (const p of this.particles) {
      const progress = p.age / p.maxAge;
      const alpha = 1 - progress;
      const s = p.size * (1 - progress * 0.4);
      ctx.save();
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${(alpha * 0.9).toFixed(3)})`;
      ctx.shadowColor = p.color.hex;
      ctx.shadowBlur = 6 * alpha;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      ctx.restore();
    }

    // 3. 繪製速度線 (Speed Ribbon)
    if (this.ribbonNodes.length >= 2) {
      for (let i = 1; i < this.ribbonNodes.length; i++) {
        const prev = this.ribbonNodes[i - 1];
        const curr = this.ribbonNodes[i];
        const ageRatio = 1 - curr.age / this.ribbonMaxAgeMs;
        const idxRatio = i / (this.ribbonNodes.length - 1);
        const alpha = Math.max(0, Math.min(1, ageRatio * idxRatio * 0.85));

        ctx.save();
        ctx.strokeStyle = `rgba(${curr.color.r}, ${curr.color.g}, ${curr.color.b}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(0.8, 1.8 * idxRatio);
        ctx.lineCap = 'round';
        ctx.shadowColor = curr.color.hex;
        ctx.shadowBlur = 5 * alpha;

        // 上緣軌跡線
        ctx.beginPath();
        ctx.moveTo(prev.topX, prev.topY);
        ctx.lineTo(curr.topX, curr.topY);
        ctx.stroke();

        // 下緣軌跡線
        ctx.beginPath();
        ctx.moveTo(prev.botX, prev.botY);
        ctx.lineTo(curr.botX, curr.botY);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
    return this.hasActiveEffects();
  }

  public hasActiveEffects(): boolean {
    return this.beams.length > 0 || this.particles.length > 0 || this.ribbonNodes.length >= 2;
  }

  public clear(): void {
    this.beams.length = 0;
    this.particles.length = 0;
    this.ribbonNodes.length = 0;
  }
}
