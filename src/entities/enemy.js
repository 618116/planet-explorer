// Backward-compatible enemy entrypoint.
// New enemy types should be added under ./enemies and registered in enemyFactory.js.
import { createEnemy } from './enemyFactory.js';

export class Enemy {
  constructor(angle, isLarge = false) {
    return createEnemy(isLarge ? 'large' : 'normal', { angle });
  }
}

export { spawnEnemy, createEnemy, rollEnemyType } from './enemyFactory.js';
