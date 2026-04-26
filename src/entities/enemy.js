// Enemy: walks on the surface, flips direction on wall/timer, deposits terrain trail.
import {
  ENEMY_H, ENEMY_W, ENEMY_HP, ENEMY_WALK_SPEED,
  ENEMY_DIR_CHANGE_MIN, ENEMY_DIR_CHANGE_MAX, ENEMY_DEPOSIT_INTERVAL,
  LARGE_ENEMY_CHANCE, LARGE_ENEMY_SIZE_MUL, LARGE_ENEMY_HP_MUL,
  LARGE_ENEMY_SPEED_MUL, LARGE_ENEMY_DEPOSIT_T, LARGE_ENEMY_DEPOSIT_H,
  REF_HZ, GROUND_DAMPING, AIR_DAMPING,
} from '../config.js';
import { gravityAt, getSurfaceRadius, depositTerrainPixel } from '../terrain/heightmap.js';
import {
  surfaceAngle, placeAtAngle, resolveSurfaceCollision, resolveBodyCollision,
} from '../physics.js';
import { state } from '../state.js';

function rollDirChangeAt(nowMs) {
  return nowMs + ENEMY_DIR_CHANGE_MIN + Math.random() * (ENEMY_DIR_CHANGE_MAX - ENEMY_DIR_CHANGE_MIN);
}

export class Enemy {
  constructor(angle, isLarge = false) {
    this.isLarge = isLarge;
    this.sizeW = isLarge ? ENEMY_W * LARGE_ENEMY_SIZE_MUL : ENEMY_W;
    this.sizeH = isLarge ? ENEMY_H * LARGE_ENEMY_SIZE_MUL : ENEMY_H;
    this.maxHp = isLarge ? ENEMY_HP * LARGE_ENEMY_HP_MUL : ENEMY_HP;
    this.hp = this.maxHp;
    this.walkSpeed = isLarge ? ENEMY_WALK_SPEED * LARGE_ENEMY_SPEED_MUL : ENEMY_WALK_SPEED;
    this.depositTLen = isLarge ? LARGE_ENEMY_DEPOSIT_T : 3;
    this.depositHLen = isLarge ? LARGE_ENEMY_DEPOSIT_H : 1;
    this.x = 0; this.y = 0;
    this.prevX = 0; this.prevY = 0;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.nextDirChange = rollDirChangeAt(Date.now());
    this.depositTimer = 0;
    placeAtAngle(this, angle, getSurfaceRadius(angle));
    this.prevX = this.x; this.prevY = this.y;
  }
  get surfAngle() { return surfaceAngle(this.x, this.y); }

  update(dt) {
    this.prevX = this.x; this.prevY = this.y;
    const { gx, gy } = gravityAt(this.x, this.y);
    this.vx += gx * dt; this.vy += gy * dt;

    if (this.onGround) {
      const θ = this.surfAngle;
      const ta = θ + Math.PI / 2 * this.dir;
      this.vx += Math.cos(ta) * this.walkSpeed * dt;
      this.vy += Math.sin(ta) * this.walkSpeed * dt;
    }

    const frameVx = this.vx * dt, frameVy = this.vy * dt;
    const speed = Math.hypot(frameVx, frameVy);
    const sub = Math.max(1, Math.ceil(speed / 2));
    const dvx = frameVx / sub, dvy = frameVy / sub;
    for (let i = 0; i < sub; i++) {
      this.x += dvx; this.y += dvy;
      const { outX, outY } = resolveSurfaceCollision(this);
      resolveBodyCollision(this, this.sizeW / 2, 0, 1, outX, outY, (obj) => {
        obj.dir *= -1;
        obj.nextDirChange = rollDirChangeAt(Date.now());
      });
    }

    const damp = this.onGround ? GROUND_DAMPING : AIR_DAMPING;
    this.vx *= Math.pow(damp, dt * REF_HZ);
    this.vy *= Math.pow(damp, dt * REF_HZ);

    if (Date.now() > this.nextDirChange) {
      this.dir *= -1;
      this.nextDirChange = rollDirChangeAt(Date.now());
    }

    if (this.onGround) {
      this.depositTimer += dt;
      if (this.depositTimer >= ENEMY_DEPOSIT_INTERVAL) {
        this.depositTimer = 0;
        this._depositTerrain();
      }
    }
  }

  _depositTerrain() {
    const θ = this.surfAngle;
    const outX = Math.cos(θ), outY = Math.sin(θ);
    const tanX = -outY, tanY = outX;
    for (let t = 1; t <= this.depositTLen; t++) {
      const bx = this.x - tanX * this.dir * t;
      const by = this.y - tanY * this.dir * t;
      for (let h = -this.depositHLen; h <= this.depositHLen; h++) {
        depositTerrainPixel(Math.round(bx + outX * h), Math.round(by + outY * h));
      }
    }
  }

  draw(ctx, alpha = 1) {
    const ix = this.prevX + (this.x - this.prevX) * alpha;
    const iy = this.prevY + (this.y - this.prevY) * alpha;
    const θ = surfaceAngle(ix, iy);
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(θ + Math.PI / 2);

    ctx.fillStyle = this.isLarge ? '#228822' : '#44cc44';
    ctx.fillRect(-this.sizeW / 2, -this.sizeH, this.sizeW, this.sizeH);

    const eyeSize = this.isLarge ? 8 : 2;
    const eyeOffset = this.isLarge ? 8 : 2;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(this.dir > 0 ? 0 : -eyeOffset, -this.sizeH + eyeSize, eyeSize, eyeSize);

    const hpW = this.isLarge ? 60 : 14, hpX = -hpW / 2, hpY = -this.sizeH - 5;
    const hpBarH = this.isLarge ? 4 : 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hpX, hpY, hpW, hpBarH);
    ctx.fillStyle = this.hp > this.maxHp * 0.5 ? '#e74c3c' : '#ff0000';
    ctx.fillRect(hpX, hpY, hpW * (this.hp / this.maxHp), hpBarH);

    ctx.restore();
  }
}

export function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const isLarge = Math.random() < LARGE_ENEMY_CHANCE;
  state.enemies.push(new Enemy(angle, isLarge));
}
