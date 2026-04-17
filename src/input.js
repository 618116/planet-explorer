// Keyboard + mouse + gamepad + wheel. Per-frame snapshot consumed by main loop.
import { VW, VH } from './config.js';
import { canvas, godToggleEl } from './dom.js';
import { adjustZoom } from './camera.js';

const keys = {};
let mouseX = VW / 2, mouseY = VH / 2;
let mouseDown = false;
let gamepadIndex = null;
let firePrevDown = false;

const handlers = { onReset: null, onGodToggle: null };

export function installInput(opts) {
  Object.assign(handlers, opts);

  godToggleEl.addEventListener('click', () => handlers.onGodToggle?.());

  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'r') handlers.onReset?.();
    if (e.key.toLowerCase() === 'g') handlers.onGodToggle?.();
    if (e.key === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) * (VW / r.width);
    mouseY = (e.clientY - r.top) * (VH / r.height);
  });
  canvas.addEventListener('mousedown', e => { if (e.button === 0) mouseDown = true; });
  canvas.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
  canvas.addEventListener('wheel', e => {
    adjustZoom(e.deltaY > 0 ? -0.08 : 0.08);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('gamepadconnected', e => { gamepadIndex = e.gamepad.index; });
  window.addEventListener('gamepaddisconnected', e => {
    if (e.gamepad.index === gamepadIndex) gamepadIndex = null;
  });
}

export function pollInput(camRot) {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = gamepadIndex !== null ? gamepads[gamepadIndex] : null;
  if (!gp) {
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) { gamepadIndex = i; gp = gamepads[i]; break; }
    }
  }

  let gpLeft = false, gpRight = false, gpUp = false;
  let gpAimActive = false, gpAimAngle = 0;
  let rtPressed = false;

  if (gp) {
    const DEAD = 0.15;
    const { buttons, axes } = gp;

    const lx = axes[0] ?? 0;
    gpLeft = lx < -DEAD;
    gpRight = lx > DEAD;

    gpUp = (buttons[6]?.pressed) || (axes[4] ?? 0) > 0.1;

    const rx = axes[2] ?? 0, ry = axes[3] ?? 0;
    if (Math.sqrt(rx * rx + ry * ry) > DEAD) {
      gpAimActive = true;
      gpAimAngle = Math.atan2(ry, rx) - camRot;
    }

    rtPressed = buttons[7]?.pressed ?? false;

    if (buttons[5]?.pressed) adjustZoom(0.04);
    if (buttons[4]?.pressed) adjustZoom(-0.04);

    if (buttons[9]?.pressed && !gp._prevStart) handlers.onReset?.();
    if (buttons[8]?.pressed && !gp._prevBack) handlers.onGodToggle?.();
    gp._prevStart = buttons[9]?.pressed ?? false;
    gp._prevBack = buttons[8]?.pressed ?? false;
  }

  let walk = 0;
  if (keys['a'] || gpLeft) walk -= 1;
  if (keys['d'] || gpRight) walk += 1;

  const thrust = !!(keys['w'] || gpUp);

  const fireDown = mouseDown || rtPressed;
  const fire = {
    down: fireDown,
    justPressed: fireDown && !firePrevDown,
    justReleased: !fireDown && firePrevDown,
  };
  firePrevDown = fireDown;

  const aim = gpAimActive
    ? { active: true, angle: gpAimAngle, source: 'pad' }
    : { active: false, mouseX, mouseY, source: 'mouse' };

  return { walk, thrust, aim, fire };
}
