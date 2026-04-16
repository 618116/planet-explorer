// ═══════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════
const VW = 900, VH = 640;                // viewport size
const WORLD_W = 1600, WORLD_H = 1600;    // world size
const CX = WORLD_W / 2, CY = WORLD_H / 2;
const BASE_RADIUS = 320;
const SURFACE_NOISE = 55;
const CORE_RADIUS = 50;
const GRAVITY = 0.13;
const PLAYER_H = 14, PLAYER_W = 8;
const WALK_FORCE = 0.28;
const THRUST_FORCE = 0.38;
const MAX_FUEL = 100;
const FUEL_USE = 0.45;
const FUEL_REGEN = 0.35;
const EXPLOSION_RADIUS = 38;
const MAX_POWER = 18;
const PARTICLE_COUNT = 35;
const TERRAIN_FALL_SPEED = 2.8;
const MIN_CHUNK_SIZE = 4;
const THRUST_WEAKEN_START = BASE_RADIUS + SURFACE_NOISE + 60;   // altitude where thrust begins to fade
const THRUST_WEAKEN_END   = WORLD_W * 0.48;                     // altitude where thrust reaches zero
const GAME_TIME = 60;                    // seconds on the clock
const WIN_TERRAIN_PCT = 5;               // terrain % to reach for victory

// ─── Enemy Config ─────────────────────────────────────────────
const ENEMY_H = 7, ENEMY_W = 4;             // half of player
const ENEMY_HP = 50;                          // half of player HP
const ENEMY_WALK_SPEED = 0.15;               // surface walk force
const ENEMY_INITIAL_COUNT = 10;              // spawn at game start
const ENEMY_SPAWN_INTERVAL = 5000;           // ms between spawns
const ENEMY_DIR_CHANGE_MIN = 5000;           // min ms before direction flip
const ENEMY_DIR_CHANGE_MAX = 12000;          // max ms before direction flip
const ENEMY_DEPOSIT_RATE = 5;                // deposit terrain every N frames

// ─── Large Enemy Config ──────────────────────────────────────
const LARGE_ENEMY_CHANCE = 0.3;              // 30% chance to spawn large
const LARGE_ENEMY_SIZE_MUL = 5;             // 5x body dimensions
const LARGE_ENEMY_HP_MUL = 3;              // 3x HP
const LARGE_ENEMY_SPEED_MUL = 2;             // 2x walk speed
const LARGE_ENEMY_DEPOSIT_T = 10;            // trail length (normal: 3)
const LARGE_ENEMY_DEPOSIT_H = 4;             // trail half-width (normal: 1) → 10*9=90 ≈ 10x terrain

// ═══════════════════════════════════════════════════════════════
//  CANVAS (single canvas, camera transforms everything)
// ═══════════════════════════════════════════════════════════════
const container = document.getElementById('game-container');
container.style.width = VW + 'px'; container.style.height = VH + 'px';

const canvas = document.getElementById('canvas');
canvas.width = VW; canvas.height = VH;
const ctx = canvas.getContext('2d');

function fitToScreen() {
  const scaleX = window.innerWidth  / VW;
  const scaleY = window.innerHeight / VH;
  const scale  = Math.min(scaleX, scaleY, 1);
  const scaledW = VW * scale;
  const scaledH = VH * scale;
  const left = (window.innerWidth  - scaledW) / 2;
  const top  = (window.innerHeight - scaledH) / 2;
  container.style.position        = 'fixed';
  container.style.left            = left + 'px';
  container.style.top             = top  + 'px';
  container.style.transformOrigin = '0 0';
  container.style.transform       = `scale(${scale})`;
}
fitToScreen();
window.addEventListener('resize',            fitToScreen);
window.addEventListener('orientationchange', fitToScreen);

// Off-screen canvases for terrain and background
const bgOff = document.createElement('canvas');
bgOff.width = WORLD_W; bgOff.height = WORLD_H;
const bgCtx = bgOff.getContext('2d');

const terrOff = document.createElement('canvas');
terrOff.width = WORLD_W; terrOff.height = WORLD_H;
const terrCtx = terrOff.getContext('2d');

// ═══════════════════════════════════════════════════════════════
//  CAMERA
// ═══════════════════════════════════════════════════════════════
let camX = CX, camY = CY;
let camZoom = 1.0;
let camRot = 0;   // current camera rotation (radians)
const CAM_SMOOTH = 0.08;
const CAM_ROT_SMOOTH = 0.07;
const MIN_ZOOM = 0.35, MAX_ZOOM = 2.5;

// Shortest-path angle lerp
function lerpAngle(from, to, t) {
  let diff = to - from;
  // Wrap to [-π, π]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

function updateCamera(targetX, targetY, targetRot) {
  camX += (targetX - camX) * CAM_SMOOTH;
  camY += (targetY - camY) * CAM_SMOOTH;
  camRot = lerpAngle(camRot, targetRot, CAM_ROT_SMOOTH);
}

function applyCam() {
  ctx.translate(VW / 2, VH / 2);
  ctx.rotate(camRot);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-camX, -camY);
}

// Screen → World (accounts for rotation + zoom)
function screenToWorld(sx, sy) {
  // Offset from screen center
  const dx = (sx - VW / 2);
  const dy = (sy - VH / 2);
  // Undo rotation
  const cosR = Math.cos(-camRot);
  const sinR = Math.sin(-camRot);
  const rx = dx * cosR - dy * sinR;
  const ry = dx * sinR + dy * cosR;
  // Undo zoom + translate
  return {
    x: rx / camZoom + camX,
    y: ry / camZoom + camY,
  };
}

// ═══════════════════════════════════════════════════════════════
//  TERRAIN DATA
// ═══════════════════════════════════════════════════════════════
let terrain  = new Uint8Array(WORLD_W * WORLD_H);
let terrainR = new Uint8Array(WORLD_W * WORLD_H);
let terrainG = new Uint8Array(WORLD_W * WORLD_H);
let terrainB = new Uint8Array(WORLD_W * WORLD_H);

const ANGLE_STEPS = 7200;
let surfaceRadii = new Float32Array(ANGLE_STEPS);

// ─── Noise / helpers ──────────────────────────────────────────
function pseudoRand(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function valueNoise(x, freq, octaves, seed) {
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
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
}
function isSolid(x, y) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return false;
  return terrain[y * WORLD_W + x] === 1;
}
function gravityAt(x, y) {
  const dx = CX - x, dy = CY - y;
  const d = Math.sqrt(dx*dx + dy*dy);
  if (d < 1) return { gx: 0, gy: 0 };
  return { gx: (dx/d) * GRAVITY, gy: (dy/d) * GRAVITY };
}
function getSurfaceRadius(angle) {
  let a = ((angle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
  return surfaceRadii[(a / (Math.PI*2) * ANGLE_STEPS) | 0];
}

// ═══════════════════════════════════════════════════════════════
//  TERRAIN GENERATION
// ═══════════════════════════════════════════════════════════════
function carveCircle(cx, cy, radius) {
  const r2 = radius * radius;
  const cr2 = CORE_RADIUS * CORE_RADIUS;
  const x0 = Math.max(0, (cx - radius) | 0);
  const x1 = Math.min(WORLD_W - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, (cy - radius) | 0);
  const y1 = Math.min(WORLD_H - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if ((x-cx)**2 + (y-cy)**2 < r2 && (x-CX)**2 + (y-CY)**2 >= cr2)
        terrain[y * WORLD_W + x] = 0;
    }
}

function computeColor(x, y) {
  const d = dist(x, y, CX, CY);
  const angle = Math.atan2(y - CY, x - CX);
  const sr = getSurfaceRadius(angle);
  const depth = sr - d;
  const n1 = pseudoRand(x * 0.07 + y * 0.07);
  const n2 = pseudoRand(x * 0.13 + y * 0.11);

  if (depth < 3) return [55 + n1*40|0, 140 + n2*50|0, 45];
  if (depth < 25) {
    const t = (depth-3)/22;
    return [145 - t*40 + n1*15|0, 95 - t*25 + n2*10|0, 45];
  }
  if (d < CORE_RADIUS + 18) return [180 + n1*60|0, 60 + n2*50|0, 15 + n1*20|0];
  const n = n1 * 25;
  return [78+n|0, 72+n|0, 62+n|0];
}

function rebuildColors() {
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++) {
      const i = y * WORLD_W + x;
      if (terrain[i]) {
        const [r,g,b] = computeColor(x,y);
        terrainR[i]=r; terrainG[i]=g; terrainB[i]=b;
      }
    }
}
function rebuildColorsRect(x0,y0,x1,y1) {
  x0=Math.max(0,x0); y0=Math.max(0,y0);
  x1=Math.min(WORLD_W-1,x1); y1=Math.min(WORLD_H-1,y1);
  for (let y=y0;y<=y1;y++)
    for (let x=x0;x<=x1;x++) {
      const i=y*WORLD_W+x;
      if (terrain[i]) { const [r,g,b]=computeColor(x,y); terrainR[i]=r;terrainG[i]=g;terrainB[i]=b; }
    }
}
function blitTerrain() {
  const img = terrCtx.createImageData(WORLD_W, WORLD_H);
  const d = img.data;
  for (let i=0,j=0; i<WORLD_W*WORLD_H; i++,j+=4) {
    if (terrain[i]) { d[j]=terrainR[i]; d[j+1]=terrainG[i]; d[j+2]=terrainB[i]; d[j+3]=255; }
  }
  terrCtx.putImageData(img, 0, 0);
}

function generateTerrain() {
  terrain.fill(0);
  const seed = Math.random() * 1000;
  for (let i = 0; i < ANGLE_STEPS; i++) {
    const a = (i / ANGLE_STEPS) * Math.PI * 2;
    const n = valueNoise(a / (Math.PI*2) + seed, 6, 5, seed);
    surfaceRadii[i] = BASE_RADIUS + (n - 0.5) * 2 * SURFACE_NOISE;
  }
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++) {
      const d = dist(x, y, CX, CY);
      const angle = Math.atan2(y-CY, x-CX);
      if (d < getSurfaceRadius(angle)) terrain[y*WORLD_W+x] = 1;
    }
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = BASE_RADIUS * (0.35 + Math.random() * 0.4);
    carveCircle(CX + Math.cos(a)*r, CY + Math.sin(a)*r, 22 + Math.random()*35);
  }
  rebuildColors();
  blitTerrain();
  initialTerrainCount=0;
  for(let i=0;i<WORLD_W*WORLD_H;i++) if(terrain[i]) initialTerrainCount++;
  currentTerrainCount=initialTerrainCount;
  terrainPctCache=100;
}

function recalcTerrainPercent(){
  currentTerrainCount=0;
  for(let i=0;i<WORLD_W*WORLD_H;i++) if(terrain[i]) currentTerrainCount++;
  terrainPctCache=initialTerrainCount>0 ? Math.round(currentTerrainCount/initialTerrainCount*100) : 100;
}

function depositTerrainPixel(x, y) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return false;
  const i = y * WORLD_W + x;
  if (terrain[i]) return false;
  if (dist(x, y, CX, CY) < CORE_RADIUS) return false;
  terrain[i] = 1;
  const [r,g,b] = computeColor(x, y);
  terrainR[i] = r; terrainG[i] = g; terrainB[i] = b;
  terrCtx.fillStyle = `rgb(${r},${g},${b})`;
  terrCtx.fillRect(x, y, 1, 1);
  currentTerrainCount++;
  terrainPctCache = Math.round(currentTerrainCount / initialTerrainCount * 100);
  return true;
}

// ─── Background ───────────────────────────────────────────────
function renderBackground() {
  // Space
  bgCtx.fillStyle = '#030308';
  bgCtx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Stars
  for (let i = 0; i < 500; i++) {
    const sx = Math.random()*WORLD_W, sy = Math.random()*WORLD_H;
    if (dist(sx,sy,CX,CY) < BASE_RADIUS + 80) continue;
    bgCtx.globalAlpha = 0.2 + Math.random()*0.8;
    bgCtx.fillStyle = Math.random()>0.9 ? '#aaccff' : Math.random()>0.8 ? '#ffddaa' : '#fff';
    bgCtx.beginPath(); bgCtx.arc(sx, sy, Math.random()*1.6, 0, Math.PI*2); bgCtx.fill();
  }
  bgCtx.globalAlpha = 1;

  // Nebula
  for (const [nx,ny,c] of [[0.15,0.2,'#6644aa'],[0.85,0.8,'#aa4466'],[0.5,0.1,'#446688']]) {
    bgCtx.globalAlpha = 0.035;
    const g = bgCtx.createRadialGradient(WORLD_W*nx,WORLD_H*ny,0,WORLD_W*nx,WORLD_H*ny,250);
    g.addColorStop(0,c); g.addColorStop(1,'transparent');
    bgCtx.fillStyle = g; bgCtx.fillRect(0,0,WORLD_W,WORLD_H);
  }
  bgCtx.globalAlpha = 1;

  // Atmosphere
  bgCtx.globalAlpha = 0.07;
  const atmo = bgCtx.createRadialGradient(CX,CY,BASE_RADIUS-15,CX,CY,BASE_RADIUS+60);
  atmo.addColorStop(0,'#55aaff'); atmo.addColorStop(0.6,'#3388cc'); atmo.addColorStop(1,'transparent');
  bgCtx.fillStyle = atmo;
  bgCtx.beginPath(); bgCtx.arc(CX,CY,BASE_RADIUS+60,0,Math.PI*2); bgCtx.fill();
  bgCtx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════
//  FALLING TERRAIN
// ═══════════════════════════════════════════════════════════════
const DX4=[1,-1,0,0], DY4=[0,0,1,-1];
let fallingChunks = [];
let pendingFloatCheck = false;

class FallingChunk {
  constructor(pixels) {
    let minX=WORLD_W, maxX=0, minY=WORLD_H, maxY=0;
    for (const p of pixels) {
      if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x;
      if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y;
    }
    this.originX=minX; this.originY=minY;
    this.w=maxX-minX+1; this.h=maxY-minY+1;
    this.grid=new Uint8Array(this.w*this.h);
    this.colR=new Uint8Array(this.w*this.h);
    this.colG=new Uint8Array(this.w*this.h);
    this.colB=new Uint8Array(this.w*this.h);
    let cmx=0,cmy=0,cnt=0;
    for (const p of pixels) {
      const lx=p.x-minX, ly=p.y-minY, li=ly*this.w+lx;
      this.grid[li]=1; this.colR[li]=p.r; this.colG[li]=p.g; this.colB[li]=p.b;
      cmx+=p.x; cmy+=p.y; cnt++;
    }
    this.cmx=cmx/cnt; this.cmy=cmy/cnt;
    this.offsetX=0; this.offsetY=0; this.vx=0; this.vy=0; this.settled=false;
  }
  update() {
    if (this.settled) return;
    const wx=this.cmx+this.offsetX, wy=this.cmy+this.offsetY;
    const dx=CX-wx, dy=CY-wy, d=Math.sqrt(dx*dx+dy*dy);
    if (d>1) { this.vx+=(dx/d)*0.35; this.vy+=(dy/d)*0.35; }
    const sp=Math.sqrt(this.vx*this.vx+this.vy*this.vy);
    if (sp>TERRAIN_FALL_SPEED) { this.vx=(this.vx/sp)*TERRAIN_FALL_SPEED; this.vy=(this.vy/sp)*TERRAIN_FALL_SPEED; }
    const steps=Math.max(1,Math.ceil(sp));
    const svx=this.vx/steps, svy=this.vy/steps;
    for (let s=0;s<steps;s++) {
      this.offsetX+=svx; this.offsetY+=svy;
      if (this._check()) { this.offsetX-=svx; this.offsetY-=svy; this._settle(); return; }
    }
    if (dist(wx,wy,CX,CY)>WORLD_W) this.settled=true;
  }
  _check() {
    const bx=Math.round(this.offsetX), by=Math.round(this.offsetY);
    for (let ly=0;ly<this.h;ly++) for (let lx=0;lx<this.w;lx++) {
      if (!this.grid[ly*this.w+lx]) continue;
      const wx=this.originX+lx+bx, wy=this.originY+ly+by;
      if (wx>=0&&wx<WORLD_W&&wy>=0&&wy<WORLD_H&&terrain[wy*WORLD_W+wx]) return true;
    }
    return false;
  }
  _settle() {
    this.settled=true;
    const bx=Math.round(this.offsetX), by=Math.round(this.offsetY);
    let rx0=WORLD_W,ry0=WORLD_H,rx1=0,ry1=0;
    for (let ly=0;ly<this.h;ly++) for (let lx=0;lx<this.w;lx++) {
      const li=ly*this.w+lx; if(!this.grid[li])continue;
      const wx=this.originX+lx+bx, wy=this.originY+ly+by;
      if(wx<0||wx>=WORLD_W||wy<0||wy>=WORLD_H)continue;
      const wi=wy*WORLD_W+wx;
      terrain[wi]=1; terrainR[wi]=this.colR[li]; terrainG[wi]=this.colG[li]; terrainB[wi]=this.colB[li];
      if(wx<rx0)rx0=wx; if(wx>rx1)rx1=wx; if(wy<ry0)ry0=wy; if(wy>ry1)ry1=wy;
    }
    rebuildColorsRect(rx0-2,ry0-4,rx1+2,ry1+4);
    blitTerrain();
    pendingFloatCheck=true;
  }
  draw(ctx) {
    if (this.settled) return;
    const bx=Math.round(this.offsetX), by=Math.round(this.offsetY);
    for (let ly=0;ly<this.h;ly++) for (let lx=0;lx<this.w;lx++) {
      const li=ly*this.w+lx; if(!this.grid[li])continue;
      ctx.fillStyle=`rgb(${this.colR[li]},${this.colG[li]},${this.colB[li]})`;
      ctx.fillRect(this.originX+lx+bx, this.originY+ly+by, 1, 1);
    }
  }
}

function detectFloatingTerrain() {
  const grounded=new Uint8Array(WORLD_W*WORLD_H);
  const queue=new Int32Array(WORLD_W*WORLD_H*2);
  let qH=0,qT=0;
  const cr=CORE_RADIUS;
  for (let y=Math.max(0,CY-cr|0);y<=Math.min(WORLD_H-1,CY+cr|0);y++)
    for (let x=Math.max(0,CX-cr|0);x<=Math.min(WORLD_W-1,CX+cr|0);x++) {
      if (dist(x,y,CX,CY)<=cr) { const i=y*WORLD_W+x; if(terrain[i]&&!grounded[i]){grounded[i]=1;queue[qT++]=x;queue[qT++]=y;}}
    }
  while(qH<qT){
    const qx=queue[qH++],qy=queue[qH++];
    for(let d=0;d<4;d++){
      const nx=qx+DX4[d],ny=qy+DY4[d];
      if(nx<0||nx>=WORLD_W||ny<0||ny>=WORLD_H)continue;
      const ni=ny*WORLD_W+nx;
      if(terrain[ni]&&!grounded[ni]){grounded[ni]=1;queue[qT++]=nx;queue[qT++]=ny;}
    }
  }
  const visited=new Uint8Array(WORLD_W*WORLD_H);
  let found=false;
  for(let y=0;y<WORLD_H;y++) for(let x=0;x<WORLD_W;x++){
    const i=y*WORLD_W+x;
    if(!terrain[i]||grounded[i]||visited[i])continue;
    const px=[];const cq=[x,y];visited[i]=1;let ch=0;
    while(ch<cq.length){
      const cx=cq[ch++],cy=cq[ch++],ci=cy*WORLD_W+cx;
      px.push({x:cx,y:cy,r:terrainR[ci],g:terrainG[ci],b:terrainB[ci]});
      terrain[ci]=0;
      for(let d=0;d<4;d++){
        const nx=cx+DX4[d],ny=cy+DY4[d];
        if(nx<0||nx>=WORLD_W||ny<0||ny>=WORLD_H)continue;
        const ni=ny*WORLD_W+nx;
        if(terrain[ni]&&!grounded[ni]&&!visited[ni]){visited[ni]=1;cq.push(nx,ny);}
      }
    }
    if(px.length>=MIN_CHUNK_SIZE){fallingChunks.push(new FallingChunk(px));found=true;}
  }
  if(found)blitTerrain();
}

function carveTerrain(cx,cy,radius) {
  carveCircle(cx,cy,radius); blitTerrain();
  setTimeout(()=>detectFloatingTerrain(),60);
}

// ═══════════════════════════════════════════════════════════════
//  PLAYER (real-time, single player)
// ═══════════════════════════════════════════════════════════════
class Player {
  constructor(angle) {
    this.hp = 100; this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.shots = 0;
    this.fuel = MAX_FUEL;
    this.thrusting = false;
    this._placeAtAngle(angle);
  }
  _placeAtAngle(angle) {
    const sr = getSurfaceRadius(angle);
    for (let r = sr + 20; r > 0; r--) {
      const px = CX + Math.cos(angle)*r, py = CY + Math.sin(angle)*r;
      if (isSolid(px, py)) { this.x=CX+Math.cos(angle)*(r+2); this.y=CY+Math.sin(angle)*(r+2); return; }
    }
    this.x=CX+Math.cos(angle)*(sr+2); this.y=CY+Math.sin(angle)*(sr+2);
  }
  get surfAngle() { return Math.atan2(this.y-CY, this.x-CX); }

  update() {
    const {gx,gy}=gravityAt(this.x,this.y);
    this.vx+=gx; this.vy+=gy;
    this.x+=this.vx; this.y+=this.vy;

    this.onGround=false;
    const θ=this.surfAngle;
    const outX=Math.cos(θ), outY=Math.sin(θ);

    if (isSolid(this.x, this.y)) {
      for(let i=0;i<30;i++){this.x+=outX;this.y+=outY;if(!isSolid(this.x,this.y))break;}
      this.onGround=true;
      const inDot=this.vx*(-outX)+this.vy*(-outY);
      if(inDot>0){this.vx+=outX*inDot;this.vy+=outY*inDot;}
    }
    if(!this.onGround){
      if(isSolid(this.x-outX*2, this.y-outY*2)) this.onGround=true;
    }

    // Body collision
    for(let t=0;t<PLAYER_H;t+=3){
      const bx=this.x+outX*t, by=this.y+outY*t;
      const tx=-outY, ty=outX;
      for(let side=-1;side<=1;side+=2){
        if(isSolid(bx+tx*PLAYER_W/2*side, by+ty*PLAYER_W/2*side)){
          this.x-=tx*side*0.5; this.y-=ty*side*0.5;
          const td=this.vx*tx*side+this.vy*ty*side;
          if(td>0){this.vx-=tx*side*td*0.5;this.vy-=ty*side*td*0.5;}
        }
      }
    }

    if(this.onGround){this.vx*=0.82;this.vy*=0.82;}
    else{this.vx*=0.995;this.vy*=0.995;}
    if(!this.thrusting){this.fuel=Math.min(MAX_FUEL,this.fuel+FUEL_REGEN);}
    this.thrusting=false;
  }

  draw(ctx, aimWorldAngle) {
    const θ=this.surfAngle;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(θ + Math.PI/2);

    // Thruster flame
    if(this.thrusting) {
      const flicker = Math.random() * 6;
      const flameH = 8 + flicker;
      // Outer flame (orange)
      ctx.fillStyle = `rgba(255,${140+Math.random()*60|0},0,${0.5+Math.random()*0.3})`;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.lineTo(Math.random()*2-1, flameH);
      ctx.closePath();
      ctx.fill();
      // Inner flame (yellow-white)
      ctx.fillStyle = `rgba(255,${220+Math.random()*35|0},${150+Math.random()*60|0},${0.6+Math.random()*0.3})`;
      ctx.beginPath();
      ctx.moveTo(-1.5, 0);
      ctx.lineTo(1.5, 0);
      ctx.lineTo(Math.random()*1-0.5, flameH*0.55);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle='#ff6b6b';
    ctx.fillRect(-PLAYER_W/2, -PLAYER_H, PLAYER_W, PLAYER_H);

    // Face toward aim
    const localAim = aimWorldAngle - θ;
    const facingRight = Math.sin(localAim) > 0;
    ctx.fillStyle='#fff';
    ctx.fillRect(facingRight?1:-3, -PLAYER_H+3, 3, 3);

    // HP bar
    const hpW=22, hpX=-hpW/2, hpY=-PLAYER_H-7;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(hpX,hpY,hpW,3);
    ctx.fillStyle=this.hp>50?'#2ecc71':this.hp>25?'#f39c12':'#e74c3c';
    ctx.fillRect(hpX,hpY,hpW*(this.hp/100),3);

    // Fuel bar
    const fY = hpY - 5;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(hpX,fY,hpW,3);
    const fuelPct = this.fuel / MAX_FUEL;
    ctx.fillStyle = fuelPct > 0.3 ? '#48dbfb' : '#ff9f43';
    ctx.fillRect(hpX, fY, hpW * fuelPct, 3);

    ctx.restore();

    // Aim line (world space)
    const aimLen=40;
    const ax=this.x+Math.cos(aimWorldAngle)*aimLen;
    const ay=this.y+Math.sin(aimWorldAngle)*aimLen;
    ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1.2;
    ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ax,ay); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(ax,ay,4,0,Math.PI*2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax-5,ay);ctx.lineTo(ax+5,ay);
    ctx.moveTo(ax,ay-5);ctx.lineTo(ax,ay+5);
    ctx.stroke();
  }
}

// ═══════════════════════════════════════════════════════════════
//  PROJECTILE
// ═══════════════════════════════════════════════════════════════
class Projectile {
  constructor(x,y,vx,vy) {
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;
    this.alive=true;this.trail=[];this.age=0;
  }
  update() {
    this.trail.push({x:this.x,y:this.y});
    if(this.trail.length>25) this.trail.shift();
    const{gx,gy}=gravityAt(this.x,this.y);
    this.vx+=gx*1.2; this.vy+=gy*1.2;
    this.x+=this.vx; this.y+=this.vy; this.age++;
    if(this.x<-50||this.x>WORLD_W+50||this.y<-50||this.y>WORLD_H+50){this.alive=false;return;}
    const rx=Math.round(this.x),ry=Math.round(this.y);
    if(rx>=0&&rx<WORLD_W&&ry>=0&&ry<WORLD_H&&terrain[ry*WORLD_W+rx]){this.alive=false;explode(this.x,this.y);}
    if(this.age>600)this.alive=false;
  }
  draw(ctx) {
    for(let i=0;i<this.trail.length;i++){
      const t=i/this.trail.length;
      ctx.fillStyle=`rgba(255,${150+105*t|0},${50*t|0},${t*0.7})`;
      ctx.beginPath();ctx.arc(this.trail[i].x,this.trail[i].y,1+t*2,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='#feca57'; ctx.shadowBlur=10; ctx.shadowColor='#ff6b35';
    ctx.beginPath();ctx.arc(this.x,this.y,3,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
  }
}

// ═══════════════════════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════════════════════
class Particle {
  constructor(x,y,type) {
    this.x=x;this.y=y;this.type=type;
    const a=Math.random()*Math.PI*2, sp=1+Math.random()*5;
    this.vx=Math.cos(a)*sp; this.vy=Math.sin(a)*sp;
    this.life=1; this.decay=0.012+Math.random()*0.025; this.size=2+Math.random()*3;
    const θ=Math.atan2(y-CY,x-CX);
    if(type==='fire'){this.r=255;this.g=100+Math.random()*155|0;this.b=0;this.vx+=Math.cos(θ)*2;this.vy+=Math.sin(θ)*2;}
    else if(type==='smoke'){const v=80+Math.random()*50|0;this.r=this.g=this.b=v;this.decay=0.008+Math.random()*0.012;this.size=4+Math.random()*6;this.vx+=Math.cos(θ)*1.5;this.vy+=Math.sin(θ)*1.5;}
    else if(type==='thrust'){this.r=255;this.g=180+Math.random()*75|0;this.b=50+Math.random()*80|0;this.decay=0.04+Math.random()*0.04;this.size=1.5+Math.random()*2.5;
      // Push inward (opposite of thrust direction)
      this.vx=-(Math.cos(θ))*(1+Math.random()*2)+(Math.random()-0.5)*1.5;
      this.vy=-(Math.sin(θ))*(1+Math.random()*2)+(Math.random()-0.5)*1.5;}
    else{this.r=120+Math.random()*40|0;this.g=80+Math.random()*30|0;this.b=40;}
  }
  update(){
    if(this.type==='dirt'||this.type==='thrust'){const{gx,gy}=gravityAt(this.x,this.y);this.vx+=gx*0.5;this.vy+=gy*0.5;}
    else if(this.type==='smoke'){const θ=Math.atan2(this.y-CY,this.x-CX);this.vx+=Math.cos(θ)*0.03;this.vy+=Math.sin(θ)*0.03;}
    this.x+=this.vx;this.y+=this.vy;this.vx*=0.98;this.vy*=0.98;this.life-=this.decay;
  }
  draw(ctx){
    ctx.globalAlpha=Math.max(0,this.life);
    ctx.fillStyle=`rgb(${this.r},${this.g},${this.b})`;
    ctx.beginPath();ctx.arc(this.x,this.y,this.size*this.life,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }
}

// ═══════════════════════════════════════════════════════════════
//  ENEMY
// ═══════════════════════════════════════════════════════════════
class Enemy {
  constructor(angle, isLarge = false) {
    this.isLarge = isLarge;
    this.sizeW = isLarge ? ENEMY_W * LARGE_ENEMY_SIZE_MUL : ENEMY_W;
    this.sizeH = isLarge ? ENEMY_H * LARGE_ENEMY_SIZE_MUL : ENEMY_H;
    this.maxHp = isLarge ? ENEMY_HP * LARGE_ENEMY_HP_MUL : ENEMY_HP;
    this.hp = this.maxHp;
    this.walkSpeed = isLarge ? ENEMY_WALK_SPEED * LARGE_ENEMY_SPEED_MUL : ENEMY_WALK_SPEED;
    this.depositTLen = isLarge ? LARGE_ENEMY_DEPOSIT_T : 3;
    this.depositHLen = isLarge ? LARGE_ENEMY_DEPOSIT_H : 1;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.nextDirChange = Date.now() + ENEMY_DIR_CHANGE_MIN + Math.random() * (ENEMY_DIR_CHANGE_MAX - ENEMY_DIR_CHANGE_MIN);
    this.depositTimer = 0;
    this._placeAtAngle(angle);
  }
  _placeAtAngle(angle) {
    const sr = getSurfaceRadius(angle);
    for (let r = sr + 20; r > 0; r--) {
      const px = CX + Math.cos(angle)*r, py = CY + Math.sin(angle)*r;
      if (isSolid(px, py)) { this.x=CX+Math.cos(angle)*(r+2); this.y=CY+Math.sin(angle)*(r+2); return; }
    }
    this.x=CX+Math.cos(angle)*(sr+2); this.y=CY+Math.sin(angle)*(sr+2);
  }
  get surfAngle() { return Math.atan2(this.y-CY, this.x-CX); }

  update() {
    const {gx,gy}=gravityAt(this.x,this.y);
    this.vx+=gx; this.vy+=gy;

    // Walk along surface
    if(this.onGround) {
      const θ=this.surfAngle;
      const ta=θ+Math.PI/2*this.dir;
      this.vx+=Math.cos(ta)*this.walkSpeed; this.vy+=Math.sin(ta)*this.walkSpeed;
    }

    this.x+=this.vx; this.y+=this.vy;

    // Ground collision
    this.onGround=false;
    const θ=this.surfAngle;
    const outX=Math.cos(θ), outY=Math.sin(θ);
    if(isSolid(this.x,this.y)){
      for(let i=0;i<30;i++){this.x+=outX;this.y+=outY;if(!isSolid(this.x,this.y))break;}
      this.onGround=true;
      const inDot=this.vx*(-outX)+this.vy*(-outY);
      if(inDot>0){this.vx+=outX*inDot;this.vy+=outY*inDot;}
    }
    if(!this.onGround){
      if(isSolid(this.x-outX*2,this.y-outY*2)) this.onGround=true;
    }

    // Body collision (sides)
    const tx=-outY, ty=outX;
    for(let side=-1;side<=1;side+=2){
      if(isSolid(this.x+tx*this.sizeW/2*side, this.y+ty*this.sizeW/2*side)){
        this.x-=tx*side*0.5; this.y-=ty*side*0.5;
        // Hit a wall → reverse direction
        this.dir*=-1;
        this.nextDirChange=Date.now()+ENEMY_DIR_CHANGE_MIN+Math.random()*(ENEMY_DIR_CHANGE_MAX-ENEMY_DIR_CHANGE_MIN);
      }
    }

    if(this.onGround){this.vx*=0.82;this.vy*=0.82;}
    else{this.vx*=0.995;this.vy*=0.995;}

    // Random direction change
    if(Date.now()>this.nextDirChange){
      this.dir*=-1;
      this.nextDirChange=Date.now()+ENEMY_DIR_CHANGE_MIN+Math.random()*(ENEMY_DIR_CHANGE_MAX-ENEMY_DIR_CHANGE_MIN);
    }

    // Deposit terrain trail
    if(this.onGround){
      this.depositTimer++;
      if(this.depositTimer>=ENEMY_DEPOSIT_RATE){
        this.depositTimer=0;
        this._depositTerrain();
      }
    }
  }

  _depositTerrain() {
    const θ=this.surfAngle;
    const outX=Math.cos(θ), outY=Math.sin(θ);
    const tanX=-outY, tanY=outX;
    // Deposit behind the enemy and at feet level
    for(let t=1;t<=this.depositTLen;t++){
      const bx=this.x-tanX*this.dir*t;
      const by=this.y-tanY*this.dir*t;
      for(let h=-this.depositHLen;h<=this.depositHLen;h++){
        depositTerrainPixel(Math.round(bx+outX*h), Math.round(by+outY*h));
      }
    }
  }

  draw(ctx) {
    const θ=this.surfAngle;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(θ+Math.PI/2);

    // Body
    ctx.fillStyle=this.isLarge?'#228822':'#44cc44';
    ctx.fillRect(-this.sizeW/2, -this.sizeH, this.sizeW, this.sizeH);

    // Eyes (scaled for large)
    const eyeSize = this.isLarge ? 8 : 2;
    const eyeOffset = this.isLarge ? 8 : 2;
    ctx.fillStyle='#ff0000';
    ctx.fillRect(this.dir>0?0:-eyeOffset, -this.sizeH+eyeSize, eyeSize, eyeSize);

    // HP bar
    const hpW=this.isLarge?60:14, hpX=-hpW/2, hpY=-this.sizeH-5;
    const hpBarH=this.isLarge?4:2;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(hpX,hpY,hpW,hpBarH);
    ctx.fillStyle=this.hp>this.maxHp*0.5?'#e74c3c':'#ff0000';
    ctx.fillRect(hpX,hpY,hpW*(this.hp/this.maxHp),hpBarH);

    ctx.restore();
  }
}

function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const isLarge = Math.random() < LARGE_ENEMY_CHANCE;
  enemies.push(new Enemy(angle, isLarge));
}

// ═══════════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════════
let player, projectiles=[], particles=[], enemies=[];
let keys={}, mouseX=VW/2, mouseY=VH/2;
let charging=false, power=0;
let gamepadIndex=null, gpPrevTrigger=false;
let gpLeft=false, gpRight=false, gpUp=false, gpAimActive=false;
let shakeAmount=0;
let aimAngle=0;
let godMode=false;
let initialTerrainCount=0, currentTerrainCount=0, terrainPctCache=100;
let lastEnemySpawn=0;
let lastFrameTime=performance.now(), fps=0, fpsSmooth=60;
let gameStartTime=0, gameOver=false, gameWon=false;

const hpLabel=document.getElementById('hpLabel');
const fuelLabel=document.getElementById('fuelLabel');
const shotsLabel=document.getElementById('shotsLabel');
const zoomLabel=document.getElementById('zoomLabel');
const terrainLabel=document.getElementById('terrainLabel');
const powerBarContainer=document.getElementById('power-bar-container');
const powerBar=document.getElementById('power-bar');
const messageEl=document.getElementById('message');
const timerEl=document.getElementById('timer');

function showMessage(t,dur=1500){messageEl.textContent=t;messageEl.style.opacity=1;setTimeout(()=>messageEl.style.opacity=0,dur);}

function explode(x,y) {
  carveTerrain(x,y,EXPLOSION_RADIUS);
  recalcTerrainPercent();
  const d=dist(player.x,player.y,x,y);
  if(d<EXPLOSION_RADIUS*1.6){
    const dmg=Math.max(0,Math.round(40*(1-d/(EXPLOSION_RADIUS*1.6))));
    if(!godMode) player.hp=Math.max(0,player.hp-dmg);
    const a=Math.atan2(player.y-y,player.x-x);
    const f=6*(1-d/(EXPLOSION_RADIUS*1.6));
    player.vx+=Math.cos(a)*f; player.vy+=Math.sin(a)*f;
  }
  // Damage enemies
  for(const e of enemies){
    if(e.hp<=0) continue;
    const ed=dist(e.x,e.y,x,y);
    if(ed<EXPLOSION_RADIUS*1.6){
      const dmg=Math.max(0,Math.round(40*(1-ed/(EXPLOSION_RADIUS*1.6))));
      e.hp=Math.max(0,e.hp-dmg);
      const a=Math.atan2(e.y-y,e.x-x);
      const f=6*(1-ed/(EXPLOSION_RADIUS*1.6));
      e.vx+=Math.cos(a)*f; e.vy+=Math.sin(a)*f;
    }
  }
  for(let i=0;i<PARTICLE_COUNT;i++) particles.push(new Particle(x,y,'dirt'));
  for(let i=0;i<PARTICLE_COUNT/2;i++) particles.push(new Particle(x,y,'fire'));
  for(let i=0;i<PARTICLE_COUNT/3;i++) particles.push(new Particle(x,y,'smoke'));
  shakeAmount=7;
}

function fire() {
  const startX=player.x+Math.cos(aimAngle)*18;
  const startY=player.y+Math.sin(aimAngle)*18;
  projectiles.push(new Projectile(startX,startY,Math.cos(aimAngle)*power,Math.sin(aimAngle)*power));
  player.shots++;
  // Recoil
  player.vx-=Math.cos(aimAngle)*power*0.08;
  player.vy-=Math.sin(aimAngle)*power*0.08;
}

// ─── Input ────────────────────────────────────────────────────
const godToggleEl=document.getElementById('godToggle');

function toggleGodMode(){
  godMode=!godMode;
  godToggleEl.textContent=godMode?'GOD: ON':'GOD: OFF';
  godToggleEl.style.color=godMode?'#feca57':'#576574';
  godToggleEl.style.borderColor=godMode?'#feca57':'#333';
  if(godMode && player){player.hp=100;}
  showMessage(godMode?'GOD MODE ON':'GOD MODE OFF',1000);
}

godToggleEl.addEventListener('click',toggleGodMode);

window.addEventListener('keydown',e=>{
  keys[e.key.toLowerCase()]=true;
  if(e.key.toLowerCase()==='r') initGame();
  if(e.key.toLowerCase()==='g') toggleGodMode();
  if(e.key===' ') e.preventDefault();
});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});

canvas.addEventListener('mousemove',e=>{
  const r=canvas.getBoundingClientRect();
  mouseX=(e.clientX-r.left)*(VW/r.width);
  mouseY=(e.clientY-r.top) *(VH/r.height);
});

canvas.addEventListener('mousedown',e=>{
  if(e.button===0 && player && player.hp>0 && !gameOver){
    charging=true; power=0;
    powerBarContainer.style.display='block';
  }
});

canvas.addEventListener('mouseup',e=>{
  if(e.button===0 && charging){
    charging=false;
    if(power>1) fire();
    powerBarContainer.style.display='none';
    power=0;
  }
});

canvas.addEventListener('wheel',e=>{
  const delta = e.deltaY > 0 ? -0.08 : 0.08;
  camZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camZoom + delta));
  e.preventDefault();
},{passive:false});

// Prevent context menu
canvas.addEventListener('contextmenu',e=>e.preventDefault());

window.addEventListener('gamepadconnected',e=>{
  gamepadIndex=e.gamepad.index;
  showMessage('Gamepad connected',1500);
});
window.addEventListener('gamepaddisconnected',e=>{
  if(e.gamepad.index===gamepadIndex){
    gamepadIndex=null;
    gpLeft=false; gpRight=false; gpUp=false; gpAimActive=false;
  }
});

// ─── Gamepad ──────────────────────────────────────────────────
function pollGamepad(){
  const gamepads=navigator.getGamepads?navigator.getGamepads():[];
  let gp=gamepadIndex!==null?gamepads[gamepadIndex]:null;
  if(!gp){
    for(let i=0;i<gamepads.length;i++){
      if(gamepads[i]){gamepadIndex=i;gp=gamepads[i];break;}
    }
  }
  if(!gp) return;

  const DEAD=0.15;
  const {buttons,axes}=gp;

  // Left stick X → walk
  const lx=axes[0]??0;
  gpLeft=lx<-DEAD;
  gpRight=lx>DEAD;

  // Left trigger (button 6, or axis 4 on some controllers) → jetpack
  gpUp=(buttons[6]?.pressed)||(axes[4]??0)>0.1;

  // Right stick → aim (world angle, accounting for camera rotation)
  const rx=axes[2]??0, ry=axes[3]??0;
  if(Math.sqrt(rx*rx+ry*ry)>DEAD){
    gpAimActive=true;
    aimAngle=Math.atan2(ry,rx)-camRot;
  } else {
    gpAimActive=false;
  }

  // Right trigger (button 7) → charge & fire
  const rtPressed=buttons[7]?.pressed??false;
  if(rtPressed&&!gpPrevTrigger&&player&&player.hp>0&&!gameOver){
    charging=true; power=0;
    powerBarContainer.style.display='block';
  } else if(!rtPressed&&gpPrevTrigger&&charging){
    charging=false;
    if(power>1) fire();
    powerBarContainer.style.display='none';
    power=0;
  }
  gpPrevTrigger=rtPressed;

  // LB/RB → zoom
  if(buttons[5]?.pressed) camZoom=Math.min(MAX_ZOOM,camZoom+0.04);
  if(buttons[4]?.pressed) camZoom=Math.max(MIN_ZOOM,camZoom-0.04);

  // Start → reset, Back/Select → god mode (edge-triggered)
  if(buttons[9]?.pressed&&!gp._prevStart) initGame();
  if(buttons[8]?.pressed&&!gp._prevBack)  toggleGodMode();
  gp._prevStart=buttons[9]?.pressed??false;
  gp._prevBack =buttons[8]?.pressed??false;
}

// ─── Init ─────────────────────────────────────────────────────
function initGame() {
  generateTerrain();
  renderBackground();
  player = new Player(-Math.PI/2);
  projectiles=[]; particles=[]; fallingChunks=[]; enemies=[];
  pendingFloatCheck=false; charging=false; power=0;
  camX=player.x; camY=player.y; camZoom=1.2;
  camRot=-(player.surfAngle + Math.PI / 2);
  shakeAmount=0;
  for(let i=0;i<ENEMY_INITIAL_COUNT;i++) spawnEnemy();
  lastEnemySpawn=Date.now();
  gameStartTime=performance.now();
  gameOver=false; gameWon=false;
  timerEl.textContent=Math.floor(GAME_TIME/60)+':'+((GAME_TIME%60)<10?'0':'')+(GAME_TIME%60);
  timerEl.style.color='#48dbfb';
  showMessage('Destroy terrain below '+WIN_TERRAIN_PCT+'%!',2000);
}

// ═══════════════════════════════════════════════════════════════
//  GAME LOOP
// ═══════════════════════════════════════════════════════════════
function gameLoop() {
  requestAnimationFrame(gameLoop);
  const now=performance.now();
  fps=1000/(now-lastFrameTime);
  lastFrameTime=now;
  fpsSmooth+=(fps-fpsSmooth)*0.05;
  if(!player) return;

  // Timer & win/lose
  if(!gameOver){
    const elapsed=(now-gameStartTime)/1000;
    const remaining=Math.max(0,GAME_TIME-elapsed);
    const mins=Math.floor(remaining/60);
    const secs=Math.floor(remaining%60);
    timerEl.textContent=mins+':'+(secs<10?'0':'')+secs;
    timerEl.style.color=remaining<=10?'#e74c3c':'#48dbfb';
    if(terrainPctCache<=WIN_TERRAIN_PCT){
      gameOver=true; gameWon=true;
      const timeUsed=GAME_TIME-remaining;
      showMessage('YOU WIN! '+Math.round(timeUsed)+'s',9999);
      timerEl.style.color='#2ecc71';
    } else if(remaining<=0){
      gameOver=true; gameWon=false;
      showMessage('TIME UP – YOU LOSE!',9999);
      timerEl.textContent='0:00';
      timerEl.style.color='#e74c3c';
    }
  }

  // Aim angle — mouse updates unless gamepad right stick is active
  pollGamepad();
  if(!gpAimActive){
    const worldMouse = screenToWorld(mouseX, mouseY);
    aimAngle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);
  }

  // Input
  if(player.hp > 0 && !gameOver) {
    const θ=player.surfAngle;
    // Walk (works on ground and in air with reduced force)
    const airMul = player.onGround ? 1.0 : 0.4;
    if(keys['a']||gpLeft){
      const ta=θ-Math.PI/2;
      player.vx+=Math.cos(ta)*WALK_FORCE*airMul; player.vy+=Math.sin(ta)*WALK_FORCE*airMul;
    }
    if(keys['d']||gpRight){
      const ta=θ+Math.PI/2;
      player.vx+=Math.cos(ta)*WALK_FORCE*airMul; player.vy+=Math.sin(ta)*WALK_FORCE*airMul;
    }
    // Jetpack thrust (outward from planet center, weakens with altitude)
    if((keys['w']||gpUp) && player.fuel > 0){
      const outX=Math.cos(θ), outY=Math.sin(θ);
      const altitude = dist(player.x, player.y, CX, CY);
      let thrustMul = 1.0;
      if(altitude > THRUST_WEAKEN_START) {
        thrustMul = Math.max(0, 1 - (altitude - THRUST_WEAKEN_START) / (THRUST_WEAKEN_END - THRUST_WEAKEN_START));
      }
      const thrust = THRUST_FORCE * thrustMul;
      player.vx+=outX*thrust; player.vy+=outY*thrust;
      player.fuel=Math.max(0, player.fuel - FUEL_USE);
      player.thrusting=true;
      player.onGround=false;
      // Spawn thruster particles (fewer when thrust is weak)
      if(Math.random() < 0.6 * Math.max(0.15, thrustMul)){
        const px=player.x-outX*2+(Math.random()-0.5)*4;
        const py=player.y-outY*2+(Math.random()-0.5)*4;
        particles.push(new Particle(px,py,'thrust'));
      }
    }
  }

  // Charging
  if(charging){
    power=Math.min(MAX_POWER,power+0.3);
    powerBar.style.width=(power/MAX_POWER*100)+'%';
  }

  // Update
  if(player.hp>0) player.update();
  if(godMode){player.hp=100;player.fuel=MAX_FUEL;}
  for(const p of projectiles) if(p.alive) p.update();
  projectiles=projectiles.filter(p=>p.alive||p.age<300);
  for(const p of particles) p.update();
  particles=particles.filter(p=>p.life>0);

  // Enemies
  for(const e of enemies) if(e.hp>0) e.update();
  enemies=enemies.filter(e=>e.hp>0);
  if(Date.now()-lastEnemySpawn>=ENEMY_SPAWN_INTERVAL){
    spawnEnemy();
    lastEnemySpawn=Date.now();
  }

  let anyChunkActive=false;
  for(const c of fallingChunks){c.update();if(!c.settled)anyChunkActive=true;}
  fallingChunks=fallingChunks.filter(c=>!c.settled);

  if(pendingFloatCheck&&!anyChunkActive){
    pendingFloatCheck=false;
    detectFloatingTerrain();
  }

  // Camera follow player with rotation
  if(player.hp>0) {
    // Target rotation: make player's outward direction point UP on screen
    // surfAngle points outward from center; screen UP = -π/2
    const targetRot = -(player.surfAngle + Math.PI / 2);
    updateCamera(player.x, player.y, targetRot);
  }

  // Shake
  shakeAmount*=0.9;
  if(shakeAmount<0.1)shakeAmount=0;
  const sx=(Math.random()-0.5)*shakeAmount;
  const sy=(Math.random()-0.5)*shakeAmount;

  // HUD
  hpLabel.textContent=player.hp;
  fuelLabel.textContent=Math.round(player.fuel);
  fuelLabel.style.color=player.fuel>30?'#48dbfb':'#ff9f43';
  shotsLabel.textContent=player.shots;
  zoomLabel.textContent=camZoom.toFixed(1)+'x';
  terrainLabel.textContent=terrainPctCache+'%';

  // ─── DRAW ─────────────────────────────────────────────────
  ctx.clearRect(0,0,VW,VH);

  // Fill with deep space color for areas outside world
  ctx.fillStyle='#030308';
  ctx.fillRect(0,0,VW,VH);

  ctx.save();
  ctx.translate(sx, sy);
  applyCam();

  // Background
  ctx.drawImage(bgOff, 0, 0);

  // Terrain
  ctx.drawImage(terrOff, 0, 0);

  // Falling chunks
  for(const c of fallingChunks) c.draw(ctx);

  // Projectiles
  for(const p of projectiles) if(p.alive) p.draw(ctx);

  // Particles
  for(const p of particles) p.draw(ctx);

  // Enemies
  for(const e of enemies) e.draw(ctx);

  // Player
  if(player.hp>0) player.draw(ctx, aimAngle);

  // Death
  if(player.hp<=0){
    ctx.fillStyle='rgba(255,50,50,0.3)';
    ctx.beginPath();ctx.arc(player.x,player.y,20,0,Math.PI*2);ctx.fill();
  }

  ctx.restore();

  // Minimap (top-right)
  drawMinimap();

  // FPS (bottom-left)
  ctx.font='12px monospace';
  ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.fillText(Math.round(fpsSmooth)+' FPS', 10, VH-10);
}

// ─── Minimap ──────────────────────────────────────────────────
function drawMinimap() {
  const mSize = 100, mPad = 10;
  const mx = VW - mSize - mPad, my = mPad;
  const scale = mSize / WORLD_W;

  ctx.save();
  ctx.globalAlpha = 0.8;

  // Background circle
  ctx.fillStyle = '#0a0a1a';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mx + mSize/2, my + mSize/2, mSize/2, 0, Math.PI*2);
  ctx.fill();
  ctx.stroke();

  // Planet outline
  ctx.strokeStyle = '#3a5a3a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(mx + CX*scale, my + CY*scale, BASE_RADIUS*scale, 0, Math.PI*2);
  ctx.stroke();

  // Enemy dots
  for(const e of enemies){
    ctx.fillStyle = e.isLarge ? '#228822' : '#44cc44';
    ctx.beginPath();
    ctx.arc(mx + e.x*scale, my + e.y*scale, e.isLarge ? 4 : 2, 0, Math.PI*2);
    ctx.fill();
  }

  // Player dot
  if (player.hp > 0) {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(mx + player.x*scale, my + player.y*scale, 3, 0, Math.PI*2);
    ctx.fill();
  }

  // Camera viewport rectangle
  const vw = VW / camZoom, vh = VH / camZoom;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(mx + (camX - vw/2)*scale, my + (camY - vh/2)*scale, vw*scale, vh*scale);

  ctx.globalAlpha = 1;
  ctx.restore();
}
//test
// ─── Start ────────────────────────────────────────────────────
initGame();
gameLoop();
