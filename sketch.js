// Numbers to tune
const GRID_SIZE = 36;
const GRID_LINE_COLOR = 232;
const GRID_LINE_WEIGHT = 1;
const SENSOR_PROMPT_TEXT = 'Tap to start';
const ROOM_ID = 'atelier-shared-world-4p';
const MAX_PLAYERS = 4;
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 2400;
const MIN_ZOOM = 0.14;
const MAX_ZOOM = 1.5;
const DOUBLE_TAP_TIME_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE = 25;
const HEART_TRANSFORM_MS = 2000;
const SPRITE_SIZE = 55;
const MAX_ENTITIES = 100;
const HATER_COUNT = 6;
const HATER_BASE_SPEED = 1.5;
const HATER_FLEE_SPEED = 4.0;
const INFECTION_RADIUS = 35;
const KILL_HITBOX_RADIUS = 40;
const COLOR_CHALLENGE_DURATION_SEC = 30;
const COLOR_MATCH_THRESHOLD = 75;
const CAM_WINDOW_WIDTH = 120;
const CAM_WINDOW_HEIGHT = 90;
const NETWORK_SYNC_RATE_MS = 66;
const FIRST_CHALLENGE_DELAY_MS = 15000;
const CHALLENGE_INTERVAL_MS = 45000;
const TILT_RANGE = 25;
const TILT_CURVE = 1.7;
const VERTICAL_GRAVITY_MULT = 1.6;
const MOVE_GRAVITY = 4.5;
const MOVE_MAX_SPEED = 40;
const BUILD_ID = 'v8';

const COLORS = [
  { name: 'red', rgb: [220, 40, 40] },
  { name: 'orange', rgb: [240, 140, 30] },
  { name: 'yellow', rgb: [235, 210, 40] },
  { name: 'green', rgb: [50, 160, 70] },
  { name: 'blue', rgb: [50, 90, 210] },
  { name: 'purple', rgb: [130, 60, 190] },
  { name: 'pink', rgb: [235, 110, 170] },
  { name: 'brown', rgb: [130, 85, 55] },
  { name: 'white', rgb: [240, 240, 240] },
  { name: 'black', rgb: [35, 35, 35] },
];

let characterImg;
let heartImg;
let haterImg;

let cam;
let camGfx;
let cameraRequested = false;

let entities = [];
let nextEntityId = 1;

const view = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom: 0.7 };
let viewInitialized = false;

let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;
let pressX = 0;
let pressY = 0;
let lastDragX = 0;
let lastDragY = 0;
let pinchStartDist = 0;
let pinchStartZoom = 1;
let dragging = false;
let pinching = false;

let peer = null;
let hostConn = null;
let connections = [];
let isHost = false;
let myRegion = -1;
let connected = false;
let soloMode = false;
let localId = 'host';
let joinAttempts = 0;
let reconnectTimer = null;
let lastSyncSent = 0;

const playerRegions = {};
const playerTilt = {};
const playerViews = {};

let challenge = {
  active: false,
  name: '',
  rgb: [0, 0, 0],
  remainingMs: 0,
  nextAt: 0,
};

let message = '';
let messageRemainingMs = 0;
let scanButton = { x: 0, y: 0, w: 0, h: 0 };

function setup() {
  createCanvas(windowWidth, windowHeight);
  lockGestures();
  enableSensorTap(SENSOR_PROMPT_TEXT);
  showDesktopQr({ label: 'Scan to open on your phone' });
  requestWakeLock();
  loadAssets();
  camGfx = createGraphics(CAM_WINDOW_WIDTH, CAM_WINDOW_HEIGHT);
  camGfx.pixelDensity(1);
  startNetwork();
}

function userSetupComplete() {
  ensureCamera();
}

async function loadAssets() {
  characterImg = await tryLoad('character1.png');
  heartImg = await tryLoad('character2.png');
  haterImg = await tryLoad('hater.png');
  imageMode(CENTER);
}

async function tryLoad(file) {
  try {
    return await loadImage(assetUrl(file));
  } catch (err) {
    return null;
  }
}

function assetUrl(file) {
  return 'references/' + file + '?v=' + BUILD_ID;
}

function draw() {
  background(255);
  push();
  applyCamera();
  drawWorld();
  pop();
  drawHud();
  networkTick();
}

function applyCamera() {
  translate(width / 2, height / 2);
  scale(view.zoom);
  translate(-view.x, -view.y);
}

function drawWorld() {
  drawGrid();
  drawRegions();
  drawEntities();
}

function drawGrid() {
  const halfW = width / (2 * view.zoom);
  const halfH = height / (2 * view.zoom);
  const left = view.x - halfW;
  const top = view.y - halfH;

  stroke(GRID_LINE_COLOR);
  strokeWeight(GRID_LINE_WEIGHT / view.zoom);
  const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;

  for (let x = startX; x < left + halfW * 2; x += GRID_SIZE) {
    line(x, top, x, top + halfH * 2);
  }
  for (let y = startY; y < top + halfH * 2; y += GRID_SIZE) {
    line(left, y, left + halfW * 2, y);
  }
}

function drawRegions() {
  const halfW = WORLD_WIDTH / 2;
  const halfH = WORLD_HEIGHT / 2;

  for (let r = 0; r < 4; r++) {
    const b = regionBounds(r);
    const mine = r === myRegion;

    noFill();
    if (mine) {
      fill(60, 130, 255, 18);
      stroke(60, 130, 255, 180);
      strokeWeight(3 / view.zoom);
    } else {
      stroke(200);
      strokeWeight(1 / view.zoom);
    }
    rect(b.x, b.y, halfW, halfH);

    noStroke();
    fill(mine ? color(40, 90, 200) : color(150));
    textAlign(CENTER, TOP);
    textSize(20 / view.zoom);
    text(mine ? 'YOUR REGION' : 'REGION ' + r, b.x + halfW / 2, b.y + 8 / view.zoom);
  }
}

function regionBounds(r) {
  const col = r % 2;
  const row = Math.floor(r / 2);
  return {
    x: col * (WORLD_WIDTH / 2),
    y: row * (WORLD_HEIGHT / 2),
  };
}

function regionCenter(r) {
  const b = regionBounds(r);
  return { x: b.x + WORLD_WIDTH / 4, y: b.y + WORLD_HEIGHT / 4 };
}

function regionAt(wx, wy) {
  const x = wrapX(wx);
  const y = wrapY(wy);
  const col = Math.min(1, Math.floor(x / (WORLD_WIDTH / 2)));
  const row = Math.min(1, Math.floor(y / (WORLD_HEIGHT / 2)));
  return row * 2 + col;
}

function wrapX(x) {
  return ((x % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
}

function wrapY(y) {
  return ((y % WORLD_HEIGHT) + WORLD_HEIGHT) % WORLD_HEIGHT;
}

function drawEntities() {
  for (const e of entities) {
    drawSprite(e);
  }
}

function drawSprite(e) {
  if (e.type === 'hater') {
    if (haterImg) {
      tint(70);
      image(haterImg, e.x, e.y, SPRITE_SIZE, SPRITE_SIZE);
      noTint();
    } else {
      drawFallbackHater(e.x, e.y, SPRITE_SIZE);
    }
    return;
  }

  if (e.isHeart) {
    if (heartImg) {
      image(heartImg, e.x, e.y, SPRITE_SIZE, SPRITE_SIZE);
    } else {
      drawFallbackHeart(e.x, e.y, SPRITE_SIZE);
    }
    return;
  }

  if (e.infected) {
    tint(70);
  } else if (e.color) {
    tint(e.color[0], e.color[1], e.color[2]);
  }

  if (characterImg) {
    image(characterImg, e.x, e.y, SPRITE_SIZE, SPRITE_SIZE);
  } else {
    fallbackCircle(e.x, e.y, SPRITE_SIZE);
  }
  noTint();
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

function drawFallbackHater(cx, cy, size) {
  fill(45, 45, 55);
  noStroke();
  const r = size * 0.4;
  beginShape();
  for (let i = 0; i < 10; i++) {
    const a = (TWO_PI / 10) * i;
    const rr = i % 2 === 0 ? r : r * 0.62;
    vertex(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  endShape(CLOSE);
  fill(230, 90, 90);
  circle(cx - r * 0.22, cy - r * 0.1, r * 0.22);
  circle(cx + r * 0.22, cy - r * 0.1, r * 0.22);
}

function drawHud() {
  noStroke();
  fill(20);
  textAlign(CENTER, TOP);
  textSize(16);
  text('Your Region: ' + (myRegion < 0 ? '—' : myRegion), width / 2, 10);

  textSize(12);
  fill(90);
  text(connectionLabel(), width / 2, 32);
  text('haters left: ' + haterCount(), width / 2, 50);

  if (messageRemainingMs > 0) {
    fill(200, 60, 60);
    textSize(16);
    text(message, width / 2, 70);
  }

  if (soloMode) {
    fill(160, 100, 0);
    textSize(12);
    text('Solo mode — no room found', width / 2, 90);
  }

  // Always-on bottom-left readout so a stale deploy is obvious.
  fill(150);
  textAlign(LEFT, BOTTOM);
  textSize(11);
  text('fps: ' + frameRate().toFixed(0) + '  build: ' + BUILD_ID, 12, height - 8);

  drawChallengeHud();
}

function haterCount() {
  let n = 0;
  for (const e of entities) {
    if (e.type === 'hater') n++;
  }
  return n;
}

function connectionLabel() {
  if (isHost && connections.length === 0) return 'Host — waiting for players';
  if (isHost) return 'Host — players: ' + (connections.length + 1) + ' / ' + MAX_PLAYERS;
  if (connected) return 'Connected — players: ' + Object.keys(playerRegions).length + ' / ' + MAX_PLAYERS;
  return 'Connecting…';
}

// ---------- input ----------

function mousePressed() {
  ensureCamera();

  if (challenge.active && hitScanButton(mouseX, mouseY)) {
    onScanPressed();
    return false;
  }

  pressX = mouseX;
  pressY = mouseY;
  lastDragX = mouseX;
  lastDragY = mouseY;
  dragging = false;

  if (touches.length >= 2) {
    pinching = true;
    lastTapTime = 0;
    pinchStartDist = touchDistance();
    pinchStartZoom = view.zoom;
    return false;
  }

  if (pinching) {
    pinching = false;
    lastTapTime = 0;
    return false;
  }

  pinching = false;

  const now = millis();
  const withinTime = lastTapTime !== 0 && now - lastTapTime <= DOUBLE_TAP_TIME_MS;
  const withinSpace = dist(mouseX, mouseY, lastTapX, lastTapY) <= DOUBLE_TAP_MAX_DISTANCE;

  if (withinTime && withinSpace) {
    lastTapTime = 0;
    onDoubleTap(mouseX, mouseY);
  } else {
    lastTapTime = now;
    lastTapX = mouseX;
    lastTapY = mouseY;
  }

  return false;
}

function mouseDragged() {
  if (touches.length >= 2 || pinching) {
    handlePinch();
    return false;
  }

  if (dist(mouseX, mouseY, pressX, pressY) > 10) {
    if (!dragging) lastTapTime = 0;
    dragging = true;
  }

  if (dragging) {
    view.x -= (mouseX - lastDragX) / view.zoom;
    view.y -= (mouseY - lastDragY) / view.zoom;
    clampView();
  }

  lastDragX = mouseX;
  lastDragY = mouseY;
  return false;
}

function mouseReleased() {
  dragging = false;
  pinching = false;
  return false;
}

function mouseWheel(event) {
  view.zoom = constrain(view.zoom * (1 - event.delta * 0.001), MIN_ZOOM, MAX_ZOOM);
  clampView();
  return false;
}

function touchDistance() {
  const a = touches[0];
  const b = touches[1];
  return dist(a.x, a.y, b.x, b.y);
}

function handlePinch() {
  if (pinchStartDist <= 0) {
    pinchStartDist = touchDistance();
    pinchStartZoom = view.zoom;
    return;
  }
  const d = touchDistance();
  if (d > 0) {
    view.zoom = constrain(pinchStartZoom * (d / pinchStartDist), MIN_ZOOM, MAX_ZOOM);
    clampView();
  }
}

function clampView() {
  view.x = wrapX(view.x);
  view.y = wrapY(view.y);
}

function screenToWorldPoint(sx, sy) {
  return {
    x: view.x + (sx - width / 2) / view.zoom,
    y: view.y + (sy - height / 2) / view.zoom,
  };
}

function onDoubleTap(sx, sy) {
  const w = screenToWorldPoint(sx, sy);

  if (myRegion < 0) return;

  const target = findKillTarget(w.x, w.y);
  if (target) {
    requestKill(target.id);
    return;
  }

  if (regionAt(w.x, w.y) !== myRegion) {
    showMessage('That is not your region');
    return;
  }

  requestSpawn(wrapX(w.x), wrapY(w.y));
}

function findKillTarget(wx, wy) {
  let best = null;
  let bestD = KILL_HITBOX_RADIUS;

  for (const e of entities) {
    const d = dist(wx, wy, e.x, e.y);
    if (d <= bestD && regionAt(e.x, e.y) === myRegion) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function showMessage(text) {
  message = text;
  messageRemainingMs = 2500;
}

// ---------- networking ----------

function startNetwork() {
  if (!window.Peer) {
    goSolo();
    return;
  }

  const hostId = ROOM_ID + '-host';
  peer = new Peer(hostId, { debug: 0 });

  peer.on('open', () => {
    isHost = true;
    localId = peer.id;
    myRegion = 0;
    playerRegions[peer.id] = 0;
    if (!viewInitialized) centerOnRegion(0);
    seedHaters();
    challenge.nextAt = millis() + FIRST_CHALLENGE_DELAY_MS;
    connected = true;
  });

  peer.on('error', (err) => {
    if (err.type === 'unavailable-id' || !connected) {
      becomeClient();
    }
  });

  peer.on('connection', (conn) => {
    conn.on('open', () => {
      if (connections.length >= MAX_PLAYERS - 1) {
        conn.send({ type: 'FULL' });
        conn.close();
        return;
      }
      connections.push(conn);
      const region = freeRegion();
      playerRegions[conn.peer] = region;
      conn.send({ type: 'WELCOME', region: region, state: hostState() });
      broadcast({ type: 'STATE', state: hostState() });
    });

    conn.on('data', (data) => handleHostData(conn, data));
    conn.on('close', () => removePlayer(conn.peer));
  });
}

function becomeClient() {
  if (isHost) return;

  joinAttempts++;
  if (joinAttempts > 3) {
    goSolo();
    return;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (peer) {
    try { peer.destroy(); } catch (err) {}
  }

  const hostId = ROOM_ID + '-host';
  peer = new Peer(null, { debug: 0 });

  peer.on('open', () => {
    localId = peer.id;
    hostConn = peer.connect(hostId, { reliable: true });
    hostConn.on('open', () => {
      connected = true;
      joinAttempts = 0;
    });
    hostConn.on('data', (data) => handleClientData(data));
    hostConn.on('close', () => {
      connected = false;
      if (soloMode || isHost) return;
      showMessage('Host left — reconnecting…');
      reconnectTimer = setTimeout(() => {
        if (!connected && !isHost) becomeClient();
      }, 2500);
    });
  });

  peer.on('error', () => {
    if (!connected) becomeClient();
  });

  reconnectTimer = setTimeout(() => {
    if (!connected && !isHost) becomeClient();
  }, 8000);
}

function goSolo() {
  if (isHost) return;
  soloMode = true;
  isHost = true;
  connected = true;
  myRegion = 0;
  localId = 'host';
  playerRegions[localId] = 0;
  if (!viewInitialized) centerOnRegion(0);
  seedHaters();
  challenge.nextAt = millis() + FIRST_CHALLENGE_DELAY_MS;
  if (peer) {
    try { peer.destroy(); } catch (err) {}
  }
}

function freeRegion() {
  for (let r = 0; r < MAX_PLAYERS; r++) {
    let used = false;
    for (const id in playerRegions) {
      if (playerRegions[id] === r) used = true;
    }
    if (!used) return r;
  }
  return 0;
}

function removePlayer(peerId) {
  connections = connections.filter((c) => c.peer !== peerId);
  delete playerRegions[peerId];
  delete playerViews[peerId];
  delete playerTilt[peerId];
  broadcast({ type: 'STATE', state: hostState() });
}

function broadcast(msg) {
  for (const conn of connections) {
    if (conn.open) conn.send(msg);
  }
}

function sendToHost(msg) {
  if (isHost) {
    handleLocal(msg);
  } else if (hostConn && hostConn.open) {
    hostConn.send(msg);
  }
}

function handleLocal(msg) {
  if (msg.type === 'SPAWN') spawnCharacter(msg.x, msg.y, null, localId);
  if (msg.type === 'KILL') {
    const target = findEntity(msg.id);
    if (target && regionAt(target.x, target.y) === myRegion) killEntity(msg.id);
  }
  if (msg.type === 'SCAN' && msg.success) hostWipeHaters();
}

function handleHostData(conn, data) {
  if (!data || !data.type) return;

  if (data.type === 'SPAWN') {
    if (playerRegions[conn.peer] === regionAt(data.x, data.y)) {
      spawnCharacter(data.x, data.y, null, conn.peer);
    }
  } else if (data.type === 'KILL') {
    // A client may only remove things sitting inside its own region.
    const target = findEntity(data.id);
    if (target && playerRegions[conn.peer] === regionAt(target.x, target.y)) {
      killEntity(data.id);
    }
  } else if (data.type === 'VIEW') {
    playerViews[conn.peer] = data;
    playerTilt[conn.peer] = data.tilt;
  } else if (data.type === 'SCAN') {
    if (data.success) hostWipeHaters();
  }
}

function findEntity(id) {
  for (const e of entities) {
    if (e.id === id) return e;
  }
  return null;
}

function handleClientData(data) {
  if (data.type === 'WELCOME') {
    myRegion = data.region;
    connected = true;
    joinAttempts = 0;
    if (!viewInitialized) centerOnRegion(myRegion);
    applyState(data.state, true);
  } else if (data.type === 'STATE') {
    applyState(data.state, false);
  } else if (data.type === 'FULL') {
    showMessage('Room is full');
  }
}

function hostState() {
  return {
    entities: entities,
    challenge: {
      active: challenge.active,
      name: challenge.name,
      rgb: challenge.rgb,
      remainingMs: challenge.remainingMs,
    },
    regions: playerRegions,
    message: message,
    messageRemainingMs: messageRemainingMs,
  };
}

function applyState(state, snap) {
  if (!state || !state.challenge) return;

  const incoming = state.entities || [];
  const next = [];
  for (const e of incoming) {
    const existing = entities.find((old) => old.id === e.id);
    if (existing && !snap) {
      existing.tx = e.x;
      existing.ty = e.y;
      existing.isHeart = e.isHeart;
      existing.infected = e.infected;
      existing.color = e.color;
      existing.type = e.type;
      existing.owner = e.owner;
      next.push(existing);
    } else {
      next.push({
        id: e.id,
        type: e.type,
        owner: e.owner,
        x: e.x,
        y: e.y,
        tx: e.x,
        ty: e.y,
        isHeart: e.isHeart,
        infected: e.infected,
        color: e.color,
      });
    }
  }

  entities = next;
  challenge.active = state.challenge.active;
  challenge.name = state.challenge.name;
  challenge.rgb = state.challenge.rgb;
  challenge.remainingMs = state.challenge.remainingMs;

  // Keep a local message alive even when the host has nothing to say.
  if (state.messageRemainingMs > 0) {
    message = state.message || '';
    messageRemainingMs = state.messageRemainingMs;
  }

  for (const id in state.regions) {
    playerRegions[id] = state.regions[id];
  }
}

function networkTick() {
  if (isHost) {
    playerTilt[localId] = readTilt();
    playerViews[localId] = { x: view.x, y: view.y, zoom: view.zoom };
    hostUpdate();
    if (millis() - lastSyncSent >= NETWORK_SYNC_RATE_MS) {
      lastSyncSent = millis();
      broadcast({ type: 'STATE', state: hostState() });
    }
  } else {
    clientTick();
    if (millis() - lastSyncSent >= NETWORK_SYNC_RATE_MS && hostConn && hostConn.open) {
      lastSyncSent = millis();
      sendToHost({
        type: 'VIEW',
        x: view.x,
        y: view.y,
        zoom: view.zoom,
        tilt: readTilt(),
      });
    }
  }

  if (messageRemainingMs > 0) {
    messageRemainingMs -= deltaTime;
  }
}

function clientTick() {
  for (const e of entities) {
    const jumpX = Math.abs(e.tx - e.x);
    const jumpY = Math.abs(e.ty - e.y);
    if (jumpX > WORLD_WIDTH / 2 || jumpY > WORLD_HEIGHT / 2) {
      e.x = e.tx;
      e.y = e.ty;
    } else {
      e.x = lerp(e.x, e.tx, 0.45);
      e.y = lerp(e.y, e.ty, 0.45);
    }
  }
}

// ---------- host simulation ----------

function hostUpdate() {
  const dt = constrain(deltaTime / (1000 / 60), 0.25, 3);
  const now = millis();

  updateHaters(dt);
  updateCharacters(dt, now);
  checkInfections();
  updateChallenge(now);
}

function updateHaters(step) {
  for (const e of entities) {
    if (e.type !== 'hater') continue;

    const flee = fleeTarget(e);
    if (flee) {
      const a = Math.atan2(e.y - flee.y, e.x - flee.x);
      e.angle = a;
      e.x += Math.cos(a) * HATER_FLEE_SPEED * step;
      e.y += Math.sin(a) * HATER_FLEE_SPEED * step;
    } else {
      e.angle = (e.angle || 0) + random(-0.06, 0.06) * step;
      e.x += Math.cos(e.angle) * HATER_BASE_SPEED * step;
      e.y += Math.sin(e.angle) * HATER_BASE_SPEED * step;
    }

    e.x = wrapX(e.x);
    e.y = wrapY(e.y);
    e.tx = e.x;
    e.ty = e.y;
  }
}

function fleeTarget(e) {
  for (const id in playerViews) {
    const v = playerViews[id];
    const halfW = width / (2 * v.zoom);
    const halfH = height / (2 * v.zoom);
    if (Math.abs(e.x - v.x) < halfW && Math.abs(e.y - v.y) < halfH) {
      return { x: v.x, y: v.y };
    }
  }
  return null;
}

function updateCharacters(step, now) {
  for (const e of entities) {
    if (e.type === 'hater') continue;

    const tilt = playerTilt[e.owner] || { x: 0, y: 0 };
    e.vx = (e.vx || 0) + tilt.x * 4.5 * step;
    e.vy = (e.vy || 0) + tilt.y * 4.5 * VERTICAL_GRAVITY_MULT * step;

    const speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    const maxSpeed = 40 * step;
    if (speed > maxSpeed) {
      e.vx = (e.vx / speed) * maxSpeed;
      e.vy = (e.vy / speed) * maxSpeed;
    }

    e.x = wrapX(e.x + e.vx);
    e.y = wrapY(e.y + e.vy);
    e.tx = e.x;
    e.ty = e.y;

    if (e.isHeart && now - e.born >= HEART_TRANSFORM_MS) {
      e.isHeart = false;
    }
  }
}

function checkInfections() {
  for (const h of entities) {
    if (h.type !== 'hater') continue;
    for (const c of entities) {
      if (c.type === 'hater' || c.infected) continue;
      if (dist(h.x, h.y, c.x, c.y) <= INFECTION_RADIUS) {
        c.infected = true;
      }
    }
  }
}

function seedHaters() {
  for (let i = 0; i < HATER_COUNT; i++) {
    entities.push({
      id: nextEntityId++,
      type: 'hater',
      x: random(WORLD_WIDTH),
      y: random(WORLD_HEIGHT),
      tx: 0,
      ty: 0,
      vx: 0,
      vy: 0,
      angle: random(TWO_PI),
      isHeart: false,
      infected: false,
      color: null,
    });
  }
  for (const e of entities) {
    e.tx = e.x;
    e.ty = e.y;
  }
}

function spawnCharacter(x, y, color, owner) {
  if (entities.length >= MAX_ENTITIES) {
    showMessage('Entity limit reached');
    return;
  }

  entities.push({
    id: nextEntityId++,
    type: 'character',
    owner: owner || localId,
    x: x,
    y: y,
    tx: x,
    ty: y,
    vx: 0,
    vy: 0,
    isHeart: true,
    infected: false,
    color: color,
    born: millis(),
  });
}

function killEntity(id) {
  const before = entities.length;
  entities = entities.filter((e) => e.id !== id);
  return entities.length !== before;
}

function hostWipeHaters() {
  entities = entities.filter((e) => e.type !== 'hater');
  challenge.active = false;
  challenge.remainingMs = 0;
  challenge.nextAt = millis() + CHALLENGE_INTERVAL_MS;
  showMessage('All haters wiped!');
}

function updateChallenge(now) {
  if (challenge.active) {
    challenge.remainingMs = Math.max(0, challenge.remainingMs - deltaTime);
    if (challenge.remainingMs <= 0) {
      challenge.active = false;
      challenge.nextAt = now + CHALLENGE_INTERVAL_MS;
      showMessage('Challenge missed');
    }
    return;
  }

  if (now >= challenge.nextAt && challenge.nextAt !== 0) {
    const c = COLORS[Math.floor(random(COLORS.length))];
    challenge.active = true;
    challenge.name = c.name;
    challenge.rgb = c.rgb;
    challenge.remainingMs = COLOR_CHALLENGE_DURATION_SEC * 1000;
  }
}

// ---------- camera challenge ----------

function ensureCamera() {
  if (cameraRequested || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  cameraRequested = true;

  try {
    cam = createCapture({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    cam.size(CAM_WINDOW_WIDTH, CAM_WINDOW_HEIGHT);
    cam.hide();
  } catch (err) {
    cam = null;
    cameraRequested = false;
    return;
  }

  // "No error callback" is a p5 fact of life: if no frames arrive,
  // allow a later tap to try again instead of staying dead forever.
  setTimeout(() => {
    if (!camReady()) cameraRequested = false;
  }, 6000);
}

function camReady() {
  return !!(cam && cam.elt && cam.elt.videoWidth > 0);
}

function drawChallengeHud() {
  if (!challenge.active) return;

  const boxW = 220;
  const boxH = 56;
  const bx = width / 2 - boxW / 2;
  const by = height - boxH - 12;

  noStroke();
  fill(255, 255, 255, 240);
  rect(bx, by, boxW, boxH, 10);

  fill(challenge.rgb[0], challenge.rgb[1], challenge.rgb[2]);
  rect(bx + 10, by + 10, 36, 36, 6);

  fill(20);
  textAlign(LEFT, TOP);
  textSize(14);
  text('Find: ' + challenge.name.toUpperCase(), bx + 56, by + 10);
  text(Math.ceil(challenge.remainingMs / 1000) + 's', bx + 56, by + 30);

  imageMode(CORNER);

  if (camReady()) {
    const cw = CAM_WINDOW_WIDTH;
    const chh = CAM_WINDOW_HEIGHT;
    const cx = width - cw - 12;
    const cy = 92;

    camGfx.image(cam, 0, 0, cw, chh);
    image(camGfx, cx, cy, cw, chh);

    scanButton = { x: cx, y: cy + chh + 6, w: cw, h: 28 };
  } else {
    scanButton = { x: width - 132, y: 130, w: 120, h: 28 };
  }

  noStroke();
  fill(40, 130, 70);
  rect(scanButton.x, scanButton.y, scanButton.w, scanButton.h, 8);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text('Scan', scanButton.x + scanButton.w / 2, scanButton.y + scanButton.h / 2);

  if (camReady()) {
    noFill();
    stroke(255);
    strokeWeight(2);
    rect(scanButton.x + CAM_WINDOW_WIDTH / 2 - 20, 92 + CAM_WINDOW_HEIGHT / 2 - 20, 40, 40);
  }

  imageMode(CENTER);
}

function hitScanButton(mx, my) {
  return mx >= scanButton.x && mx <= scanButton.x + scanButton.w &&
         my >= scanButton.y && my <= scanButton.y + scanButton.h;
}

function onScanPressed() {
  ensureCamera();
  const sampled = sampleCameraColor();

  if (!sampled) {
    showMessage(cam ? 'Camera starting — try again' : 'Camera not available');
    return;
  }

  const d = dist(sampled[0], sampled[1], sampled[2], challenge.rgb[0], challenge.rgb[1], challenge.rgb[2]);

  if (d <= COLOR_MATCH_THRESHOLD) {
    sendToHost({ type: 'SCAN', success: true });
    showMessage('Color found!');
  } else {
    showMessage('No match — try again');
  }
}

function sampleCameraColor() {
  if (!camReady() || !camGfx) return null;

  camGfx.image(cam, 0, 0, CAM_WINDOW_WIDTH, CAM_WINDOW_HEIGHT);
  camGfx.loadPixels();

  const px = camGfx.pixels;
  if (!px || px.length === 0) return null;

  const cx = Math.floor(CAM_WINDOW_WIDTH / 2);
  const cy = Math.floor(CAM_WINDOW_HEIGHT / 2);
  const r = 8;
  let rr = 0;
  let gg = 0;
  let bb = 0;
  let n = 0;

  for (let y = cy - r; y < cy + r; y++) {
    for (let x = cx - r; x < cx + r; x++) {
      const i = 4 * (y * CAM_WINDOW_WIDTH + x);
      if (i + 3 >= px.length) continue;
      if (px[i + 3] === 0) continue;
      rr += px[i];
      gg += px[i + 1];
      bb += px[i + 2];
      n++;
    }
  }

  if (n === 0) return null;
  return [rr / n, gg / n, bb / n];
}

// ---------- shared helpers ----------

function centerOnRegion(r) {
  const c = regionCenter(r);
  view.x = c.x;
  view.y = c.y;
  viewInitialized = true;
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

function requestSpawn(x, y) {
  sendToHost({ type: 'SPAWN', x: x, y: y });
}

function requestKill(id) {
  sendToHost({ type: 'KILL', id: id });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function requestWakeLock() {
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
}