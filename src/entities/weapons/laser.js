// Hitscan laser: resolves instantly, then stays briefly as a beam visual.
import { Projectile } from '../projectile.js';
import { raycastTerrain } from '../../terrain/heightmap.js';
import {
  LASER_DAMAGE,
  LASER_HIT_WIDTH,
  LASER_RANGE,
  LASER_VISUAL_LIFE,
} from '../../config.js';
import { state } from '../../state.js';
import { laserImpact } from '../../explode.js';

function distancePointToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x0, py - y0);

  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / lenSq));
  const cx = x0 + dx * t;
  const cy = y0 + dy * t;
  return Math.hypot(px - cx, py - cy);
}

export class LaserProjectile extends Projectile {
  constructor(x, y, vx, vy) {
    super(x, y, vx, vy);

    const speed = Math.hypot(vx, vy) || 1;
    this.dirX = vx / speed;
    this.dirY = vy / speed;
    this.startX = x;
    this.startY = y;
    this.beamEndX = x;
    this.beamEndY = y;
    this.resolved = false;
    this.visualLife = LASER_VISUAL_LIFE;
  }

  update(dt) {
    super.update(dt);
    if (!this.alive) return;

    if (!this.resolved) this.resolveHitscan();

    if (this.age >= this.visualLife) this.alive = false;
  }

  resolveHitscan() {
    this.resolved = true;

    const rayEndX = this.startX + this.dirX * LASER_RANGE;
    const rayEndY = this.startY + this.dirY * LASER_RANGE;
    const terrainHit = raycastTerrain(this.startX, this.startY, rayEndX, rayEndY);
    const terrainDist = terrainHit
      ? Math.hypot(terrainHit.x - this.startX, terrainHit.y - this.startY)
      : LASER_RANGE;

    let nearestEnemy = null;
    let nearestEnemyDist = Infinity;
    let nearestEnemyHitX = rayEndX;
    let nearestEnemyHitY = rayEndY;

    for (const e of state.enemies) {
      if (e.hp <= 0) continue;

      const toEnemyX = e.x - this.startX;
      const toEnemyY = e.y - this.startY;
      const alongRay = toEnemyX * this.dirX + toEnemyY * this.dirY;
      if (alongRay <= 0 || alongRay > terrainDist) continue;

      const hitX = this.startX + this.dirX * alongRay;
      const hitY = this.startY + this.dirY * alongRay;
      const segmentDist = distancePointToSegment(
        e.x,
        e.y,
        this.startX,
        this.startY,
        hitX,
        hitY,
      );
      const hitRadius = Math.max(LASER_HIT_WIDTH, e.isLarge ? e.sizeW * 0.5 : LASER_HIT_WIDTH);

      if (segmentDist <= hitRadius && alongRay < nearestEnemyDist) {
        nearestEnemy = e;
        nearestEnemyDist = alongRay;
        nearestEnemyHitX = hitX;
        nearestEnemyHitY = hitY;
      }
    }

    if (nearestEnemy) {
      nearestEnemy.hp = Math.max(0, nearestEnemy.hp - LASER_DAMAGE);
      this.beamEndX = nearestEnemyHitX;
      this.beamEndY = nearestEnemyHitY;
      this.updatePosition(this.beamEndX, this.beamEndY);
      return;
    }

    if (terrainHit) {
      this.beamEndX = terrainHit.x;
      this.beamEndY = terrainHit.y;
      laserImpact(terrainHit.x, terrainHit.y);
    } else {
      this.beamEndX = rayEndX;
      this.beamEndY = rayEndY;
    }

    this.updatePosition(this.beamEndX, this.beamEndY);
  }

  draw(ctx, alpha = 1) {
    const lifeT = Math.max(0, 1 - this.age / this.visualLife);
    const beamAlpha = lifeT * alpha;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#00d2ff';

    // Outer glow
    ctx.strokeStyle = `rgba(0, 210, 255, ${0.28 * beamAlpha})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(this.startX, this.startY);
    ctx.lineTo(this.beamEndX, this.beamEndY);
    ctx.stroke();

    // Bright core
    ctx.strokeStyle = `rgba(210, 250, 255, ${0.95 * beamAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.startX, this.startY);
    ctx.lineTo(this.beamEndX, this.beamEndY);
    ctx.stroke();

    ctx.restore();
  }
}
