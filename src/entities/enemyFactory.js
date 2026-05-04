// Centralized factory for creating enemy instances by enemy type.
import { LARGE_ENEMY_CHANCE } from '../config.js';
import { state } from '../state.js';
import { NormalEnemy } from './enemies/normalEnemy.js';
import { LargeEnemy } from './enemies/largeEnemy.js';

const ENEMY_TYPES = {
  normal: NormalEnemy,
  large: LargeEnemy,
};

export function createEnemy(type, params = {}) {
  const Ctor = ENEMY_TYPES[type];
  const angle = params.angle !== undefined ? params.angle : Math.random() * Math.PI * 2;

  if (!Ctor) {
    console.warn(`Unknown enemy type: "${type}". Falling back to normal.`);
    return new NormalEnemy(angle);
  }

  return new Ctor(angle);
}

export function rollEnemyType() {
  return Math.random() < LARGE_ENEMY_CHANCE ? 'large' : 'normal';
}

export function spawnEnemy(type = rollEnemyType(), params = {}) {
  const enemy = createEnemy(type, params);
  state.enemies.push(enemy);
  return enemy;
}