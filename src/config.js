// Game constants.
// All physics values are in per-second units unless noted otherwise.
// REF_HZ is the reference rate that the original per-tick values were tuned for.
// Changing PHYSICS_HZ adjusts simulation granularity without altering gameplay.
export const REF_HZ = 60;
export const PHYSICS_HZ = 60;
export const DT = 1 / PHYSICS_HZ;
export const DT_MS = 1000 / PHYSICS_HZ;
export const MAX_PHYSICS_STEPS = 5;

export const VW = 900, VH = 640;
export const WORLD_W = 1600, WORLD_H = 1600;
export const CX = WORLD_W / 2, CY = WORLD_H / 2;
export const BASE_RADIUS = 320;
export const SURFACE_NOISE = 55;
export const CORE_RADIUS = 50;
export const GRAVITY = 7.8;                // px/s²  (was 0.13/tick)
export const PLAYER_H = 14, PLAYER_W = 8;
export const WALK_FORCE = 16.8;            // px/s²  (was 0.28/tick)
export const THRUST_FORCE = 22.8;          // px/s²  (was 0.38/tick)
export const MAX_FUEL = 100;
export const FUEL_USE = 27.0;              // units/s (was 0.45/tick)
export const FUEL_REGEN = 21.0;            // units/s (was 0.35/tick)
export const EXPLOSION_RADIUS = 38;
export const MAX_POWER = 18;
export const PARTICLE_COUNT = 35;
export const TERRAIN_FALL_SPEED = 2.8;     // px/tick max fall speed
export const CHUNK_GRAVITY = 21.0;         // px/s²  (was 0.35/tick)
export const MIN_CHUNK_SIZE = 4;
export const THRUST_WEAKEN_START = BASE_RADIUS + SURFACE_NOISE + 60;
export const THRUST_WEAKEN_END = WORLD_W * 0.48;
export const GAME_TIME = 60;
export const WIN_TERRAIN_PCT = 5;

// Damping factors (per-tick at REF_HZ; applied via Math.pow(f, dt*REF_HZ))
export const GROUND_DAMPING = 0.82;
export const AIR_DAMPING = 0.995;
export const PARTICLE_DAMPING = 0.98;

export const ENEMY_H = 7, ENEMY_W = 4;
export const ENEMY_HP = 50;
export const ENEMY_WALK_SPEED = 9.0;       // px/s²  (was 0.15/tick)
export const ENEMY_INITIAL_COUNT = 10;
export const ENEMY_SPAWN_INTERVAL = 5000;
export const ENEMY_DIR_CHANGE_MIN = 5000;
export const ENEMY_DIR_CHANGE_MAX = 12000;
export const ENEMY_DEPOSIT_INTERVAL = 5 / REF_HZ; // seconds (was 5 ticks)

export const LARGE_ENEMY_CHANCE = 0.3;
export const LARGE_ENEMY_SIZE_MUL = 5;
export const LARGE_ENEMY_HP_MUL = 3;
export const LARGE_ENEMY_SPEED_MUL = 2;
export const LARGE_ENEMY_DEPOSIT_T = 10;
export const LARGE_ENEMY_DEPOSIT_H = 4;
