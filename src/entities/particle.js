// Particle with type-specific behavior: dirt, fire, smoke, thrust.
import { CX, CY, REF_HZ, PARTICLE_DAMPING } from '../config.js';
import { gravityAt } from '../terrain/heightmap.js';

export class Particle {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.prevX = x; this.prevY = y; this.type = type;
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 5;
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;  // px/tick
    this.life = 1;
    this.decay = (0.012 + Math.random() * 0.025) * REF_HZ;   // per second
    this.size = 2 + Math.random() * 3;
    const θ = Math.atan2(y - CY, x - CX);

    if (type === 'fire') {
      this.r = 255; this.g = 100 + Math.random() * 155 | 0; this.b = 0;
      this.vx += Math.cos(θ) * 2;
      this.vy += Math.sin(θ) * 2;
    } else if (type === 'smoke') {
      const v = 80 + Math.random() * 50 | 0;
      this.r = this.g = this.b = v;
      this.decay = (0.008 + Math.random() * 0.012) * REF_HZ;
      this.size = 4 + Math.random() * 6;
      this.vx += Math.cos(θ) * 1.5;
      this.vy += Math.sin(θ) * 1.5;
    } else if (type === 'thrust') {
      this.r = 255;
      this.g = 180 + Math.random() * 75 | 0;
      this.b = 50 + Math.random() * 80 | 0;
      this.decay = (0.04 + Math.random() * 0.04) * REF_HZ;
      this.size = 1.5 + Math.random() * 2.5;
      this.vx = -(Math.cos(θ)) * (1 + Math.random() * 2) + (Math.random() - 0.5) * 1.5;
      this.vy = -(Math.sin(θ)) * (1 + Math.random() * 2) + (Math.random() - 0.5) * 1.5;
    } else {
      this.r = 120 + Math.random() * 40 | 0;
      this.g = 80 + Math.random() * 30 | 0;
      this.b = 40;
    }
  }
  update(dt) {
    this.prevX = this.x; this.prevY = this.y;
    if (this.type === 'dirt' || this.type === 'thrust') {
      const { gx, gy } = gravityAt(this.x, this.y);
      this.vx += gx * 0.5 * dt; this.vy += gy * 0.5 * dt;
    } else if (this.type === 'smoke') {
      const θ = Math.atan2(this.y - CY, this.x - CX);
      this.vx += Math.cos(θ) * 1.8 * dt;   // 0.03 * REF_HZ = 1.8
      this.vy += Math.sin(θ) * 1.8 * dt;
    }
    this.x += this.vx; this.y += this.vy;
    this.vx *= Math.pow(PARTICLE_DAMPING, dt * REF_HZ);
    this.vy *= Math.pow(PARTICLE_DAMPING, dt * REF_HZ);
    this.life -= this.decay * dt;
  }
  draw(ctx, alpha = 1) {
    const ix = this.prevX + (this.x - this.prevX) * alpha;
    const iy = this.prevY + (this.y - this.prevY) * alpha;
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = `rgb(${this.r},${this.g},${this.b})`;
    ctx.beginPath();
    ctx.arc(ix, iy, this.size * this.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
