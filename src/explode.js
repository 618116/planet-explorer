// Explosion orchestrator: carve terrain, recompute %, knockback player/enemies, spawn particles, shake.
import { EXPLOSION_RADIUS, PARTICLE_COUNT } from './config.js';
import { carveTerrain } from './terrain/falling.js';
import { recalcTerrainPercent } from './terrain/heightmap.js';
import { applyRadialKnockback } from './physics.js';
import { Particle } from './entities/particle.js';
import { state } from './state.js';

export function explode(x, y) {
  carveTerrain(x, y, EXPLOSION_RADIUS);
  recalcTerrainPercent();
  const R = EXPLOSION_RADIUS * 1.6;
  if (state.player) applyRadialKnockback(state.player, x, y, R, 6, 40, state.godMode);
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    applyRadialKnockback(e, x, y, R, 6, 40, false);
  }
  for (let i = 0; i < PARTICLE_COUNT; i++) state.particles.push(new Particle(x, y, 'dirt'));
  for (let i = 0; i < PARTICLE_COUNT / 2; i++) state.particles.push(new Particle(x, y, 'fire'));
  for (let i = 0; i < PARTICLE_COUNT / 3; i++) state.particles.push(new Particle(x, y, 'smoke'));
  state.shakeAmount = 7;
}
