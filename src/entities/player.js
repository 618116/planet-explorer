// Player: movement, collision, fuel/thrust, HP, sprite with flame + aim line.
import {
  PLAYER_H, PLAYER_W, MAX_FUEL, FUEL_REGEN,
} from '../config.js';
import { gravityAt, getSurfaceRadius } from '../terrain/heightmap.js';
import {
  surfaceAngle, placeAtAngle, resolveSurfaceCollision, resolveBodyCollision,
} from '../physics.js';

export class Player {
  constructor(angle) {
    this.hp = 100;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.shots = 0;
    this.fuel = MAX_FUEL;
    this.thrusting = false;
    placeAtAngle(this, angle, getSurfaceRadius(angle));
  }
  get surfAngle() { return surfaceAngle(this.x, this.y); }

  update() {
    const { gx, gy } = gravityAt(this.x, this.y);
    this.vx += gx; this.vy += gy;
    this.x += this.vx; this.y += this.vy;

    const { outX, outY } = resolveSurfaceCollision(this);
    resolveBodyCollision(this, PLAYER_W / 2, PLAYER_H, 3, outX, outY);

    if (this.onGround) { this.vx *= 0.82; this.vy *= 0.82; }
    else { this.vx *= 0.995; this.vy *= 0.995; }

    if (!this.thrusting) this.fuel = Math.min(MAX_FUEL, this.fuel + FUEL_REGEN);
    this.thrusting = false;
  }

  draw(ctx, aimWorldAngle) {
    const θ = this.surfAngle;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(θ + Math.PI / 2);

    if (this.thrusting) {
      const flicker = Math.random() * 6;
      const flameH = 8 + flicker;
      ctx.fillStyle = `rgba(255,${140 + Math.random() * 60 | 0},0,${0.5 + Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.lineTo(Math.random() * 2 - 1, flameH);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(255,${220 + Math.random() * 35 | 0},${150 + Math.random() * 60 | 0},${0.6 + Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(-1.5, 0);
      ctx.lineTo(1.5, 0);
      ctx.lineTo(Math.random() * 1 - 0.5, flameH * 0.55);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(-PLAYER_W / 2, -PLAYER_H, PLAYER_W, PLAYER_H);

    const localAim = aimWorldAngle - θ;
    const facingRight = Math.sin(localAim) > 0;
    ctx.fillStyle = '#fff';
    ctx.fillRect(facingRight ? 1 : -3, -PLAYER_H + 3, 3, 3);

    const hpW = 22, hpX = -hpW / 2, hpY = -PLAYER_H - 7;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hpX, hpY, hpW, 3);
    ctx.fillStyle = this.hp > 50 ? '#2ecc71' : this.hp > 25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(hpX, hpY, hpW * (this.hp / 100), 3);

    const fY = hpY - 5;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hpX, fY, hpW, 3);
    const fuelPct = this.fuel / MAX_FUEL;
    ctx.fillStyle = fuelPct > 0.3 ? '#48dbfb' : '#ff9f43';
    ctx.fillRect(hpX, fY, hpW * fuelPct, 3);

    ctx.restore();

    const aimLen = 40;
    const ax = this.x + Math.cos(aimWorldAngle) * aimLen;
    const ay = this.y + Math.sin(aimWorldAngle) * aimLen;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax - 5, ay); ctx.lineTo(ax + 5, ay);
    ctx.moveTo(ax, ay - 5); ctx.lineTo(ax, ay + 5);
    ctx.stroke();
  }
}
