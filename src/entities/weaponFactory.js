// Centralized factory for creating projectile instances by weapon type.
import { BallisticProjectile } from './weapons/ballistic.js';
import { LaserProjectile } from './weapons/laser.js';

const WEAPON_TYPES = {
  ballistic: BallisticProjectile,
  laser: LaserProjectile,
};

/**
 * Creates a projectile of the given type.
 * @param {string} type  - Key in WEAPON_TYPES (e.g. 'ballistic', 'laser').
 * @param {Object} params - { x, y, vx, vy } spawn parameters.
 * @returns {Projectile} A new projectile instance.
 */
export function createProjectile(type, params) {
  const Ctor = WEAPON_TYPES[type];
  if (!Ctor) {
    console.warn(`Unknown weapon type: "${type}". Falling back to ballistic.`);
    return new BallisticProjectile(params.x, params.y, params.vx, params.vy);
  }
  return new Ctor(params.x, params.y, params.vx, params.vy);
}
