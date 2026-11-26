// Numbers to tune
const SENSOR_PROMPT_TEXT = 'Tap to start';
const ROOM_ID = 'atelier-shared-world-4p-r6';
const MAX_PLAYERS = 4;
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 2400;
const MIN_ZOOM = 0.14;
const MAX_ZOOM = 1.5;
// The map ends at the world edge, so zooming out used to reveal white
// around it. Clear to the same light blue as the water inside the map.
const MAP_WATER_RGB = [200, 232, 254];
const DOUBLE_TAP_TIME_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE = 25;
const HEART_TRANSFORM_MS = 2000;
const SPRITE_SIZE = 70;
const MAX_ENTITIES = 100;
// Haters only arrive via the double-tap reveal (no boot seeding) and
// roam the whole world freely — no regions, no edges to run to.
const HATER_BASE_SPEED = 1.5;
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
// A failed join is never final: keep trying to claim the room (or join the
// current host) on this cadence until a real shared world exists.
const JOIN_RETRY_MS = 3000;
// A WebRTC link can die without ever firing 'close' (backgrounded phone,
// network switch). Clients send VIEW heartbeats every NETWORK_SYNC_RATE_MS,
// so after this long of silence the host frees the seat for a waiting phone.
const PEER_TIMEOUT_MS = 6000;
// A successful scan is resent until the host confirms it. The host may be
// a background tab whose draw loop (and therefore the periodic state
// broadcast) is paused, so the wipe is broadcast the moment it happens.
const SCAN_RETRY_INTERVAL_MS = 500;
const SCAN_RETRY_WINDOW_MS = 8000;
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
// A spawned heart reveals as one of LOOK_COUNT + 1 outcomes: one of the
// positive profiles, or the hater. 0.25 = a 1-in-4 chance.
const HATER_SPAWN_CHANCE = 0.25;
const BUILD_ID = 'v32';

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
let cameraPermission = 'unknown';

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
let reconnectTimer = null;
let lastSyncSent = 0;
// Scan reconciliation: the host counts wipes, clients keep retrying until
// they see the counter move (see onScanPressed / applyState).
let wipeCount = 0;
let lastWipeCount = 0;
let scanPendingUntil = 0;
let lastScanSentAt = 0;

const playerRegions = {};
const playerTilt = {};
const playerViews = {};
const playerLastSeen = {};

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
  // Our p5 callbacks are declared in sketch.js before setup runs and all
  // return false, so p5-phone's one-time "handlers reassigned" warning is
  // noise here. Suppress only that warning, not the gesture wrapping.
  window._gestureHandlerAssignWarned = true;
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
  // Camera is intentionally NOT started here: this callback runs after the
  // sensor tap, and iOS only grants media permission inside a live gesture.
  // The SCAN COLOR button requests it instead.
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
  mapImg = await tryLoad('newmap.jpg');
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
  background(MAP_WATER_RGB[0], MAP_WATER_RGB[1], MAP_WATER_RGB[2]);
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
    const label = mine ? 'YOUR REGION ' + (r + 1) : 'REGION ' + (r + 1);
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
  // The heart disguise comes first: a hater still in its heart stage
  // must draw as a heart, exactly like the positive icons.
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
  // While the find-color banner is up it owns the top of the screen,
  // so the small status labels drop below it.
  const topY = challenge.active ? CHALLENGE_BANNER_TOP + CHALLENGE_BANNER_HEIGHT + 8 : 10;

  noStroke();
  fill(20);
  textAlign(CENTER, TOP);
  textSize(16);
  text('Your Region: ' + (myRegion < 0 ? '—' : myRegion + 1) + ' / ' + MAX_PLAYERS, width / 2, topY);

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
    text('Solo mode — PeerJS unavailable', width / 2, topY + 82);
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
    // Revealed haters only — counting heart-stage ones would leak the
    // roll before the reveal.
    if (e.type === 'hater' && !e.isHeart) n++;
  }
  return n;
}

function connectionLabel() {
  const players = isHost ? connections.length + 1 : Object.keys(playerRegions).length;
  const region = myRegion < 0 ? '—' : myRegion + 1;
  if (soloMode) return 'Solo — region ' + region + ' / ' + players + ' (no PeerJS)';
  if (isHost) return 'Host — region ' + region + ' · players ' + players + '/' + MAX_PLAYERS;
  if (connected) return 'Connected — region ' + region + ' · players ' + players + '/' + MAX_PLAYERS;
  return 'Connecting… — retrying';
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

// Profiles are permanent once revealed: neither a normal one nor a black
// infected one can be tapped away. Only a hater that has finished its heart
// disguise is killable. Keeping the disguise untouchable also preserves the
// 1-in-4 surprise — a disguised hater is indistinguishable from a real heart.
function isKillable(e) {
  return e.type === 'hater' && !e.isHeart;
}

function findKillTarget(wx, wy) {
  let best = null;
  let bestD = KILL_HITBOX_RADIUS;

  for (const e of entities) {
    const d = dist(wx, wy, e.x, e.y);
    if (d <= bestD && isKillable(e) && regionAt(e.x, e.y) === myRegion) {
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
//
// Host election uses one fixed PeerJS id. Whoever claims it is host and
// owns region 0; everyone else becomes a client and gets region 1-3 from
// the host. A failed join is NEVER final: the retry timer keeps trying to
// claim the room until somebody holds it. The old 4-error "goSolo()" path
// parked every phone in its own isolated region-0 world and never came
// back — that was the missing-regions bug.

function startNetwork() {
  if (!window.Peer) {
    goSolo();
    return;
  }
  tryClaimHost();
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function destroyPeer() {
  // Null out first: close() fires 'close' synchronously on some PeerJS
  // versions, and that must not re-enter this function.
  const conn = hostConn;
  hostConn = null;
  if (conn) {
    try { conn.close(); } catch (err) {}
  }
  const p = peer;
  peer = null;
  if (p) {
    try { p.destroy(); } catch (err) {}
  }
}

function clearMap(map) {
  for (const key in map) delete map[key];
}

function hasGoodRoom() {
  return !!hostConn && hostConn.open && connected && myRegion >= 0 && !soloMode;
}

function tryClaimHost() {
  if (hasGoodRoom()) return;
  clearReconnectTimer();
  destroyPeer();

  const hostId = ROOM_ID + '-host';
  try {
    peer = new Peer(hostId, { debug: 0 });
  } catch (err) {
    scheduleJoinRetry();
    return;
  }

  peer.on('open', () => becomeHost(peer.id));

  peer.on('error', () => {
    // A transient signaling error must not dethrone a working host.
    if (isHost && connected && !soloMode) return;
    // Someone else holds the id (or the claim failed): join them instead.
    becomeClient();
  });

  peer.on('connection', (conn) => {
    conn.on('open', () => {
      const now = millis();
      // Dead links may never fire 'close'. Reclaim their seats before
      // deciding the room is full, so a waiting phone is not stuck in FULL.
      pruneStaleConnections(now);
      // A retrying device can arrive twice. Drop its older link so one
      // phone cannot occupy two of the three client seats.
      const old = connections.find((c) => c.peer === conn.peer);
      if (!old && connections.length >= MAX_PLAYERS - 1) {
        conn.send({ type: 'FULL' });
        conn.close();
        return;
      }
      if (old) connections = connections.filter((c) => c !== old);
      connections.push(conn);
      // Keep the quadrant this peer already had across a reconnect.
      const region = playerRegions[conn.peer] !== undefined
        ? playerRegions[conn.peer]
        : freeRegion();
      playerRegions[conn.peer] = region;
      playerLastSeen[conn.peer] = now;
      conn.send({ type: 'WELCOME', region: region, state: hostState() });
      broadcast({ type: 'STATE', state: hostState() });
    });

    conn.on('data', (data) => handleHostData(conn, data));
    conn.on('close', () => removePlayer(conn.peer, conn));
    conn.on('error', () => removePlayer(conn.peer, conn));
  });
}

function becomeHost(id) {
  // A device that was solo/offline must throw away its private world.
  const freshHost = !isHost || soloMode;
  isHost = true;
  soloMode = false;
  connected = true;
  localId = id;
  myRegion = 0;

  if (freshHost) {
    entities = [];
    clearMap(playerRegions);
    clearMap(playerViews);
    clearMap(playerTilt);
    clearMap(playerLastSeen);
    connections = [];
    challenge.nextAt = millis() + FIRST_CHALLENGE_DELAY_MS;
    centerOnRegion(0);
  }
  playerRegions[id] = 0;
  clearReconnectTimer();
}

function becomeClient() {
  if (isHost && !soloMode) return;
  if (hasGoodRoom()) return;

  clearReconnectTimer();
  destroyPeer();

  const hostId = ROOM_ID + '-host';
  try {
    peer = new Peer(null, { debug: 0 });
  } catch (err) {
    scheduleJoinRetry();
    return;
  }

  peer.on('open', () => {
    localId = peer.id;
    let conn;
    try {
      conn = peer.connect(hostId, { reliable: true });
    } catch (err) {
      scheduleJoinRetry();
      return;
    }
    hostConn = conn;

    conn.on('open', () => {
      connected = true;
      isHost = false;
      soloMode = false;
    });
    conn.on('data', (data) => handleClientData(data));
    conn.on('close', () => onHostLinkLost());
    conn.on('error', () => onHostLinkLost());
  });

  peer.on('error', () => {
    if (!connected || soloMode) onHostLinkLost();
  });

  // Safety net for a stalled signaling server: no callback, still retry.
  scheduleJoinRetry();
}

function onHostLinkLost() {
  connected = false;
  if (isHost && !soloMode) return;
  showMessage('Connection lost — reconnecting…');
  destroyPeer();
  scheduleJoinRetry();
}

function scheduleJoinRetry() {
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (hasGoodRoom()) return;
    if (isHost && !soloMode) return;
    // Claim first: if the old host is gone, one of us becomes host; if it
    // is alive, the claim is refused and we join as a client instead.
    tryClaimHost();
  }, JOIN_RETRY_MS);
}

function goSolo() {
  // Only reachable when the PeerJS library itself failed to load.
  if (isHost && !soloMode) return;
  soloMode = true;
  isHost = true;
  connected = true;
  myRegion = 0;
  localId = 'host';
  clearMap(playerRegions);
  clearMap(playerViews);
  clearMap(playerTilt);
  clearMap(playerLastSeen);
  playerRegions[localId] = 0;
  entities = [];
  if (!viewInitialized) centerOnRegion(0);
  challenge.nextAt = millis() + FIRST_CHALLENGE_DELAY_MS;
  destroyPeer();
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

function removePlayer(peerId, closedConn) {
  const before = connections.length;
  connections = connections.filter((c) =>
    closedConn ? c !== closedConn : c.peer !== peerId
  );
  // A reconnect can leave an older link closing after the newer one is
  // already live. Only release the quadrant when no link remains.
  const stillConnected = connections.some((c) => c.peer === peerId);
  let released = false;
  if (!stillConnected && peerId in playerRegions) {
    delete playerRegions[peerId];
    delete playerViews[peerId];
    delete playerTilt[peerId];
    delete playerLastSeen[peerId];
    released = true;
  }
  if (connections.length !== before || released) {
    broadcast({ type: 'STATE', state: hostState() });
  }
}

// Drop seats whose peer has stopped sending VIEW heartbeats. This is the
// case a plain 'close' event misses: a phone that backgrounded, switched
// networks, or had its WebRTC link silently die keeps its PeerJS object
// open, so the host used to hold the quadrant until some *other* player
// happened to leave. Closing the dead link makes that phone reconnect
// cleanly when it comes back.
function pruneStaleConnections(now) {
  const dead = connections.filter((c) => {
    const seen = playerLastSeen[c.peer];
    return !c.open || seen === undefined || now - seen > PEER_TIMEOUT_MS;
  });
  for (const conn of dead) {
    try { conn.close(); } catch (err) {}
    removePlayer(conn.peer, conn);
  }
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

function sendScanToHost() {
  if (hostConn && hostConn.open) {
    hostConn.send({ type: 'SCAN', success: true });
    lastScanSentAt = millis();
  }
}

function handleLocal(msg) {
  if (msg.type === 'SPAWN') {
    spawnCharacter(msg.x, msg.y, null, localId);
    broadcastStateNow();
  }
  if (msg.type === 'KILL') {
    const target = findEntity(msg.id);
    if (target && isKillable(target) && regionAt(target.x, target.y) === myRegion) {
      killEntity(msg.id);
      broadcastStateNow();
    }
  }
  if (msg.type === 'SCAN' && msg.success) hostWipeHaters();
}

// Push state the instant something changes. The periodic broadcast lives
// in networkTick(), which runs from draw() — a hidden host tab pauses
// draw(), so mutations must not depend on it.
function broadcastStateNow() {
  broadcast({ type: 'STATE', state: hostState() });
}

function handleHostData(conn, data) {
  // Any packet proves this peer is alive, not just VIEW.
  playerLastSeen[conn.peer] = millis();
  if (!data || !data.type) return;

  if (data.type === 'SPAWN') {
    if (playerRegions[conn.peer] === regionAt(data.x, data.y)) {
      spawnCharacter(data.x, data.y, null, conn.peer);
      broadcastStateNow();
    }
  } else if (data.type === 'KILL') {
    // A client may only remove a revealed hater inside its own region.
    const target = findEntity(data.id);
    if (target && isKillable(target) &&
        playerRegions[conn.peer] === regionAt(target.x, target.y)) {
      killEntity(data.id);
      broadcastStateNow();
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
    const regionChanged = myRegion !== data.region;
    myRegion = data.region;
    connected = true;
    isHost = false;
    soloMode = false;
    clearReconnectTimer();
    // A device that was briefly solo has viewInitialized = true from
    // region 0. It must re-center on the region the host actually gave
    // it, or every phone stays parked on the top-left quadrant.
    if (regionChanged || !viewInitialized) centerOnRegion(myRegion);
    applyState(data.state, true);
  } else if (data.type === 'STATE') {
    applyState(data.state, false);
  } else if (data.type === 'FULL') {
    showMessage('Room is full');
    scheduleJoinRetry();
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
      wipeCount: wipeCount,
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

  // Host confirmation of a wipe clears the retry window.
  const incomingWipe = state.challenge.wipeCount || 0;
  if (incomingWipe > lastWipeCount) {
    lastWipeCount = incomingWipe;
    scanPendingUntil = 0;
  }

  // Until the host confirms (or the retry window lapses), keep the
  // optimistic local wipe: no haters, no banner, no scan window.
  const pending = scanPendingUntil > millis();
  entities = pending ? next.filter((e) => e.type !== 'hater') : next;
  challenge.active = state.challenge.active && !pending;
  challenge.name = state.challenge.name;
  challenge.rgb = state.challenge.rgb;
  challenge.remainingMs = state.challenge.remainingMs;

  // Keep a local message alive even when the host has nothing to say.
  if (state.messageRemainingMs > 0) {
    message = state.message || '';
    messageRemainingMs = state.messageRemainingMs;
  }

  if (state.regions) {
    // Mirror the host's map exactly (drop players who left), and make
    // sure our own region matches what the host assigned. This is the
    // safety net if WELCOME was missed after a reconnect.
    for (const id in playerRegions) {
      if (!(id in state.regions)) delete playerRegions[id];
    }
    for (const id in state.regions) {
      playerRegions[id] = state.regions[id];
    }
    const assigned = state.regions[localId];
    if (assigned !== undefined && assigned !== myRegion) {
      myRegion = assigned;
      centerOnRegion(myRegion);
    }
  }
}

function networkTick() {
  if (isHost) {
    const now = millis();
    pruneStaleConnections(now);
    playerTilt[localId] = readTilt();
    playerViews[localId] = { x: view.x, y: view.y, zoom: view.zoom };
    hostUpdate();
    if (now - lastSyncSent >= NETWORK_SYNC_RATE_MS) {
      lastSyncSent = now;
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

    // Keep resending a successful scan until the host confirms it.
    if (scanPendingUntil > millis()) {
      if (millis() - lastScanSentAt >= SCAN_RETRY_INTERVAL_MS) sendScanToHost();
    } else if (scanPendingUntil !== 0) {
      scanPendingUntil = 0;
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
    if (e.type !== 'hater' || e.isHeart) continue;

    // Haters roam the whole canvas freely — no region walls, no fleeing
    // to the edges. They simply wrap around the world torus like the
    // camera does.
    e.angle = (e.angle || 0) + random(-0.06, 0.06) * step;
    e.x = wrapX(e.x + Math.cos(e.angle) * HATER_BASE_SPEED * step);
    e.y = wrapY(e.y + Math.sin(e.angle) * HATER_BASE_SPEED * step);

    e.tx = e.x;
    e.ty = e.y;
  }
}

function updateCharacters(step, now) {
  const damp = Math.pow(MOVE_DAMPING, step);

  for (const e of entities) {
    // Revealed haters steer themselves in updateHaters; haters still in
    // their heart stage are handled here like any other heart.
    if (e.type === 'hater' && !e.isHeart) continue;

    if (e.infected) {
      // A profile that has turned black is frozen where it was infected:
      // no tilt drift, no bounce, no interpolation for the other phones.
      e.vx = 0;
      e.vy = 0;
      e.tx = e.x;
      e.ty = e.y;
    } else {
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
    }

    // An infected heart still finishes its reveal, so it becomes a black
    // profile rather than staying a heart forever.
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
    // A hater still in heart disguise infects nothing yet.
    if (h.type !== 'hater' || h.isHeart) continue;
    for (const c of entities) {
      if (c.type === 'hater' || c.infected) continue;
      if (dist(h.x, h.y, c.x, c.y) <= INFECTION_RADIUS) {
        c.infected = true;
        // Stop on the exact infection spot and pin the network target so
        // watching phones see it freeze too.
        c.vx = 0;
        c.vy = 0;
        c.tx = c.x;
        c.ty = c.y;
      }
    }
  }
}

function spawnCharacter(x, y, color, owner) {
  if (entities.length >= MAX_ENTITIES) {
    showMessage('Entity limit reached');
    return;
  }

  // The roll happens under the heart, same as the look pick: 1-in-4
  // this icon is secretly the hater, otherwise one of the positives.
  if (Math.random() < HATER_SPAWN_CHANCE) {
    spawnHater(x, y, owner || localId);
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

// A hater born disguised as a heart. While isHeart is true it is
// handled exactly like any other heart (tilt drift, region bounce,
// the 2s transform); after the reveal it roams the whole world.
function spawnHater(x, y, owner) {
  entities.push({
    id: nextEntityId++,
    type: 'hater',
    owner: owner,
    look: 0,
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

function killEntity(id) {
  const before = entities.length;
  entities = entities.filter((e) => e.id !== id);
  return entities.length !== before;
}

function hostWipeHaters() {
  clearHaters();
  wipeCount++;
  challenge.nextAt = millis() + CHALLENGE_INTERVAL_MS;
  showMessage('All haters wiped!');

  // Broadcast right here instead of waiting for the next draw() tick:
  // a backgrounded host tab pauses its draw loop, and without this the
  // phones would never hear that the wipe happened.
  broadcastStateNow();
}

// Shared local half of a wipe. Safe to run on host or client.
function clearHaters() {
  entities = entities.filter((e) => e.type !== 'hater');
  // A clean sweep also cures infected profiles: they lose the black tint
  // and start moving with tilt again on the next update.
  for (const e of entities) {
    if (e.infected) e.infected = false;
  }
  challenge.active = false;
  challenge.remainingMs = 0;
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

async function ensureCamera() {
  if (cameraRequested || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  cameraRequested = true;

  // Ask for permission inside the tap. p5's createCapture() calls
  // getUserMedia internally and logs a loud NotAllowedError to the console
  // when access is denied; preflighting here lets us fail quietly and show
  // our own message instead. A granted permission then makes createCapture
  // succeed without another prompt.
  try {
    const probe = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    probe.getTracks().forEach((track) => track.stop());
    cameraPermission = 'granted';
  } catch (err) {
    cameraPermission = 'denied';
    cameraRequested = false;
    return;
  }

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
    showMessage(
      cameraPermission === 'denied'
        ? 'Camera blocked — allow camera access'
        : (cam ? 'Camera starting — try again' : 'Camera not available')
    );
    return;
  }

  if (colorMatches(sampled, challenge.rgb)) {
    if (isHost) {
      hostWipeHaters();
    } else {
      // Optimistic local wipe: the window, banner and haters disappear
      // immediately, then the host is told (and reminded) until it
      // confirms with a STATE carrying the new wipeCount.
      clearHaters();
      challenge.nextAt = millis() + CHALLENGE_INTERVAL_MS;
      scanPendingUntil = millis() + SCAN_RETRY_WINDOW_MS;
      sendScanToHost();
    }
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