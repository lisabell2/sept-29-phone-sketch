// Numbers to tune
const SENSOR_PROMPT_TEXT = 'Tap to start';
const ROOM_ID = 'atelier-shared-world-4p-r3';
const MAX_PLAYERS = 4;
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 2400;
const MIN_ZOOM = 0.14;
const MAX_ZOOM = 1.5;
const DOUBLE_TAP_TIME_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE = 25;
const HEART_TRANSFORM_MS = 2000;
const SPRITE_SIZE = 70;
const MAX_ENTITIES = 100;
const HATER_COUNT = 6;
const HATER_BASE_SPEED = 1.5;
const HATER_FLEE_SPEED = 4.0;
const INFECTION_RADIUS = 45;
const KILL_HITBOX_RADIUS = 50;
const COLOR_CHALLENGE_DURATION_SEC = 30;
const COLOR_MATCH_THRESHOLD = 75;
// Perception-based matching tolerances (see colorMatches): phones
// auto-expose and auto-white-balance, so brightness is unreliable.
const COLOR_HUE_TOLERANCE_DEG = 35;
const COLOR_SAT_MIN = 0.18;
const COLOR_LIGHTNESS_TOLERANCE = 0.25;
const COLOR_ACHROMATIC_SAT_MAX = 0.22;
const COLOR_WHITE_LUM_MIN = 0.4;
const COLOR_BLACK_LUM_MAX = 0.38;
const CHALLENGE_BANNER_TOP = 12;
const CHALLENGE_BANNER_HEIGHT = 84;
const CAM_WINDOW_WIDTH = 200;
const CAM_WINDOW_HEIGHT = 150;
const NETWORK_SYNC_RATE_MS = 66;
const FIRST_CHALLENGE_DELAY_MS = 30000;
const CHALLENGE_INTERVAL_MS = 45000;
const TILT_RANGE = 25;
const TILT_CURVE = 1.3;
const VERTICAL_GRAVITY_MULT = 1.6;
const MOVE_GRAVITY = 1.6;
const MOVE_MAX_SPEED = 11;
const MOVE_DAMPING = 0.995;
const REGION_BOUNCE = 0.55;
const LOOK_COUNT = 3;
const BUILD_ID = 'v14';

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

let goodPfps = [];
let heartImg;
let haterImg;
let mapImg;

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
  const looks = ['goodpfp1.png', 'goodpfp.2.png', 'goodpfp.3.png'];
  goodPfps = [];
  for (const file of looks) {
    const img = await tryLoad(file);
    if (img) goodPfps.push(img);
  }
  heartImg = await tryLoad('nh.png');
  haterImg = await tryLoad('badpfp.png');
  mapImg = await tryLoad('map.png');
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
  drawMap();
  drawRegions();
  drawEntities();
}

function drawMap() {
  if (!mapImg) return;
  push();
  imageMode(CORNER);
  image(mapImg, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  pop();
}

function drawRegions() {
  const halfW = WORLD_WIDTH / 2;
  const halfH = WORLD_HEIGHT / 2;

  for (let r = 0; r < 4; r++) {
    const b = regionBounds(r);
    const mine = r === myRegion;

    noFill();
    if (mine) {
      stroke(60, 130, 255, 220);
      strokeWeight(4 / view.zoom);
    } else {
      stroke(255, 160);
      strokeWeight(2 / view.zoom);
    }
    rect(b.x, b.y, halfW, halfH);

    // Label on a backing chip so it stays readable on the map photo.
    const label = mine ? 'YOUR REGION' : 'REGION ' + r;
    const ts = 22 / view.zoom;
    textSize(ts);
    const tw = textWidth(label) + 26 / view.zoom;
    const th = ts + 12 / view.zoom;
    const lx = b.x + halfW / 2 - tw / 2;
    const ly = b.y + 16 / view.zoom;

    noStroke();
    fill(mine ? color(40, 90, 200, 210) : color(0, 0, 0, 130));
    rect(lx, ly, tw, th, 8 / view.zoom);
    fill(255);
    textAlign(CENTER, CENTER);
    text(label, lx + tw / 2, ly + th / 2);
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
      image(haterImg, e.x, e.y, SPRITE_SIZE, SPRITE_SIZE);
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

  const look = e.look || 0;
  const img = goodPfps.length ? goodPfps[look % goodPfps.length] : null;
  if (img) {
    image(img, e.x, e.y, SPRITE_SIZE, SPRITE_SIZE);
  } else {
    fallbackCircle(e.x, e.y, SPRITE_SIZE, look);
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

const FALLBACK_LOOKS = [
  [90, 140, 220],
  [240, 150, 60],
  [130, 200, 120],
];

function fallbackCircle(cx, cy, size, look) {
  const c = FALLBACK_LOOKS[(look || 0) % FALLBACK_LOOKS.length];
  fill(c[0], c[1], c[2]);
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
  // While the find-color banner is up it owns the top of the screen,
  // so the small status labels drop below it.
  const topY = challenge.active ? CHALLENGE_BANNER_TOP + CHALLENGE_BANNER_HEIGHT + 8 : 10;

  noStroke();
  fill(20);
  textAlign(CENTER, TOP);
  textSize(16);
  text('Your Region: ' + (myRegion < 0 ? '—' : myRegion), width / 2, topY);

  textSize(12);
  fill(90);
  text(connectionLabel(), width / 2, topY + 22);
  text('haters left: ' + haterCount(), width / 2, topY + 40);

  if (messageRemainingMs > 0) {
    fill(200, 60, 60);
    textSize(16);
    text(message, width / 2, topY + 60);
  }

  if (soloMode) {
    fill(160, 100, 0);
    textSize(12);
    text('Solo mode — no room found', width / 2, topY + 82);
  }

  drawChallengeHud();

  // Always-on bottom-left readout so a stale deploy is obvious.
  // Drawn last so the camera window can never cover it.
  fill(150);
  textAlign(LEFT, BOTTOM);
  textSize(11);
  text('fps: ' + frameRate().toFixed(0) + '  build: ' + BUILD_ID, 12, height - 8);
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
      existing.look = e.look;
      next.push(existing);
    } else {
      next.push({
        id: e.id,
        type: e.type,
        owner: e.owner,
        look: e.look,
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
  const damp = Math.pow(MOVE_DAMPING, step);

  for (const e of entities) {
    if (e.type === 'hater') continue;

    const tilt = playerTilt[e.owner] || { x: 0, y: 0 };
    e.vx = ((e.vx || 0) + tilt.x * MOVE_GRAVITY * step) * damp;
    e.vy = ((e.vy || 0) + tilt.y * MOVE_GRAVITY * VERTICAL_GRAVITY_MULT * step) * damp;

    const speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    const maxSpeed = MOVE_MAX_SPEED * step;
    if (speed > maxSpeed) {
      e.vx = (e.vx / speed) * maxSpeed;
      e.vy = (e.vy / speed) * maxSpeed;
    }

    e.x += e.vx;
    e.y += e.vy;

    // Characters tilt around freely but never leave their owner's
    // region: they bounce off its walls instead of crossing over.
    // (Haters keep roaming the whole torus.)
    const region = playerRegions[e.owner];
    if (region !== undefined) {
      boundToRegion(e, region);
    } else {
      e.x = wrapX(e.x);
      e.y = wrapY(e.y);
    }

    e.tx = e.x;
    e.ty = e.y;

    if (e.isHeart && now - e.born >= HEART_TRANSFORM_MS) {
      e.isHeart = false;
    }
  }
}

function boundToRegion(e, region) {
  const b = regionBounds(region);
  const pad = SPRITE_SIZE / 2;
  const minX = b.x + pad;
  const maxX = b.x + WORLD_WIDTH / 2 - pad;
  const minY = b.y + pad;
  const maxY = b.y + WORLD_HEIGHT / 2 - pad;

  if (e.x < minX) {
    e.x = minX;
    e.vx = Math.abs(e.vx || 0) * REGION_BOUNCE;
  } else if (e.x > maxX) {
    e.x = maxX;
    e.vx = -Math.abs(e.vx || 0) * REGION_BOUNCE;
  }

  if (e.y < minY) {
    e.y = minY;
    e.vy = Math.abs(e.vy || 0) * REGION_BOUNCE;
  } else if (e.y > maxY) {
    e.y = maxY;
    e.vy = -Math.abs(e.vy || 0) * REGION_BOUNCE;
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
    look: Math.floor(Math.random() * LOOK_COUNT),
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

  drawChallengeBanner();

  imageMode(CORNER);

  // The scan window sits at the bottom-center of the screen, with the
  // button right above it.
  const cw = CAM_WINDOW_WIDTH;
  const chh = CAM_WINDOW_HEIGHT;
  const cx = width / 2 - cw / 2;
  const cy = height - chh - 12;

  if (camReady()) {
    camGfx.image(cam, 0, 0, cw, chh);
    image(camGfx, cx, cy, cw, chh);

    // White frame plus a crosshair over the spot that gets sampled.
    noFill();
    stroke(255);
    strokeWeight(3);
    rect(cx, cy, cw, chh);
    strokeWeight(2);
    rect(cx + cw / 2 - 22, cy + chh / 2 - 22, 44, 44);
    noStroke();
  }

  // Same spot whether or not the camera has started, so the button never
  // jumps around when the feed comes alive.
  scanButton = { x: cx, y: cy - 42, w: cw, h: 30 };

  noStroke();
  fill(40, 130, 70);
  rect(scanButton.x, scanButton.y, scanButton.w, scanButton.h, 10);
  fill(255);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(18);
  text('SCAN COLOR', scanButton.x + scanButton.w / 2, scanButton.y + scanButton.h / 2);
  textStyle(NORMAL);

  imageMode(CENTER);
}

function drawChallengeBanner() {
  const bannerW = Math.min(width - 24, 400);
  const bannerH = CHALLENGE_BANNER_HEIGHT;
  const bx = (width - bannerW) / 2;
  const by = CHALLENGE_BANNER_TOP;

  const secs = Math.ceil(challenge.remainingMs / 1000);
  const label = 'FIND ' + challenge.name.toUpperCase();
  const countdown = secs + 's LEFT';

  // Card with a soft shadow.
  noStroke();
  fill(0, 0, 0, 45);
  rect(bx + 3, by + 4, bannerW, bannerH, 18);
  fill(255, 255, 255, 248);
  stroke(25);
  strokeWeight(2);
  rect(bx, by, bannerW, bannerH, 18);

  // Color swatch.
  const swatch = 52;
  const sx = bx + 14;
  const sy = by + (bannerH - swatch) / 2;
  fill(challenge.rgb[0], challenge.rgb[1], challenge.rgb[2]);
  rect(sx, sy, swatch, swatch, 12);
  noStroke();

  const tx = sx + swatch + 16;
  const maxTextW = bannerW - (tx - bx) - 14;

  fill(20);
  textAlign(LEFT, CENTER);
  textStyle(BOLD);
  fitTextSize(label, maxTextW, 30);
  text(label, tx, by + bannerH / 2 - 15);

  const urgent = secs <= 10;
  fill(urgent ? color(205, 30, 30) : 90);
  fitTextSize(countdown, maxTextW, 24);
  text(countdown, tx, by + bannerH / 2 + 15);
  textStyle(NORMAL);
}

// Shrinks the text size until the label fits maxW. Call after textStyle()
// so measurement matches what gets drawn.
function fitTextSize(label, maxW, startSize) {
  let size = startSize;
  textSize(size);
  while (size > 16 && textWidth(label) > maxW) {
    size -= 2;
    textSize(size);
  }
  return size;
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

  if (colorMatches(sampled, challenge.rgb)) {
    sendToHost({ type: 'SCAN', success: true });
    showMessage('Color found!');
  } else {
    // Report what the camera actually saw — phones under auto-exposure
    // render white as gray, and this readout makes that visible.
    showMessage(
      'No match — saw ' +
        Math.round(sampled[0]) + ', ' +
        Math.round(sampled[1]) + ', ' +
        Math.round(sampled[2])
    );
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

// Exposure-tolerant color matching. A phone camera meters a white wall
// down to pale gray and tints colors with auto-white-balance, so raw RGB
// distance alone fails on exactly the surfaces people scan. Fast path:
// the classic RGB distance. Slow path: compare hue + saturation +
// lightness, which survives brightness drift.
function colorMatches(sampled, target) {
  const rawD = dist(sampled[0], sampled[1], sampled[2], target[0], target[1], target[2]);
  if (rawD <= COLOR_MATCH_THRESHOLD) return true;

  const s = rgbToHsl(sampled[0], sampled[1], sampled[2]);
  const t = rgbToHsl(target[0], target[1], target[2]);

  // White / black targets carry no hue: accept anything still colorless
  // that lands on the right half of the brightness range.
  if (t[1] < COLOR_ACHROMATIC_SAT_MAX) {
    if (s[1] > COLOR_ACHROMATIC_SAT_MAX) return false;
    return t[2] >= 0.5 ? s[2] >= COLOR_WHITE_LUM_MIN : s[2] <= COLOR_BLACK_LUM_MAX;
  }

  // Colored target: match the hue, require real saturation (a gray wall
  // must not match), and allow wide brightness drift from auto-exposure.
  return (
    s[1] >= COLOR_SAT_MIN &&
    hueDistanceDeg(s[0], t[0]) <= COLOR_HUE_TOLERANCE_DEG &&
    Math.abs(s[2] - t[2]) <= COLOR_LIGHTNESS_TOLERANCE
  );
}

function rgbToHsl(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const lum = (max + min) / 2;
  let hueDeg = 0;
  let sat = 0;
  const d = max - min;

  if (d > 0.0001) {
    sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) hueDeg = 60 * (((gg - bb) / d) % 6);
    else if (max === gg) hueDeg = 60 * ((bb - rr) / d + 2);
    else hueDeg = 60 * ((rr - gg) / d + 4);
  }
  if (hueDeg < 0) hueDeg += 360;
  return [hueDeg, sat, lum];
}

function hueDistanceDeg(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
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