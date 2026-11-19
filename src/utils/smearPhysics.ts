import { CursorRect } from '../core/cursorStore';

export interface Point2D {
  x: number;
  y: number;
}

export interface SmearConfig {
  stiffness: number;              // 前導角剛性 (0.1 ~ 1.0)
  trailingStiffness: number;      // 拖尾角剛性 (0.05 ~ 1.0)
  trailingExponent: number;       // 拖尾角度指數曲率 (1.0 ~ 5.0)
  damping: number;                // 阻尼係數 (0.1 ~ 1.0)
  distanceStopAnimating: number;  // 停止動畫收斂閾值 (px)
  maxLength: number;              // 最大拖尾長度限制 (px，0 為無限制)
}

/**
 * 將矩形轉為順時針四個頂點 [TL, TR, BR, BL]
 */
function rectToCorners(rect: CursorRect): [Point2D, Point2D, Point2D, Point2D] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
}

/**
 * 計算點集的凸包 (Andrew's Monotone Chain)，確保繪製四邊形時即使頂點因過衝交叉也不會產生自交蝴蝶結
 */
export function computeConvexHull(points: Point2D[]): Point2D[] {
  if (points.length <= 2) return points;

  const sorted = [...points].sort((a, b) =>
    a.x === b.x ? a.y - b.y : a.x - b.x
  );

  const cross = (o: Point2D, a: Point2D, b: Point2D) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point2D[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point2D[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Smear Cursor 四角獨立彈簧物理引擎 (復刻 Neovide / smear-cursor.nvim)
 *
 * 原理：游標的四個頂點各自擁有座標與速度向量。
 * 移動時，朝向目標方向的前導角以高剛性快速飛向終點，
 * 背對移動方向的拖尾角則以較低剛性延遲跟上，自然拉出連續變形的幾何度拖尾。
 */
export class SmearPhysicsEngine {
  private currentCorners: [Point2D, Point2D, Point2D, Point2D] | null = null;
  private targetCorners: [Point2D, Point2D, Point2D, Point2D] | null = null;
  private velocities: [Point2D, Point2D, Point2D, Point2D] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 }
  ];
  private cornerStiffnesses: [number, number, number, number] = [0.8, 0.8, 0.8, 0.8];
  private trailingIndices: [number, number] = [0, 3];
  private targetCenter: Point2D = { x: 0, y: 0 };
  private isInitialized = false;

  /**
   * 立即貼齊目標矩形並歸零速度（用於初始化或視窗捲動時抑制拖尾）
   */
  public snapTo(rect: CursorRect): void {
    const corners = rectToCorners(rect);
    this.currentCorners = corners.map(p => ({ ...p })) as [Point2D, Point2D, Point2D, Point2D];
    this.targetCorners = corners.map(p => ({ ...p })) as [Point2D, Point2D, Point2D, Point2D];
    this.targetCenter = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    this.trailingIndices = [0, 3];
    for (let i = 0; i < 4; i++) {
      this.velocities[i].x = 0;
      this.velocities[i].y = 0;
    }
    this.isInitialized = true;
  }

  /**
   * 設定新的目標矩形，並依位移方向計算每個頂點的前導 / 拖尾剛性
   */
  public setTarget(rect: CursorRect, config: SmearConfig): boolean {
    if (!this.isInitialized || !this.currentCorners || !this.targetCorners) {
      this.snapTo(rect);
      return false;
    }

    const newTargetCorners = rectToCorners(rect);
    const newCenter: Point2D = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2
    };

    // 以當前四角幾何中心到新目標中心的向量判定移動方向
    let curCenterX = 0;
    let curCenterY = 0;
    for (let i = 0; i < 4; i++) {
      curCenterX += this.currentCorners[i].x;
      curCenterY += this.currentCorners[i].y;
    }
    curCenterX /= 4;
    curCenterY /= 4;

    const moveDx = newCenter.x - curCenterX;
    const moveDy = newCenter.y - curCenterY;
    const moveDist = Math.hypot(moveDx, moveDy);

    if (moveDist < 0.01) {
      this.targetCorners = newTargetCorners;
      this.targetCenter = newCenter;
      return this.isAnimating(config.distanceStopAnimating);
    }

    const dirX = moveDx / moveDist;
    const dirY = moveDy / moveDist;

    // 若啟用最大拖尾長度限制，先將過遠的當前頂點拉近至 maxLength 範圍內
    if (config.maxLength > 0) {
      for (let i = 0; i < 4; i++) {
        const dx = this.currentCorners[i].x - newTargetCorners[i].x;
        const dy = this.currentCorners[i].y - newTargetCorners[i].y;
        const dist = Math.hypot(dx, dy);
        if (dist > config.maxLength) {
          const ratio = config.maxLength / dist;
          this.currentCorners[i].x = newTargetCorners[i].x + dx * ratio;
          this.currentCorners[i].y = newTargetCorners[i].y + dy * ratio;
        }
      }
    }

    // 長距離移動動態加長：短距離 (<=80px) 保持俐落，長距離 (>80px) 平滑壓低拖尾剛性以拉出更明顯的殘影
    const longJumpRatio = Math.min(1, Math.max(0, (moveDist - 80) / 420));
    const effectiveTrailingStiffness = Math.max(
      0.05,
      config.trailingStiffness * (1 - 0.55 * longJumpRatio)
    );

    const cornerDots: Array<{ idx: number; dot: number }> = [];
    // 依各頂點與移動方向的點積區分前導角 (Leading) 與拖尾角 (Trailing)
    for (let i = 0; i < 4; i++) {
      const offX = newTargetCorners[i].x - newCenter.x;
      const offY = newTargetCorners[i].y - newCenter.y;
      const offLen = Math.hypot(offX, offY) || 1;
      const dot = (offX / offLen) * dirX + (offY / offLen) * dirY;
      cornerDots.push({ idx: i, dot });

      // 依指數曲率平滑過渡前導角與拖尾角剛性 (smear-cursor.nvim trailing_exponent)
      const exponent = Math.max(1.0, config.trailingExponent || 3.0);
      const t = Math.max(0, Math.min(1, (dot + 1) * 0.5));
      const factor = Math.pow(t, exponent);
      this.cornerStiffnesses[i] =
        effectiveTrailingStiffness + (config.stiffness - effectiveTrailingStiffness) * factor;
    }

    // 記錄背對移動方向的兩個拖尾角索引，避免高拖尾剛性下前導角過衝距離大於拖尾角而誤抓前導角
    cornerDots.sort((a, b) => a.dot - b.dot);
    this.trailingIndices = [cornerDots[0].idx, cornerDots[1].idx];

    this.targetCorners = newTargetCorners;
    this.targetCenter = newCenter;
    return true;
  }

  /**
   * 推進物理模擬一幀 (以 60fps 為基準做跨更新率標準化)
   * 回傳是否仍在動畫中
   */
  public step(dtMs: number, config: SmearConfig): boolean {
    if (!this.currentCorners || !this.targetCorners) return false;

    // 限制單步最大 dt 避免切換分頁回來時物理爆衝
    const clampedDt = Math.max(1, Math.min(dtMs, 50));
    const alpha = clampedDt / 16.6667;
    const damping = Math.max(0.05, Math.min(0.99, config.damping));
    const dampingFactor = Math.pow(1 - damping, alpha);

    let maxDist = 0;
    for (let i = 0; i < 4; i++) {
      const cur = this.currentCorners[i];
      const tgt = this.targetCorners[i];
      const vel = this.velocities[i];
      const k = Math.max(0.05, Math.min(1.0, this.cornerStiffnesses[i]));

      const dx = tgt.x - cur.x;
      const dy = tgt.y - cur.y;

      vel.x = vel.x * dampingFactor + dx * k * alpha;
      vel.y = vel.y * dampingFactor + dy * k * alpha;

      cur.x += vel.x * alpha;
      cur.y += vel.y * alpha;

      const remaining = Math.hypot(tgt.x - cur.x, tgt.y - cur.y);
      const speed = Math.hypot(vel.x, vel.y);
      if (remaining > maxDist) maxDist = remaining;
      if (speed > maxDist) maxDist = speed;
    }

    if (maxDist <= config.distanceStopAnimating) {
      for (let i = 0; i < 4; i++) {
        this.currentCorners[i].x = this.targetCorners[i].x;
        this.currentCorners[i].y = this.targetCorners[i].y;
        this.velocities[i].x = 0;
        this.velocities[i].y = 0;
      }
      return false;
    }

    return true;
  }

  public isAnimating(stopThreshold: number): boolean {
    if (!this.currentCorners || !this.targetCorners) return false;
    for (let i = 0; i < 4; i++) {
      const dx = this.targetCorners[i].x - this.currentCorners[i].x;
      const dy = this.targetCorners[i].y - this.currentCorners[i].y;
      if (Math.hypot(dx, dy) > stopThreshold) return true;
      if (Math.hypot(this.velocities[i].x, this.velocities[i].y) > stopThreshold) return true;
    }
    return false;
  }

  /**
   * 計算拖尾端相對於目標矩形的平均落後位移向量
   * 採用背對移動方向的兩個拖尾角各自相對於對應目標角的位移平均，
   * 在保持等寬平移的同時，避免跨不同字元寬度移動時尾端反向溢出起點。
   */
  private getTailLag(): Point2D {
    if (!this.currentCorners || !this.targetCorners) {
      return { x: 0, y: 0 };
    }
    const [idxA, idxB] = this.trailingIndices;
    const lagAx = this.currentCorners[idxA].x - this.targetCorners[idxA].x;
    const lagAy = this.currentCorners[idxA].y - this.targetCorners[idxA].y;
    const lagBx = this.currentCorners[idxB].x - this.targetCorners[idxB].x;
    const lagBy = this.currentCorners[idxB].y - this.targetCorners[idxB].y;
    return {
      x: (lagAx + lagBx) * 0.5,
      y: (lagAy + lagBy) * 0.5
    };
  }

  public getPolygon(): Point2D[] {
    if (!this.currentCorners || !this.targetCorners) return [];

    // 以兩個拖尾角的平均落後位移整體平移目標矩形，建構等尺寸的平行尾端矩形再取凸包：
    // 1. 保持平行四邊形／等寬掃掠外型，尾端維持 100% 寬度而不收窄成錐形
    // 2. 避免長按 j/k 遇到大距離左右跨度時，四角在空間中張開成畸形四邊形
    const tailLag = this.getTailLag();
    const tailDist = Math.hypot(tailLag.x, tailLag.y);

    if (tailDist < 0.5) {
      return [...this.targetCorners];
    }

    const tailCorners: Point2D[] = this.targetCorners.map(corner => ({
      x: corner.x + tailLag.x,
      y: corner.y + tailLag.y
    }));

    return computeConvexHull([...this.targetCorners, ...tailCorners]);
  }

  public getTargetCenter(): Point2D {
    return this.targetCenter;
  }

  /**
   * 取得平行四邊形漸層淡出軸線：由平行尾端中心指向目標中心，與拖尾中軸線對齊
   */
  public getGradientAxis(): { tail: Point2D; head: Point2D } {
    const head = this.targetCenter;
    if (!this.currentCorners || !this.targetCorners) {
      return { tail: head, head };
    }
    const tailLag = this.getTailLag();
    return {
      tail: {
        x: head.x + tailLag.x,
        y: head.y + tailLag.y
      },
      head
    };
  }

  public reset(): void {
    this.currentCorners = null;
    this.targetCorners = null;
    this.trailingIndices = [0, 3];
    this.isInitialized = false;
  }
}
