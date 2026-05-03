// Base class for all projectiles.
import { WORLD_W, WORLD_H } from '../config.js';

export class Projectile {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y;
    this.prevX = x; this.prevY =y;
    this.vx = vx; this.vy = vy;   // px/sec
    this.alive = true;
    this.trail = new Array(25);
    this.trailHead = 0;
    this.trailCount = 0;
    this.age = 0;                  // seconds
  }

  update(dt) {
    this.prevX = this.x; this.prevY = this.y;
    this.age += dt;
    
    // Boundary check
    if (this.x < -50 || this.x > WORLD_W + 50 || this.y < -50 || this.y > WORLD_H + 50) {
      this.alive = false;
      return;
    }
    if (this.age > 10) {
      this.alive = false;
      return;
    }
  }

  updatePosition(nx, ny) {
    this.x = nx; this.y = ny;
    this.trail[this.trailHead] = { x: this.x, y: this.y };
    this.trailHead = (this.trailHead + 1) % 25;
    if (this.trailCount < 25) this.trailCount++;
  }

  draw(ctx, alpha = 1) {
    const ix = this.prevX + (this.x - this.prevX) * alpha;
    const iy = this.prevY + (this.y - this.prevY) * alpha;
    
    // Draw trail
    for (let i = 0; i < this.trailCount; i++) {
      const idx = (this.trailHead - this.trailCount + i + 25) % 25;
      const t = i / this.trailCount;
      ctx.fillStyle = `rgba(255,${150 + 105 * t | 0},${50 * t | 0},${t * 0.7})`;
      ctx.beginPath(); 
      ctx.arc(this.trail[idx].x, this.trail[idx].y, 1 + t * 2, 0, Math.PI * 2); 
      ctx.fill();
    }
    
    // Draw projectile body
    ctx.fillStyle = '#feca57';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff6b35';
    ctx.beginPath(); 
    ctx.arc(ix, iy, 3, 0, Math.PI * 2); 
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
