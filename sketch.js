function setup() {
  createCanvas(windowWidth, windowHeight);
  lockGestures();
  showDesktopQr({ label: 'Scan to open on your phone' });
  requestWakeLock();
}

function draw() {
  background(210);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function requestWakeLock() {
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
}