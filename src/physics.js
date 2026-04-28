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

// Compute terrain contact normal at integer position (px, py).
// Sums weighted repulsion vectors from nearby solid pixels (closer = stronger).
// Returns { x, y } unit vector pointing away from terrain, or null if
// the point is not embedded or is fully surrounded (degenerate).
function terrainNormal(px, py) {
  let nx = 0, ny = 0;
  const R = 4;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (isSolid(px + dx, py + dy)) {
        const d2 = dx * dx + dy * dy;
        nx -= dx / d2;
        ny -= dy / d2;
      }
    }
  }
  const len = Math.hypot(nx, ny);
  if (len < 0.001) return null;
  return { x: nx / len, y: ny / len };
}

// Push obj out of terrain along the contact normal, cancel penetrating
// velocity, and detect ground contact.
// Returns outward unit vector (outX, outY) for downstream body-collision checks.
export function resolveSurfaceCollision(obj) {
  const θ = surfaceAngle(obj.x, obj.y);
  const outX = Math.cos(θ), outY = Math.sin(θ);

  if (isSolid(obj.x, obj.y)) {
    const n = terrainNormal(Math.round(obj.x), Math.round(obj.y));
    const escX = n ? n.x : outX;
    const escY = n ? n.y : outY;

    for (let i = 0; i < 60; i++) {
      obj.x += escX; obj.y += escY;
      if (!isSolid(obj.x, obj.y)) break;
    }

    // Cancel the velocity component going into the surface.
    const vInto = -(obj.vx * escX + obj.vy * escY);
    if (vInto > 0) {
      obj.vx += escX * vInto;
      obj.vy += escY * vInto;
    }
  }

  // onGround: purely positional — is there solid terrain 2 px toward planet center?
  obj.onGround = isSolid(
    Math.round(obj.x - outX * 2),
    Math.round(obj.y - outY * 2),
  );

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
    for (let side = -1; side <= 1; side += 2) {
      if (isSolid(obj.x + outX * t + tx * halfW * side, obj.y + outY * t + ty * halfW * side)) {
        for (let push = 0; push < 8; push++) {
          obj.x -= tx * side * 0.5; obj.y -= ty * side * 0.5;
          if (!isSolid(obj.x + outX * t + tx * halfW * side, obj.y + outY * t + ty * halfW * side)) break;
        }
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
