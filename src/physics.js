// Shared physics helpers for entity movement on a radial planet.
import { CX, CY } from './config.js';
import { isSolid } from './terrain/heightmap.js';

export function surfaceAngle(x, y) {
  return Math.atan2(y - CY, x - CX);
}

// Place obj just outside the solid surface at the given angle.
export function placeAtAngle(obj, angle, baseRadius) {
  for (let r = baseRadius + 20; r > 0; r--) {
    const px = CX + Math.cos(angle) * r;
    const py = CY + Math.sin(angle) * r;
    if (isSolid(px, py)) {
      obj.x = CX + Math.cos(angle) * (r + 2);
      obj.y = CY + Math.sin(angle) * (r + 2);
      return;
    }
  }
  obj.x = CX + Math.cos(angle) * (baseRadius + 2);
  obj.y = CY + Math.sin(angle) * (baseRadius + 2);
}

// Lift obj out of terrain, set onGround, zero inward velocity component.
// Returns outward unit vector (outX, outY) for downstream body-collision checks.
export function resolveSurfaceCollision(obj) {
  obj.onGround = false;
  const θ = surfaceAngle(obj.x, obj.y);
  const outX = Math.cos(θ), outY = Math.sin(θ);

  if (isSolid(obj.x, obj.y)) {
    for (let i = 0; i < 30; i++) {
      obj.x += outX; obj.y += outY;
      if (!isSolid(obj.x, obj.y)) break;
    }
    obj.onGround = true;
    const inDot = obj.vx * (-outX) + obj.vy * (-outY);
    if (inDot > 0) { obj.vx += outX * inDot; obj.vy += outY * inDot; }
  }
  if (!obj.onGround && isSolid(obj.x - outX * 2, obj.y - outY * 2)) {
    obj.onGround = true;
  }
  return { outX, outY };
}

// Step along obj's body (outward from surface) checking sides for wall collisions.
// Player: bodyLen=PLAYER_H, step=3 → 5 checks along body.
// Enemy: bodyLen=0, step=1 → single check at feet.
// onHit(obj, side, tx, ty) defaults to velocity reflection; enemy passes a direction-flip callback.
export function resolveBodyCollision(obj, halfW, bodyLen, step, outX, outY, onHit) {
  const tx = -outY, ty = outX;
  let t = 0;
  do {
    const bx = obj.x + outX * t, by = obj.y + outY * t;
    for (let side = -1; side <= 1; side += 2) {
      if (isSolid(bx + tx * halfW * side, by + ty * halfW * side)) {
        obj.x -= tx * side * 0.5; obj.y -= ty * side * 0.5;
        if (onHit) {
          onHit(obj, side, tx, ty);
        } else {
          const td = obj.vx * tx * side + obj.vy * ty * side;
          if (td > 0) { obj.vx -= tx * side * td * 0.5; obj.vy -= ty * side * td * 0.5; }
        }
      }
    }
    t += step;
  } while (t < bodyLen);
}

// Radial damage + knockback applied at explosion site.
// radius is the full falloff radius (caller multiplies EXPLOSION_RADIUS * 1.6).
export function applyRadialKnockback(obj, cx, cy, radius, maxForce, maxDmg, invuln = false) {
  const d = Math.sqrt((obj.x - cx) ** 2 + (obj.y - cy) ** 2);
  if (d >= radius) return;
  const falloff = 1 - d / radius;
  if (!invuln) {
    const dmg = Math.max(0, Math.round(maxDmg * falloff));
    obj.hp = Math.max(0, obj.hp - dmg);
  }
  const a = Math.atan2(obj.y - cy, obj.x - cx);
  const f = maxForce * falloff;
  obj.vx += Math.cos(a) * f;
  obj.vy += Math.sin(a) * f;
}
