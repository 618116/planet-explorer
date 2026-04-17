// Central mutable game state. Entity arrays, input snapshot, timers, flags.
export const state = {
  player: null,
  projectiles: [],
  particles: [],
  enemies: [],
  input: null,
  shakeAmount: 0,
  aimAngle: 0,
  godMode: false,
  charging: false,
  power: 0,
  gameOver: false,
  gameWon: false,
  gameStartTime: 0,
  lastEnemySpawn: 0,
  lastFrameTime: performance.now(),
  fpsSmooth: 60,
};
