// Numbers to tune
const GRID_SIZE = 36;
const GRID_LINE_COLOR = 232;
const GRID_LINE_WEIGHT = 1;
const SENSOR_PROMPT_TEXT = 'Tap to enable motion sensors';
const SPRITE_SIZE_RATIO = 0.34;
const DOUBLE_TAP_MAX_DELAY = 300;
const DOUBLE_TAP_MAX_DISTANCE = 25;
const MAX_ENTITIES = 100;
const GRAVITY_FORCE = 2.4;
const FRICTION_DAMPING = 0.998;
const RESTITUTION = 0.92;
const TRANSFORM_DELAY_MS = 2000;
const COLLISION_RESTITUTION = 0.95;
const MAX_SPEED = 22;
const TILT_RANGE = 25;
const TILT_CURVE = 1.7;
const VERTICAL_GRAVITY_MULT = 1.6;

let characterImg;
let heartImg;

let entities = [];
let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;
let debugMarker = null;

function setup() {
  createCanvas(windowWidth, windowHeight);
  lockGestures();
  enableSensorTap(SENSOR_PROMPT_TEXT);
  showDesktopQr({ label: 'Scan to open on your phone' });
  requestWakeLock();
  loadAssets();
}

async function loadAssets() {
  try {
    characterImg = await loadImage('references/character1.png');
  } catch (err) {
    characterImg = null;
  }
  try {
    heartImg = await loadImage('references/character2.png');
  } catch (err) {
    heartImg = null;
  }
  imageMode(CENTER);
}

function draw() {
  drawGrid();
  updateEntities();
  drawEntities();
  drawDebugMarker();

  if (!window.sensorsEnabled) return;

  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(14);
  text('entities: ' + entities.length + ' / ' + MAX_ENTITIES, 12, 12);
  text('rotationX: ' + nf(rotationX, 2, 1), 12, 30);
  text('rotationY: ' + nf(rotationY, 2, 1), 12, 48);
  text('rotationZ: ' + nf(rotationZ, 2, 1), 12, 66);
}

function drawGrid() {
  background(255);
  stroke(GRID_LINE_COLOR);
  strokeWeight(GRID_LINE_WEIGHT);
  for (let x = GRID_SIZE; x < width; x += GRID_SIZE) {
    line(x, 0, x, height);
  }
  for (let y = GRID_SIZE; y < height; y += GRID_SIZE) {
    line(0, y, width, y);
  }
}

function spawnEntity(x, y) {
  if (entities.length >= MAX_ENTITIES) return;

  entities.push({
    x: x,
    y: y,
    vx: 0,
    vy: 0,
    size: width * SPRITE_SIZE_RATIO,
    isHeart: true,
    born: millis(),
  });
}

function updateEntities() {
  const tilt = readTilt();

  for (const e of entities) {
    e.vx = (e.vx + tilt.x * GRAVITY_FORCE) * FRICTION_DAMPING;
    e.vy = (e.vy + tilt.y * GRAVITY_FORCE * VERTICAL_GRAVITY_MULT) * FRICTION_DAMPING;

    const speed = dist(0, 0, e.vx, e.vy);
    if (speed > MAX_SPEED) {
      e.vx = (e.vx / speed) * MAX_SPEED;
      e.vy = (e.vy / speed) * MAX_SPEED;
    }

    e.x += e.vx;
    e.y += e.vy;
    bounceWithinScreen(e);
    if (e.isHeart && millis() - e.born >= TRANSFORM_DELAY_MS) {
      e.isHeart = false;
    }
  }

  resolveEntityCollisions();
}

function resolveEntityCollisions() {
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];
      const minDistance = (a.size + b.size) / 2;

      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = dist(a.x, a.y, b.x, b.y);

      if (d >= minDistance) continue;

      if (d === 0) {
        dx = 1;
        dy = 0;
        d = 1;
      }

      const nx = dx / d;
      const ny = dy / d;
      const overlap = (minDistance - d) / 2;

      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;

      const relativeVelX = b.vx - a.vx;
      const relativeVelY = b.vy - a.vy;
      const separatingSpeed = relativeVelX * nx + relativeVelY * ny;

      if (separatingSpeed > 0) continue;

      const impulse = (-(1 + COLLISION_RESTITUTION) * separatingSpeed) / 2;
      const impulseX = nx * impulse;
      const impulseY = ny * impulse;

      a.vx -= impulseX;
      a.vy -= impulseY;
      b.vx += impulseX;
      b.vy += impulseY;
    }
  }
}

function readTilt() {
  if (!window.sensorsEnabled) return { x: 0, y: 0 };
  return {
    x: curveTilt(rotationY),
    y: curveTilt(rotationX),
  };
}

function curveTilt(degrees) {
  const normalized = constrain(degrees / TILT_RANGE, -1, 1);
  return Math.sign(normalized) * Math.pow(Math.abs(normalized), TILT_CURVE);
}

function bounceWithinScreen(e) {
  const half = e.size / 2;

  if (e.x < half) {
    e.x = half;
    e.vx = Math.abs(e.vx) * RESTITUTION;
  } else if (e.x > width - half) {
    e.x = width - half;
    e.vx = -Math.abs(e.vx) * RESTITUTION;
  }

  if (e.y < half) {
    e.y = half;
    e.vy = Math.abs(e.vy) * RESTITUTION;
  } else if (e.y > height - half) {
    e.y = height - half;
    e.vy = -Math.abs(e.vy) * RESTITUTION;
  }
}

function drawEntities() {
  for (const e of entities) {
    if (e.isHeart) {
      if (heartImg) {
        image(heartImg, e.x, e.y, e.size, e.size);
      } else {
        drawFallbackHeart(e.x, e.y, e.size);
      }
    } else {
      if (characterImg) {
        image(characterImg, e.x, e.y, e.size, e.size);
      } else {
        fallbackCircle(e.x, e.y, e.size);
      }
    }
  }
}

function drawFallbackHeart(cx, cy, size) {
  fill(255, 105, 180);
  noStroke();
  const r = size * 0.28;
  circle(cx - size * 0.16, cy - size * 0.12, r * 2);
  circle(cx + size * 0.16, cy - size * 0.12, r * 2);
  triangle(cx, cy + size * 0.32, cx - r * 0.98, cy - size * 0.02, cx + r * 0.98, cy - size * 0.02);
}

function fallbackCircle(cx, cy, size) {
  fill(90, 140, 220);
  noStroke();
  circle(cx, cy, size);
}

function mousePressed() {
  const now = millis();
  const withinTime = now - lastTapTime <= DOUBLE_TAP_MAX_DELAY;
  const withinSpace = dist(mouseX, mouseY, lastTapX, lastTapY) <= DOUBLE_TAP_MAX_DISTANCE;

  if (lastTapTime !== 0 && withinTime && withinSpace) {
    lastTapTime = 0;
    debugMarker = { x: mouseX, y: mouseY, born: now };
    spawnEntity(mouseX, mouseY);
  } else {
    lastTapTime = now;
    lastTapX = mouseX;
    lastTapY = mouseY;
  }

  return false;
}

function drawDebugMarker() {
  if (!debugMarker) return;
  if (millis() - debugMarker.born > 500) {
    debugMarker = null;
    return;
  }
  noFill();
  stroke(0, 160, 0);
  strokeWeight(2);
  circle(debugMarker.x, debugMarker.y, 24);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function requestWakeLock() {
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
}