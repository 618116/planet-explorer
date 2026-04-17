// Canvas, container scaling, HUD element refs, message overlay.
import { VW, VH } from './config.js';

export const container = document.getElementById('game-container');
container.style.width = VW + 'px';
container.style.height = VH + 'px';

export const canvas = document.getElementById('canvas');
canvas.width = VW;
canvas.height = VH;
export const ctx = canvas.getContext('2d');

const headerEl = document.getElementById('header');
const controlsEl = document.getElementById('controls');

function fitToScreen() {
  const scaleX = window.innerWidth / VW;
  // Reserve space for body padding-top (10px) and header (height + 8px margin-bottom)
  const headerH = headerEl.offsetHeight + 8;
  const scaleY = (window.innerHeight - 10 - headerH) / VH;
  const scale = Math.min(scaleX, scaleY, 1);

  container.style.transformOrigin = 'top center';
  container.style.transform = `scale(${scale})`;

  // Snap controls directly below the visually-scaled canvas
  controlsEl.style.marginTop = (VH * (scale - 1) + 8) + 'px';

  // Hide controls if remaining space below the canvas is too small
  const remainingH = window.innerHeight - 10 - headerH - VH * scale;
  controlsEl.style.visibility = remainingH >= controlsEl.offsetHeight + 8 ? 'visible' : 'hidden';
}
fitToScreen();
window.addEventListener('resize', fitToScreen);
window.addEventListener('orientationchange', fitToScreen);

export const hpLabel = document.getElementById('hpLabel');
export const fuelLabel = document.getElementById('fuelLabel');
export const shotsLabel = document.getElementById('shotsLabel');
export const zoomLabel = document.getElementById('zoomLabel');
export const terrainLabel = document.getElementById('terrainLabel');
export const powerBarContainer = document.getElementById('power-bar-container');
export const powerBar = document.getElementById('power-bar');
export const messageEl = document.getElementById('message');
export const timerEl = document.getElementById('timer');
export const godToggleEl = document.getElementById('godToggle');

export function showMessage(t, dur = 1500) {
  messageEl.textContent = t;
  messageEl.style.opacity = 1;
  setTimeout(() => messageEl.style.opacity = 0, dur);
}
