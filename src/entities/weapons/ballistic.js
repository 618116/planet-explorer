// Ballistic projectile with gravity and swept terrain-impact collision.
import { Projectile } from '../projectile.js';
import { gravityAt, raycastTerrain } from '../terrain/heightmap.js';
import { explode } from '../explode.js';

export class BallisticProjectile extends Projectile {
  constructor(x, y, vx, vy) {
    super(x, y, vx, vy);
  }

  update(dt) {
    super.update(dt);
    if (!this.alive) return;

    // Apply gravity
    const { gx, gy } = gravityAt(this.x, this.y);
    this.vx += gx * 1.2 * dt; 
    this.vy += gy * 1.2 * dt;

    const nx = this.x + this.vx;
    const ny = this.y + this.vy;

    // Terrain collision
    const hit = raycastTerrain(this.x, this.y, nx, ny);
    if (hit) {
      this.x = hit.x; 
      this.y = hit.y;
      this.alive = false;
      explode(this.x, this.y);
      return;
    }

    this.updatePosition(nx, ny);
  }
}
