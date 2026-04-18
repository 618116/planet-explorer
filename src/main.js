// Entry: initGame, fixed-timestep loop, HUD, fire, god-mode toggle.
import {
  VW, VH, CX, CY, GAME_TIME, WIN_TERRAIN_PCT, MAX_POWER, MAX_FUEL,
  WALK_FORCE, THRUST_FORCE, FUEL_USE,
  THRUST_WEAKEN_START, THRUST_WEAKEN_END,
  ENEMY_INITIAL_COUNT, ENEMY_SPAWN_INTERVAL,
  DT_MS, MAX_PHYSICS_STEPS,
} from './config.js';
import {
  ctx, hpLabel, fuelLabel, shotsLabel, zoomLabel, terrainLabel,
  powerBarContainer, powerBar, timerEl, godToggleEl, showMessage,
} from './dom.js';
import { dist } from './math.js';
import { state } from './state.js';
import { camera, updateCamera, applyCam, screenToWorld } from './camera.js';
import {
  generateTerrain, renderBackground, getTerrainPct, bgOff, terrOff,
} from './terrain/heightmap.js';
import {
  fallingChunks, resetFalling, detectFloatingTerrain,
  getPendingFloat, clearPendingFloat,
} from './terrain/falling.js';
import { Player } from './entities/player.js';
import { Projectile } from './entities/projectile.js';
import { Particle } from './entities/particle.js';
import { spawnEnemy } from './entities/enemy.js';
import { installInput, pollInput } from './input.js';
import { drawMinimap } from './minimap.js';

let accumulator = 0;
let lastFrameStart = performance.now();

function fire() {
  const p = state.player;
  const a = state.aimAngle;
  const startX = p.x + Math.cos(a) * 18;
  const startY = p.y + Math.sin(a) * 18;
  state.projectiles.push(new Projectile(startX, startY, Math.cos(a) * state.power, Math.sin(a) * state.power));
  p.shots++;
  p.vx -= Math.cos(a) * state.power * 0.08;
  p.vy -= Math.sin(a) * state.power * 0.08;
}

function toggleGodMode() {
  state.godMode = !state.godMode;
  godToggleEl.textContent = state.godMode ? 'GOD: ON' : 'GOD: OFF';
  godToggleEl.style.color = state.godMode ? '#feca57' : '#576574';
  godToggleEl.style.borderColor = state.godMode ? '#feca57' : '#333';
  if (state.godMode && state.player) state.player.hp = 100;
  showMessage(state.godMode ? 'GOD MODE ON' : 'GOD MODE OFF', 1000);
}

function initGame() {
  generateTerrain();
  renderBackground();
  state.player = new Player(-Math.PI / 2);
  state.projectiles = [];
  state.particles = [];
  state.enemies = [];
  resetFalling();
  state.charging = false;
  state.power = 0;
  camera.x = state.player.x;
  camera.y = state.player.y;
  camera.zoom = 1.2;
  camera.rot = -(state.player.surfAngle + Math.PI / 2);
  state.shakeAmount = 0;
  for (let i = 0; i < ENEMY_INITIAL_COUNT; i++) spawnEnemy();
  state.lastEnemySpawn = Date.now();
  state.gameStartTime = performance.now();
  state.gameOver = false;
  state.gameWon = false;
  timerEl.textContent = Math.floor(GAME_TIME / 60) + ':' + ((GAME_TIME % 60) < 10 ? '0' : '') + (GAME_TIME % 60);
  timerEl.style.color = '#48dbfb';
  showMessage('Destroy terrain below ' + WIN_TERRAIN_PCT + '%!', 2000);
  accumulator = 0;
  lastFrameStart = performance.now();
}

// Runs at a fixed 60Hz rate regardless of render frame rate.
// consumeEdges is true only for the first tick of a frame so
// just-pressed/just-released events fire exactly once.
function fixedUpdate(input, consumeEdges) {
  const player = state.player;
  if (!player) return;

  if (!state.gameOver) {
    const elapsed = (performance.now() - state.gameStartTime) / 1000;
    const remaining = Math.max(0, GAME_TIME - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    timerEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    timerEl.style.color = remaining <= 10 ? '#e74c3c' : '#48dbfb';
    if (getTerrainPct() <= WIN_TERRAIN_PCT) {
      state.gameOver = true;
      state.gameWon = true;
      const timeUsed = GAME_TIME - remaining;
      showMessage('YOU WIN! ' + Math.round(timeUsed) + 's', 9999);
      timerEl.style.color = '#2ecc71';
    } else if (remaining <= 0) {
      state.gameOver = true;
      state.gameWon = false;
      showMessage('TIME UP – YOU LOSE!', 9999);
      timerEl.textContent = '0:00';
      timerEl.style.color = '#e74c3c';
    }
  }

  const canAct = player.hp > 0 && !state.gameOver;

  if (consumeEdges) {
    if (input.fire.justPressed && canAct) {
      state.charging = true;
      state.power = 0;
      powerBarContainer.style.display = 'block';
    }
    if (input.fire.justReleased && state.charging) {
      state.charging = false;
      if (state.power > 1) fire();
      powerBarContainer.style.display = 'none';
      state.power = 0;
    }
  }

  if (canAct) {
    const θ = player.surfAngle;
    const airMul = player.onGround ? 1.0 : 0.4;
    if (input.walk < 0) {
      const ta = θ - Math.PI / 2;
      player.vx += Math.cos(ta) * WALK_FORCE * airMul;
      player.vy += Math.sin(ta) * WALK_FORCE * airMul;
    }
    if (input.walk > 0) {
      const ta = θ + Math.PI / 2;
      player.vx += Math.cos(ta) * WALK_FORCE * airMul;
      player.vy += Math.sin(ta) * WALK_FORCE * airMul;
    }
    if (input.thrust && player.fuel > 0) {
      const outX = Math.cos(θ), outY = Math.sin(θ);
      const altitude = dist(player.x, player.y, CX, CY);
      let thrustMul = 1.0;
      if (altitude > THRUST_WEAKEN_START) {
        thrustMul = Math.max(0, 1 - (altitude - THRUST_WEAKEN_START) / (THRUST_WEAKEN_END - THRUST_WEAKEN_START));
      }
      const thrust = THRUST_FORCE * thrustMul;
      player.vx += outX * thrust;
      player.vy += outY * thrust;
      player.fuel = Math.max(0, player.fuel - FUEL_USE);
      player.thrusting = true;
      player.onGround = false;
      if (Math.random() < 0.6 * Math.max(0.15, thrustMul)) {
        const px = player.x - outX * 2 + (Math.random() - 0.5) * 4;
        const py = player.y - outY * 2 + (Math.random() - 0.5) * 4;
        state.particles.push(new Particle(px, py, 'thrust'));
      }
    }
  }

  if (state.charging) {
    state.power = Math.min(MAX_POWER, state.power + 0.3);
    powerBar.style.width = (state.power / MAX_POWER * 100) + '%';
  }

  if (player.hp > 0) player.update();
  if (state.godMode) { player.hp = 100; player.fuel = MAX_FUEL; }

  for (const p of state.projectiles) if (p.alive) p.update();
  state.projectiles = state.projectiles.filter(p => p.alive || p.age < 300);

  for (const p of state.particles) p.update();
  state.particles = state.particles.filter(p => p.life > 0);

  for (const e of state.enemies) if (e.hp > 0) e.update();
  state.enemies = state.enemies.filter(e => e.hp > 0);
  if (Date.now() - state.lastEnemySpawn >= ENEMY_SPAWN_INTERVAL) {
    spawnEnemy();
    state.lastEnemySpawn = Date.now();
  }

  let anyChunkActive = false;
  for (const c of fallingChunks) { c.update(); if (!c.settled) anyChunkActive = true; }
  for (let i = fallingChunks.length - 1; i >= 0; i--) {
    if (fallingChunks[i].settled) fallingChunks.splice(i, 1);
  }

  if (getPendingFloat() && !anyChunkActive) {
    clearPendingFloat();
    detectFloatingTerrain();
  }

  if (player.hp > 0) {
    const targetRot = -(player.surfAngle + Math.PI / 2);
    updateCamera(player.x, player.y, targetRot);
  }

  state.shakeAmount *= 0.9;
  if (state.shakeAmount < 0.1) state.shakeAmount = 0;
}

function render(alpha) {
  const player = state.player;
  if (!player) return;

  const sx = (Math.random() - 0.5) * state.shakeAmount;
  const sy = (Math.random() - 0.5) * state.shakeAmount;

  hpLabel.textContent = player.hp;
  fuelLabel.textContent = Math.round(player.fuel);
  fuelLabel.style.color = player.fuel > 30 ? '#48dbfb' : '#ff9f43';
  shotsLabel.textContent = player.shots;
  zoomLabel.textContent = camera.zoom.toFixed(1) + 'x';
  terrainLabel.textContent = getTerrainPct() + '%';

  ctx.clearRect(0, 0, VW, VH);
  ctx.fillStyle = '#030308';
  ctx.fillRect(0, 0, VW, VH);

  ctx.save();
  ctx.translate(sx, sy);
  applyCam();

  ctx.drawImage(bgOff, 0, 0);
  ctx.drawImage(terrOff, 0, 0);

  for (const c of fallingChunks) c.draw(ctx, alpha);
  for (const p of state.projectiles) if (p.alive) p.draw(ctx, alpha);
  for (const p of state.particles) p.draw(ctx, alpha);
  for (const e of state.enemies) e.draw(ctx, alpha);
  if (player.hp > 0) player.draw(ctx, state.aimAngle, alpha);

  if (player.hp <= 0) {
    ctx.fillStyle = 'rgba(255,50,50,0.3)';
    ctx.beginPath(); ctx.arc(player.x, player.y, 20, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();

  drawMinimap();

  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(Math.round(state.fpsSmooth) + ' FPS', 10, VH - 10);
}

function gameLoop() {
  requestAnimationFrame(gameLoop);
  const now = performance.now();
  let frameTime = now - lastFrameStart;
  if (frameTime > 250) frameTime = 250;
  lastFrameStart = now;

  const fps = 1000 / Math.max(1, frameTime);
  state.fpsSmooth += (fps - state.fpsSmooth) * 0.05;
  state.lastFrameTime = now;

  const player = state.player;
  if (!player) return;

  const input = pollInput(camera.rot);
  state.input = input;

  if (input.aim.active) {
    state.aimAngle = input.aim.angle;
  } else {
    const w = screenToWorld(input.aim.mouseX, input.aim.mouseY);
    state.aimAngle = Math.atan2(w.y - player.y, w.x - player.x);
  }

  accumulator += frameTime;
  let steps = 0;
  let consumeEdges = true;
  while (accumulator >= DT_MS && steps < MAX_PHYSICS_STEPS) {
    fixedUpdate(input, consumeEdges);
    consumeEdges = false;
    accumulator -= DT_MS;
    steps++;
  }
  if (steps === MAX_PHYSICS_STEPS) accumulator = 0;

  const alpha = Math.min(1, accumulator / DT_MS);
  render(alpha);
}

installInput({ onReset: initGame, onGodToggle: toggleGodMode });
initGame();
gameLoop();
