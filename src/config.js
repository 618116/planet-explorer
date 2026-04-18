// Game constants.
export const PHYSICS_HZ = 60;
export const DT_MS = 1000 / PHYSICS_HZ;
export const MAX_PHYSICS_STEPS = 5;

export const VW = 900, VH = 640;
export const WORLD_W = 1600, WORLD_H = 1600;
export const CX = WORLD_W / 2, CY = WORLD_H / 2;
export const BASE_RADIUS = 320;
export const SURFACE_NOISE = 55;
export const CORE_RADIUS = 50;
export const GRAVITY = 0.13;
export const PLAYER_H = 14, PLAYER_W = 8;
export const WALK_FORCE = 0.28;
export const THRUST_FORCE = 0.38;
export const MAX_FUEL = 100;
export const FUEL_USE = 0.45;
export const FUEL_REGEN = 0.35;
export const EXPLOSION_RADIUS = 38;
export const MAX_POWER = 18;
export const PARTICLE_COUNT = 35;
export const TERRAIN_FALL_SPEED = 2.8;
export const MIN_CHUNK_SIZE = 4;
export const THRUST_WEAKEN_START = BASE_RADIUS + SURFACE_NOISE + 60;
export const THRUST_WEAKEN_END = WORLD_W * 0.48;
export const GAME_TIME = 60;
export const WIN_TERRAIN_PCT = 5;

export const ENEMY_H = 7, ENEMY_W = 4;
export const ENEMY_HP = 50;
export const ENEMY_WALK_SPEED = 0.15;
export const ENEMY_INITIAL_COUNT = 10;
export const ENEMY_SPAWN_INTERVAL = 5000;
export const ENEMY_DIR_CHANGE_MIN = 5000;
export const ENEMY_DIR_CHANGE_MAX = 12000;
export const ENEMY_DEPOSIT_RATE = 5;

export const LARGE_ENEMY_CHANCE = 0.3;
export const LARGE_ENEMY_SIZE_MUL = 5;
export const LARGE_ENEMY_HP_MUL = 3;
export const LARGE_ENEMY_SPEED_MUL = 2;
export const LARGE_ENEMY_DEPOSIT_T = 10;
export const LARGE_ENEMY_DEPOSIT_H = 4;
