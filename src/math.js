// Math utilities: noise, distance, angle lerp.
export function pseudoRand(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function valueNoise(x, freq, octaves, seed) {
  let val = 0, amp = 1, maxAmp = 0;
  for (let o = 0; o < octaves; o++) {
    const f = freq * (1 << o);
    const ix = Math.floor(x * f);
    const frac = (x * f) - ix;
    const smooth = frac * frac * (3 - 2 * frac);
    const a = pseudoRand(ix + seed + o * 10000);
    const b = pseudoRand(ix + 1 + seed + o * 10000);
    val += (a + (b - a) * smooth) * amp;
    maxAmp += amp; amp *= 0.5;
  }
  return val / maxAmp;
}

export function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Shortest-path angle lerp.
export function lerpAngle(from, to, t) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}
