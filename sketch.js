// Numbers to tune
const SENSOR_PROMPT_TEXT = 'Tap to start';
// Room id is version-stamped: bump it on ANY network protocol change.
// v15 changed the SPAWN message without bumping this, so phones kept
// joining a stale v14 host (an old tab holding the claim) — that host
// auto-seeded haters and silently rejected the new spawn messages.
const ROOM_ID = 'atelier-shared-world-4p-r2';
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
const HATER_BASE_SPEED = 1.5;
// One double-tap spawns this many icons (3 friends + 1 hater by
// default) at random spots inside the tapping player's region.
const SPAWN_BURST_SIZE = 4;
const SPAWN_HATERS_PER_BURST = 1;
const INFECTION_RADIUS = 45;
const KILL_HITBOX_RADIUS = 50;
const NETWORK_SYNC_RATE_MS = 66;
const TILT_RANGE = 25;
const TILT_CURVE = 1.3;
const VERTICAL_GRAVITY_MULT = 1.6;
const MOVE_GRAVITY = 1.6;
const MOVE_MAX_SPEED = 11;
const MOVE_DAMPING = 0.995;
const REGION_BOUNCE = 0.55;
const LOOK_COUNT = 3;
const BUILD_ID = 'v16';

let goodPfps = [];
let heartImg;
let haterImg;
let mapImg;

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

let message = '';
let messageRemainingMs = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  lockGestures();
  enableSensorTap(SENSOR_PROMPT_TEXT);
  showDesktopQr({ label: 'Scan to open on your phone' });
  requestWakeLock();
  loadAssets();
  startNetwork();
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
  // Everything spawns as a heart first — haters included — so the
  // heart check comes before the type check.
  if (e.isHeart) {
    if (heartImg) {
      image(heartImg, e.x, e.y, SPRITE_SIZE, SPRITE_SIZE);
    } else {
      drawFallbackHeart(e.x, e.y, SPRITE_SIZE);
    }
    return;
  }

  if (e.type === 'hater') {
    if (haterImg) {
      image(haterImg, e.x, e.y, SPRITE_SIZE, SPRITE_SIZE);
    } else {
      drawFallbackHater(e.x, e.y, SPRITE_SIZE);
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
  const topY = 10;

  noStroke();
  fill(20);
  textAlign(CENTER, TOP);
  textSize(16);
  text('Your Region: ' + (myRegion < 0 ? '—' : myRegion), width / 2, topY);

  textSize(12);
  fill(90);
  text(connectionLabel(), width / 2, topY + 22);
  text('haters: ' + haterCount(), width / 2, topY + 40);

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

  // Always-on bottom-left readout so a stale deploy is obvious.
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

  // The tap itself is just the trigger — the host scatters a burst of
  // icons at random spots inside your region.
  requestSpawn();
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
  if (msg.type === 'SPAWN') spawnBurst(myRegion, localId);
  if (msg.type === 'KILL') {
    const target = findEntity(msg.id);
    if (target && regionAt(target.x, target.y) === myRegion) killEntity(msg.id);
  }
}

function handleHostData(conn, data) {
  if (!data || !data.type) return;

  if (data.type === 'SPAWN') {
    // The host picks all burst positions, so a client can only ever
    // add icons inside its own region.
    const region = playerRegions[conn.peer];
    if (region !== undefined) {
      spawnBurst(region, conn.peer);
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
    regions: playerRegions,
    message: message,
    messageRemainingMs: messageRemainingMs,
  };
}

function applyState(state, snap) {
  if (!state) return;

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
      existing.region = e.region;
      next.push(existing);
    } else {
      next.push({
        id: e.id,
        type: e.type,
        owner: e.owner,
        look: e.look,
        region: e.region,
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

  updateHaters(dt, now);
  updateCharacters(dt, now);
  checkInfections();
}

function updateHaters(step, now) {
  for (const e of entities) {
    if (e.type !== 'hater') continue;

    // Haters no longer flee toward the edges of the world — they
    // wander gently and bounce inside the region they spawned in,
    // exactly like the positive icons.
    e.angle = (e.angle || 0) + random(-0.06, 0.06) * step;
    e.x += Math.cos(e.angle) * HATER_BASE_SPEED * step;
    e.y += Math.sin(e.angle) * HATER_BASE_SPEED * step;

    bounceHater(e);

    e.tx = e.x;
    e.ty = e.y;

    if (e.isHeart && now - e.born >= HEART_TRANSFORM_MS) {
      e.isHeart = false;
    }
  }
}

// Haters are region-bound like the good icons, but they steer with an
// angle instead of a velocity, so a wall hit mirrors the heading.
function bounceHater(e) {
  if (e.region === undefined || e.region === null) {
    e.x = wrapX(e.x);
    e.y = wrapY(e.y);
    return;
  }

  const b = regionBounds(e.region);
  const pad = SPRITE_SIZE / 2;
  const minX = b.x + pad;
  const maxX = b.x + WORLD_WIDTH / 2 - pad;
  const minY = b.y + pad;
  const maxY = b.y + WORLD_HEIGHT / 2 - pad;

  if (e.x < minX) {
    e.x = minX;
    e.angle = Math.PI - e.angle;
  } else if (e.x > maxX) {
    e.x = maxX;
    e.angle = Math.PI - e.angle;
  }

  if (e.y < minY) {
    e.y = minY;
    e.angle = -e.angle;
  } else if (e.y > maxY) {
    e.y = maxY;
    e.angle = -e.angle;
  }
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
    // Haters only infect once their heart disguise drops.
    if (h.isHeart) continue;
    for (const c of entities) {
      if (c.type === 'hater' || c.infected) continue;
      if (dist(h.x, h.y, c.x, c.y) <= INFECTION_RADIUS) {
        c.infected = true;
      }
    }
  }
}

// One double-tap = a burst of icons at random spots inside the tapping
// player's region. Mostly friends plus one hater — everything starts
// as a heart, so the hater is a surprise reveal after 2s.
function spawnBurst(region, owner) {
  if (region === undefined || region < 0) return;

  for (let i = 0; i < SPAWN_BURST_SIZE; i++) {
    const p = randomPointInRegion(region);
    if (i < SPAWN_HATERS_PER_BURST) {
      spawnHater(p.x, p.y, region);
    } else {
      spawnCharacter(p.x, p.y, null, owner);
    }
  }
}

function randomPointInRegion(region) {
  const b = regionBounds(region);
  const pad = SPRITE_SIZE / 2 + 12;
  return {
    x: random(b.x + pad, b.x + WORLD_WIDTH / 2 - pad),
    y: random(b.y + pad, b.y + WORLD_HEIGHT / 2 - pad),
  };
}

function spawnHater(x, y, region) {
  if (entities.length >= MAX_ENTITIES) return;

  entities.push({
    id: nextEntityId++,
    type: 'hater',
    owner: null,
    look: 0,
    region: region,
    x: x,
    y: y,
    tx: x,
    ty: y,
    vx: 0,
    vy: 0,
    angle: random(TWO_PI),
    isHeart: true,
    infected: false,
    color: null,
    born: millis(),
  });
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

function requestSpawn() {
  sendToHost({ type: 'SPAWN' });
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