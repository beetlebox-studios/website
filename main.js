// ─── WebGL metaball — scoped to #hero canvas ──────────────────────────────────

const canvas = document.getElementById('metaball-canvas');
const hero   = document.getElementById('hero');

function resizeCanvas() {
  canvas.width  = hero.clientWidth;
  canvas.height = hero.clientHeight;
}

const gl = canvas.getContext('webgl2');
if (!gl) { hero.style.background = '#0a0a0f'; throw new Error('WebGL2 not supported'); }

// ── Shaders ───────────────────────────────────────────────────────────────────

const VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS_METABALL = `#version 300 es
precision highp float;
in  vec2 v_uv;
out vec4 fragColor;
uniform vec2  u_res;
uniform float u_threshold;
#define MAX_BALLS 16
uniform vec3 u_balls[MAX_BALLS];
uniform int  u_count;
void main() {
  vec2 px = v_uv * u_res;
  float field = 0.0;
  for (int i = 0; i < MAX_BALLS; i++) {
    if (i >= u_count) break;
    vec2  d = px - u_balls[i].xy;
    float r = u_balls[i].z;
    field += (r * r) / dot(d, d);
  }
  float inside = step(u_threshold, field);
  // Slime green: #00ff58
  fragColor = vec4(vec3(0.0, 1.0, 0.345) * inside, 1.0);
}`;

const FS_PIXEL = `#version 300 es
precision highp float;
in  vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_tex;
uniform vec2      u_res;
uniform float     u_pixel_size;
void main() {
  vec2 cell    = floor(v_uv * u_res / u_pixel_size) * u_pixel_size + u_pixel_size * 0.5;
  vec2 snapped = cell / u_res;
  fragColor    = texture(u_tex, snapped);
}`;

// ── Compile / link ────────────────────────────────────────────────────────────

function compileShader(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function linkProgram(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl.VERTEX_SHADER,   vs));
  gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return p;
}

const progMetaball = linkProgram(VS, FS_METABALL);
const progPixel    = linkProgram(VS, FS_PIXEL);

// Shared fullscreen quad
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER,
  new Float32Array([-1,-1, 1,-1, -1,1,  1,-1, 1,1, -1,1]),
  gl.STATIC_DRAW);

function bindQuad(prog) {
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}
bindQuad(progMetaball);
bindQuad(progPixel);

// Uniforms — pass 1
const uRes       = gl.getUniformLocation(progMetaball, 'u_res');
const uBalls     = gl.getUniformLocation(progMetaball, 'u_balls[0]');
const uCount     = gl.getUniformLocation(progMetaball, 'u_count');
const uThreshold = gl.getUniformLocation(progMetaball, 'u_threshold');

// Uniforms — pass 2
const uTex       = gl.getUniformLocation(progPixel, 'u_tex');
const uResP      = gl.getUniformLocation(progPixel, 'u_res');
const uPixelSize = gl.getUniformLocation(progPixel, 'u_pixel_size');

// ── FBO ───────────────────────────────────────────────────────────────────────

let fbo, fboTex;

function createFBO(w, h) {
  if (fboTex) gl.deleteTexture(fboTex);
  if (fbo)    gl.deleteFramebuffer(fbo);
  fboTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, fboTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function resize() {
  resizeCanvas();
  gl.viewport(0, 0, canvas.width, canvas.height);
  createFBO(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// ── Mouse — relative to hero ──────────────────────────────────────────────────

const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

window.addEventListener('mousemove', e => {
  const r = hero.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
});

window.addEventListener('touchmove', e => {
  const r = hero.getBoundingClientRect();
  mouse.x = e.touches[0].clientX - r.left;
  mouse.y = e.touches[0].clientY - r.top;
}, { passive: true });

// ── Dev params ────────────────────────────────────────────────────────────────

const P = {
  // Metaball
  threshold : 1.02,
  mouseR    : 59,
  lerp      : 0.85,
  uiScale   : 0.40,
  satScale  : 0.0,
  satOff    : 0.0,
  pixelSize : 8,
  circleR   : 160,
  // Slime physics
  gravity       : 0.250,
  viscosity     : 0.92,
  surfTension   : 0.03,
  detachDist    : 12,
  stretchFrames : 10,
  spawnInterval : 10,
  dripMin       : 5,
  dripMax       : 10,
};

function bindSlider(id, valId, key, decimals = 2) {
  const slider  = document.getElementById(id);
  const display = document.getElementById(valId);
  slider.addEventListener('input', () => {
    P[key] = parseFloat(slider.value);
    display.textContent = P[key].toFixed(decimals);
  });
}

bindSlider('s-threshold', 'v-threshold', 'threshold',     2);
bindSlider('s-mouse-r',   'v-mouse-r',   'mouseR',        0);
bindSlider('s-lerp',      'v-lerp',      'lerp',          2);
bindSlider('s-pixel',     'v-pixel',     'pixelSize',     0);
bindSlider('s-circle-r',  'v-circle-r',  'circleR',       0);
bindSlider('s-gravity',   'v-gravity',   'gravity',       3);
bindSlider('s-viscosity', 'v-viscosity', 'viscosity',     2);
bindSlider('s-tension',   'v-tension',   'surfTension',   2);
bindSlider('s-detach',    'v-detach',    'detachDist',    0);
bindSlider('s-stretch',   'v-stretch',   'stretchFrames', 0);
bindSlider('s-spawn',     'v-spawn',     'spawnInterval', 0);
bindSlider('s-drip-min',  'v-drip-min',  'dripMin',       0);
bindSlider('s-drip-max',  'v-drip-max',  'dripMax',       0);

const devPanel = document.getElementById('dev-panel');
window.addEventListener('keydown', e => {
  if (e.key === '`') devPanel.classList.toggle('visible');
});

// ── Circle overlay ────────────────────────────────────────────────────────────

const circleOverlay = document.getElementById('hero-circle');

// Returns the circle's centre in canvas-space pixels (centered in hero).
function getCircleCenter() {
  return {
    cx: canvas.width  * 0.5,
    cy: canvas.height * 0.5,
  };
}

function updateCircleOverlay() {
  const d = P.circleR * 2;
  circleOverlay.style.width  = d + 'px';
  circleOverlay.style.height = d + 'px';
}

// ── Slime physics ─────────────────────────────────────────────────────────────

const MAX_DRIPS   = 13;  // slots 2–14 (0=mouse, 1=hero circle, 15=spare)
const MIN_R       = 7;   // kill threshold
const FALL_DAMPING = 0.97;
const SPLAT_MARGIN = 12;

let drips      = [];
let spawnTimer = 0;

function spawnDrip() {
  const { cx, cy } = getCircleCenter();
  const hr = P.circleR;

  // Spawn on the upper arc only (angles -PI to 0 in canvas-space = top half).
  // canvas-space: angle 0=right, -PI/2=up, PI=left.
  // We want -PI..0 which is the top semicircle.
  const angle = -Math.PI * Math.random();
  const ax = cx + Math.cos(angle) * hr;
  const ay = cy + Math.sin(angle) * hr;

  const targetR = P.dripMin + Math.random() * (P.dripMax - P.dripMin);
  // Growth rate: reach targetR over ~40 frames
  const growRate = targetR / 40;

  drips.push({
    x: ax, y: ay,
    vx: 0, vy: 0,
    r: 0,            // start invisible — grows onto the surface
    targetR,
    growRate,
    phase: 'growing',
    anchorX: ax,
    anchorY: ay,
    stretchTimer: 0,
  });
}

function updateDrips() {
  // Spawn
  spawnTimer++;
  if (spawnTimer >= P.spawnInterval && drips.length < MAX_DRIPS) {
    spawnTimer = 0;
    spawnDrip();
  }

  for (let i = drips.length - 1; i >= 0; i--) {
    const d = drips[i];

    if (d.phase === 'growing') {
      // Swell radius toward targetR — blob oozes out of the surface
      d.r += d.growRate;
      if (d.r >= d.targetR) {
        d.r = d.targetR;
        d.phase = 'clinging';
      }
      // Tiny gravity nudge even while growing so it already leans downward
      d.vy += P.gravity * 0.3;
      d.vy *= P.viscosity;
      d.y  += d.vy;
      // Anchor tracks with it during growth so spring origin stays correct
      d.anchorX = d.x;
      d.anchorY = d.y;

    } else if (d.phase === 'clinging') {
      d.vy += P.gravity;
      d.vx += (d.anchorX - d.x) * P.surfTension;
      d.vy += (d.anchorY - d.y) * P.surfTension;
      d.vx *= P.viscosity;
      d.vy *= P.viscosity;
      d.x  += d.vx;
      d.y  += d.vy;
      if (Math.hypot(d.x - d.anchorX, d.y - d.anchorY) > P.detachDist) {
        d.phase = 'stretching';
        d.stretchTimer = 0;
      }

    } else if (d.phase === 'stretching') {
      d.stretchTimer++;
      const fade = 1.0 - d.stretchTimer / P.stretchFrames;
      d.vx += (d.anchorX - d.x) * P.surfTension * fade;
      d.vy += (d.anchorY - d.y) * P.surfTension * fade;
      d.vy += P.gravity;
      d.vx *= P.viscosity;
      d.vy *= P.viscosity;
      d.x  += d.vx;
      d.y  += d.vy;
      d.r  *= 0.9982;
      if (d.stretchTimer >= P.stretchFrames) {
        d.phase = 'falling';
        d.vy += 0.6;
      }

    } else if (d.phase === 'falling') {
      d.vy += P.gravity;
      d.vx *= FALL_DAMPING;
      d.vy *= P.viscosity;
      d.x  += d.vx;
      d.y  += d.vy;
      d.r  *= 0.9988;
    }

    if (d.r < MIN_R && d.phase !== 'growing') {
      drips.splice(i, 1);
    } else if (d.y > canvas.height) {
      drips.splice(i, 1);
    }
  }
}

// ── Render loop ───────────────────────────────────────────────────────────────

const MAX_BALLS   = 16;
const ballData    = new Float32Array(MAX_BALLS * 3);
const smoothMouse = { x: mouse.x, y: mouse.y };

function frame() {
  updateCircleOverlay();
  updateDrips();

  smoothMouse.x += (mouse.x - smoothMouse.x) * P.lerp;
  smoothMouse.y += (mouse.y - smoothMouse.y) * P.lerp;

  const h = canvas.height;
  const { cx, cy } = getCircleCenter();

  // Build ball list: mouse, hero circle, then drip particles
  // Shader uses bottom-left origin so y is flipped: shader_y = h - canvas_y
  const all = [
    { x: smoothMouse.x, y: h - smoothMouse.y, r: P.mouseR },
    { x: cx,            y: h - cy,            r: P.circleR },
    ...drips.map(d => ({ x: d.x, y: h - d.y, r: d.r })),
  ].slice(0, MAX_BALLS);

  for (let i = 0; i < MAX_BALLS; i++) {
    const b = all[i] || { x: -9999, y: -9999, r: 0 };
    ballData[i * 3]     = b.x;
    ballData[i * 3 + 1] = b.y;
    ballData[i * 3 + 2] = b.r;
  }

  // Pass 1 → FBO
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, canvas.width, h);
  gl.useProgram(progMetaball);
  bindQuad(progMetaball);
  gl.uniform2f(uRes, canvas.width, h);
  gl.uniform1f(uThreshold, P.threshold);
  gl.uniform3fv(uBalls, ballData);
  gl.uniform1i(uCount, all.length);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Pass 2 → screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, h);
  gl.useProgram(progPixel);
  bindQuad(progPixel);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fboTex);
  gl.uniform1i(uTex, 0);
  gl.uniform2f(uResP, canvas.width, h);
  gl.uniform1f(uPixelSize, P.pixelSize);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
