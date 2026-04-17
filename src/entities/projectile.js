// Ballistic projectile with gravity, trail, and terrain-impact explosion.
import { WORLD_W, WORLD_H } from '../config.js';
import { gravityAt, terrain } from '../terrain/heightmap.js';
import { explode } from '../explode.js';

export class Projectile {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.alive = true;
    this.trail = [];
    this.age = 0;
  }
  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 25) this.trail.shift();
    const { gx, gy } = gravityAt(this.x, this.y);
    this.vx += gx * 1.2; this.vy += gy * 1.2;
    this.x += this.vx; this.y += this.vy; this.age++;
    if (this.x < -50 || this.x > WORLD_W + 50 || this.y < -50 || this.y > WORLD_H + 50) {
      this.alive = false; return;
    }
    const rx = Math.round(this.x), ry = Math.round(this.y);
    if (rx >= 0 && rx < WORLD_W && ry >= 0 && ry < WORLD_H && terrain[ry * WORLD_W + rx]) {
      this.alive = false;
      explode(this.x, this.y);
    }
    if (this.age > 600) this.alive = false;
  }
  draw(ctx) {
    for (let i = 0; i < this.trail.length; i++) {
      const t = i / this.trail.length;
      ctx.fillStyle = `rgba(255,${150 + 105 * t | 0},${50 * t | 0},${t * 0.7})`;
      ctx.beginPath(); ctx.arc(this.trail[i].x, this.trail[i].y, 1 + t * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#feca57';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff6b35';
    ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}
