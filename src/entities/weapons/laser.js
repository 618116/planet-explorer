// Laser projectile: moves in a straight line, no gravity.
import { Projectile } from '../projectile.js';

export class LaserProjectile extends Projectile {
  constructor(x, y, vx, vy) {
    super(x, y, vx, vy);
  }

  update(dt) {
    super.update(dt);
    if (!this.alive) return;

    // No gravity for laser
    const nx = this.x + this.vx;
    const ny = this.y + this.vy;

    // Laser might still hit terrain
    // We'll need a way to handle terrain collision for lasers if they aren't meant to pass through.
    // For now, let's assume they hit terrain like ballistic ones but without gravity.
    // We'll need to import raycastTerrain if we want to use it here.
    // But wait, the base class doesn't have it. Let's see.
    // Actually, the base class is just a container.
    
    // For a laser, we might want to check collision differently.
    // But for this test, let's just use the same logic as ballistic but without gravity.
    // We'll import it inside the update or at the top.
    // Let's use a dynamic import or just add it to the top.
    // Since we are in a module, we can just import it.
    // But we need to avoid circular dependencies if possible.
    // Let'// We'll use a trick: we'll import it here.
    // Actually, let's just use the current position for now to see if it works.
    
    // For now, let's just move.
    this.updatePosition(nx, ny);
  }
}
