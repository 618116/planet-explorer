// WeaponFactory: Centralized factory for creating different types of projectiles.
import { BallisticProjectile } from './weapons/ballistic.js';
import { LaserProjectile } from './weapons/laser.js';

export class WeaponFactory {
  /**
   * Creates a projectile based on the specified type.
   * @param {string} type - The type of weapon to create.
   * @param {Object} params - Parameters for the projectile (x, y, vx, vy, etc.).
   * @returns {Projectile} A new projectile instance.
   */
  static create(type, params) {
    const { x, y, vx, vy } = params;

    switch (type) {
      case 'ballistic':
        return new BallisticProjectile(x, y, vx, vy);
      case 'laser':
        return new LaserProjectile(x, y, vx, vy);
      
      default:
        console.warn(`Unknown weapon type: ${type}. Falling back to ballistic.`);
        return new BallisticProjectile(x, y, vx, vy);
    }
  }
}
