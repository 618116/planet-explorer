// Canvas, container scaling, HUD element refs, message overlay.
import { VW, VH } from './config.js';

export const container = document.getElementById('game-container');
container.style.width = VW + 'px';
container.style.height = VH + 'px';

export const canvas = document.getElementById('canvas');
canvas.width = VW;
canvas.height = VH;
export const ctx = canvas.getContext('2d');

function fitToScreen() {
  const scaleX = window.innerWidth / VW;
  const scaleY = window.innerHeight / VH;
  const scale = Math.min(scaleX, scaleY, 1);
  const scaledW = VW * scale;
  const scaledH = VH * scale;
  const left = (window.innerWidth - scaledW) / 2;
  const top = (window.innerHeight - scaledH) / 2;
  container.style.position = 'fixed';
  container.style.left = left + 'px';
  container.style.top = top + 'px';
  container.style.transformOrigin = '0 0';
  container.style.transform = `scale(${scale})`;
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
