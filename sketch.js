// Numbers to tune
const GRID_SIZE = 36;
const GRID_LINE_COLOR = 232;
const GRID_LINE_WEIGHT = 1;
const SENSOR_PROMPT_TEXT = 'Tap to enable motion sensors';
const SPRITE_SIZE_RATIO = 0.14;
const DOUBLE_TAP_MAX_DELAY = 300;
const DOUBLE_TAP_MAX_DISTANCE = 25;

let characterImg;
let heartImg;

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
  drawAssetPreview();
  drawDebugMarker();

  if (!window.sensorsEnabled) return;

  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(14);
  text('rotationX: ' + nf(rotationX, 2, 1), 12, 12);
  text('rotationY: ' + nf(rotationY, 2, 1), 12, 30);
  text('rotationZ: ' + nf(rotationZ, 2, 1), 12, 48);
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

function drawAssetPreview() {
  const size = width * SPRITE_SIZE_RATIO;
  if (heartImg) {
    image(heartImg, width * 0.35, height * 0.5, size, size);
  } else {
    drawFallbackHeart(width * 0.35, height * 0.5, size);
  }
  if (characterImg) {
    image(characterImg, width * 0.65, height * 0.5, size, size);
  } else {
    fallbackCircle(width * 0.65, height * 0.5, size);
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
    console.log('double tap at', mouseX, mouseY);
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