// Numbers to tune
const GRID_SIZE = 36;
const GRID_LINE_COLOR = 232;
const GRID_LINE_WEIGHT = 1;
const SENSOR_PROMPT_TEXT = 'Tap to enable motion sensors';

function setup() {
  createCanvas(windowWidth, windowHeight);
  lockGestures();
  enableSensorTap(SENSOR_PROMPT_TEXT);
  showDesktopQr({ label: 'Scan to open on your phone' });
  requestWakeLock();
}

function draw() {
  drawGrid();

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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function requestWakeLock() {
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
}