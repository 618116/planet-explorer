// Large enemy: bigger, tougher, faster terrain-depositing enemy type.
import {
  ENEMY_H,
  ENEMY_W,
  ENEMY_HP,
  ENEMY_WALK_SPEED,
  LARGE_ENEMY_SIZE_MUL,
  LARGE_ENEMY_HP_MUL,
  LARGE_ENEMY_SPEED_MUL,
  LARGE_ENEMY_DEPOSIT_T,
  LARGE_ENEMY_DEPOSIT_H,
} from '../../config.js';
import { BaseEnemy } from './baseEnemy.js';

export class LargeEnemy extends BaseEnemy {
  constructor(angle) {
    super(angle, {
      type: 'large',
      isLarge: true,
      sizeW: ENEMY_W * LARGE_ENEMY_SIZE_MUL,
      sizeH: ENEMY_H * LARGE_ENEMY_SIZE_MUL,
      maxHp: ENEMY_HP * LARGE_ENEMY_HP_MUL,
      walkSpeed: ENEMY_WALK_SPEED * LARGE_ENEMY_SPEED_MUL,
      depositTLen: LARGE_ENEMY_DEPOSIT_T,
      depositHLen: LARGE_ENEMY_DEPOSIT_H,
      bodyColor: '#228822',
      eyeSize: 8,
      eyeOffset: 8,
      hpBarW: 60,
      hpBarH: 4,
      minimapColor: '#228822',
      minimapRadius: 4,
      hitRadius: (ENEMY_W * LARGE_ENEMY_SIZE_MUL) * 0.5,
    });
  }
}