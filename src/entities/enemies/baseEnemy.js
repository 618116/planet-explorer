// Base enemy: shared surface walking, collision, terrain deposit, and drawing hooks.
import {
  ENEMY_DIR_CHANGE_MIN,
  ENEMY_DIR_CHANGE_MAX,
  ENEMY_DEPOSIT_INTERVAL,
  REF_HZ,
  GROUND_DAMPING,
  AIR_DAMPING,
} from '../../config.js';
import { gravityAt, getSurfaceRadius, depositTerrainPixel } from '../../terrain/heightmap.js';
import {
  surfaceAngle,
  placeAtAngle,
  resolveSurfaceCollision,
  resolveBodyCollision,
} from '../../physics.js';

function rollDirChangeAt(nowMs) {
  return nowMs + ENEMY_DIR_CHANGE_MIN + Math.random() * (ENEMY_DIR_CHANGE_MAX - ENEMY_DIR_CHANGE_MIN);
}

export class BaseEnemy {
  constructor(angle, stats) {
    this.type = stats.type;
    this.isLarge = Boolean(stats.isLarge);
    this.sizeW = stats.sizeW;
    this.sizeH = stats.sizeH;
    this.maxHp = stats.maxHp;
    this.hp = this.maxHp;
    this.walkSpeed = stats.walkSpeed;
    this.depositTLen = stats.depositTLen;
    this.depositHLen = stats.depositHLen;
    this.bodyColor = stats.bodyColor;
    this.eyeSize = stats.eyeSize;
    this.eyeOffset = stats.eyeOffset;
    this.hpBarW = stats.hpBarW;
    this.hpBarH = stats.hpBarH;
    this.minimapColor = stats.minimapColor !== undefined ? stats.minimapColor : this.bodyColor;
    this.minimapRadius = stats.minimapRadius !== undefined ? stats.minimapRadius : 2;
    this.hitRadius = stats.hitRadius !== undefined ? stats.hitRadius : this.sizeW * 0.5;

    this.x = 0;
    this.y = 0;
    this.prevX = 0;
    this.prevY = 0;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.nextDirChange = rollDirChangeAt(Date.now());
    this.depositTimer = 0;

    placeAtAngle(this, angle, getSurfaceRadius(angle));
    this.prevX = this.x;
    this.prevY = this.y;
  }

  get surfAngle() {
    return surfaceAngle(this.x, this.y);
  }

  update(dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    const { gx, gy } = gravityAt(this.x, this.y);
    this.vx += gx * dt;
    this.vy += gy * dt;

    if (this.onGround) {
      const θ = this.surfAngle;
      const ta = θ + Math.PI / 2 * this.dir;
      this.vx += Math.cos(ta) * this.walkSpeed * dt;
      this.vy += Math.sin(ta) * this.walkSpeed * dt;
    }

    const speed = Math.hypot(this.vx, this.vy);
    const sub = Math.max(1, Math.ceil(speed / 2));
    const dvx = this.vx / sub;
    const dvy = this.vy / sub;
    for (let i = 0; i < sub; i++) {
      this.x += dvx;
      this.y += dvy;
      const { outX, outY } = resolveSurfaceCollision(this);
      resolveBodyCollision(this, this.sizeW / 2, 0, 1, outX, outY, (obj) => {
        obj.dir *= -1;
        obj.nextDirChange = rollDirChangeAt(Date.now());
      });
    }

    const damp = this.onGround ? GROUND_DAMPING : AIR_DAMPING;
    const dampFactor = Math.pow(damp, dt * REF_HZ);
    this.vx *= dampFactor;
    this.vy *= dampFactor;

    if (Date.now() > this.nextDirChange) {
      this.dir *= -1;
      this.nextDirChange = rollDirChangeAt(Date.now());
    }

    if (this.onGround) {
      this.depositTimer += dt;
      if (this.depositTimer >= ENEMY_DEPOSIT_INTERVAL) {
        this.depositTimer = 0;
        this.depositTerrain();
      }
    }
  }

  depositTerrain() {
    const θ = this.surfAngle;
    const outX = Math.cos(θ);
    const outY = Math.sin(θ);
    const tanX = -outY;
    const tanY = outX;
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

    ctx.fillStyle = this.bodyColor;
    ctx.fillRect(-this.sizeW / 2, -this.sizeH, this.sizeW, this.sizeH);

    ctx.fillStyle = '#ff0000';
    ctx.fillRect(this.dir > 0 ? 0 : -this.eyeOffset, -this.sizeH + this.eyeSize, this.eyeSize, this.eyeSize);

    const hpX = -this.hpBarW / 2;
    const hpY = -this.sizeH - 5;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hpX, hpY, this.hpBarW, this.hpBarH);
    ctx.fillStyle = this.hp > this.maxHp * 0.5 ? '#e74c3c' : '#ff0000';
    ctx.fillRect(hpX, hpY, this.hpBarW * (this.hp / this.maxHp), this.hpBarH);

    ctx.restore();
  }
}