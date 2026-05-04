// Normal enemy: baseline surface-walking enemy type.
import { ENEMY_H, ENEMY_W, ENEMY_HP, ENEMY_WALK_SPEED } from '../../config.js';
import { BaseEnemy } from './baseEnemy.js';

export class NormalEnemy extends BaseEnemy {
  constructor(angle) {
    super(angle, {
      type: 'normal',
      isLarge: false,
      sizeW: ENEMY_W,
      sizeH: ENEMY_H,
      maxHp: ENEMY_HP,
      walkSpeed: ENEMY_WALK_SPEED,
      depositTLen: 3,
      depositHLen: 1,
      bodyColor: '#44cc44',
      eyeSize: 2,
      eyeOffset: 2,
      hpBarW: 14,
      hpBarH: 2,
      minimapColor: '#44cc44',
      minimapRadius: 2,
      hitRadius: 8,
    });
  }
}