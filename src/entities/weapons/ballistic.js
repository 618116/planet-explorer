// Ballistic projectile with gravity and swept terrain-impact collision.
import { Projectile } from '../projectile.js';
import { gravityAt, raycastTerrain } from '../../terrain/heightmap.js';
import { explode } from '../../explode.js';

const GRAVITY_SCALE = 1.2;

export class BallisticProjectile extends Projectile {
  update(dt) {
    super.update(dt);
    if (!this.alive) return;

    // Apply gravity
    const { gx, gy } = gravityAt(this.x, this.y);
    this.vx += gx * GRAVITY_SCALE * dt;
    this.vy += gy * GRAVITY_SCALE * dt;

    const nx = this.x + this.vx;
    const ny = this.y + this.vy;

    // Terrain collision (swept raycast)
    const hit = raycastTerrain(this.x, this.y, nx, ny);
    if (hit) {
      this.updatePosition(hit.x, hit.y);
      this.alive = false;
      explode(this.x, this.y);
      return;
    }

    this.updatePosition(nx, ny);
  }
}
