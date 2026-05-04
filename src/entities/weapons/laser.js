// Laser projectile: moves in a straight line with no gravity.
// Collides with terrain on contact but does not explode.
import { Projectile } from '../projectile.js';
import { raycastTerrain } from '../../terrain/heightmap.js';
import { LASER_DAMAGE, LASER_TERRAIN_RADIUS, LASER_IMPACT_RADIUS } from '../../config.js';
import { state } from '../../state.js';
import { laserImpact } from '../../explode.js';

export class LaserProjectile extends Projectile {
  update(dt) {
    super.update(dt);
    if (!this.alive) return;

    // 1. Check for enemy hits (Direct Damage)
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const dist = Math.hypot(e.x - this.x, e.y - this.y);
      // Check if the projectile is within a hit radius of the enemy
      if (dist < (e.isLarge ? 20 : 10)) {
        e.hp = Math.max(0, e.hp - LASER_DAMAGE);
        this.alive = false;
        return;
      }
    }

    // 2. Check for terrain collision (Destruction)
    // Use the delta (movement) to check for hits along the path
    const vx = this.vx;
    const vy = this.vy;
    const nx = this.x + vx;
    const ny = this.y + vy;

    const hit = raycastTerrain(this.x, this.y, nx, ny);
    if (hit) {
      this.updatePosition(hit.x, hit.y);
      this.alive = false;
      laserImpact(hit.x, hit.y);
      return;
    }

    this.updatePosition(nx, ny);
  }

  draw(ctx, alpha = 1) {
    const ix = this.prevX + (this.x - this.prevX) * alpha;
    const iy = this.prevY + (this.y - this.prevY) * alpha;

    // Draw laser trail — cyan beam effect
    for (let i = 0; i < this.trailCount; i++) {
      const idx = (this.trailHead - this.trailCount + i + this.trail.length) % this.trail.length;
      const t = i / this.trailCount;
      ctx.fillStyle = `rgba(0,${180 + 75 * t | 0},255,${t * 0.6})`;
      ctx.beginPath();
      ctx.arc(this.trail[idx].x, this.trail[idx].y, 1 + t * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw laser body — bright cyan glow
    ctx.fillStyle = '#00d2ff';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00d2ff';
    ctx.beginPath();
    ctx.arc(ix, iy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}