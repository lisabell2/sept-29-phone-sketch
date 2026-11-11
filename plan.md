# Plan: Bounce Around Phone Sketch

## Idea
you double tap to add a heart to the screen, after 2 seconds the heart turns into / gets replaced with a character image. all pngs will bounce around within the screen once phone is tilted.

## Layout & Assets
- Layout match where things sit and their size from `references/layout.design.jpg`:
  - Bound within a screen, they bounce around inside (no edges escape).
  - Double tap adds a heart.
  - Heart turns into a character image; takes 2 seconds.
  - Already reacts to tilt.
  - More characters on screen; they bounce from everything.
  - Screen appearance: white screen with a very light grey square grid, no sound no effects.
  - Starting condition: start empty, 100 limit.
  - Sprite sizes: just estimate a size, kinda small (estimated at ~14% of screen width).

## References

| File / Asset | Location | Role / Description |
| :--- | :--- | :--- |
| `layout.design.jpg` | `references/layout.design.jpg` | Layout and interaction sketch showing screen bounds, double-tap heart spawn, 2-second character replacement, and tilt bouncing. |
| `character1.png` | `references/character1.png` | 1 character image that the heart turns into after 2 seconds. |
| `character2.png` | `references/character2.png` | The heart itself spawned on double tap. |

---

## Steps

### Step 1: Canvas Setup, Gesture Locking, and Screen Wake Lock
- **What to build:** Create a full-window responsive canvas that prevents browser pull-to-refresh and pinch-zoom behaviors, and request a wake lock so the phone screen stays awake during testing.
- **Functions to use:**
  - `p5.js`: `createCanvas(windowWidth, windowHeight)`, `windowResized()`, `resizeCanvas()`, `background()`.
  - `p5-phone` & browser: `lockGestures()`, `showDesktopQr()`, `navigator.wakeLock.request('screen')`.
- **What you see on laptop:** A full-window canvas with a floating desktop QR code in the corner for mobile testing.
- **What you see on phone:** A clean full-screen canvas that fills the screen without viewport bounce or browser zoom when touched.
- **Numbers to tune at top of `sketch.js`:**
  - (None for this step)

### Step 2: Background Grid Rendering
- **What to build:** Render a clean white background patterned with a very light grey square grid that recalculates dynamically on canvas resize.
- **Functions to use:**
  - `p5.js`: `background(255)`, `stroke()`, `strokeWeight()`, `line()`, `for` loops across `width` and `height`.
- **What you see on laptop:** Full browser window displaying a white surface with subtle light grey square gridlines.
- **What you see on phone:** Full phone screen displaying the same crisp, subtle light grey square grid pattern.
- **Numbers to tune at top of `sketch.js`:**
  - `GRID_SIZE = 36`
  - `GRID_LINE_COLOR = 232`
  - `GRID_LINE_WEIGHT = 1`

### Step 3: Sensor Activation Overlay & Tilt Detection Test
- **What to build:** Wire up motion sensor unlocking using p5-phone and verify tilt input (`rotationX`, `rotationY`) by gating hardware reads behind `window.sensorsEnabled`.
- **Functions to use:**
  - `p5-phone`: `enableSensorTap('Tap to enable motion sensors')` (or `enableSensorCanvas()`), checking `if (window.sensorsEnabled)`.
  - `p5.js`: reading `rotationX`, `rotationY`, `text()`, `fill()`, `textAlign()`.
- **What you see on laptop:** The unlock prompt overlay appears; clicking dismisses it (sensors show 0 or mock values on desktop).
- **What you see on phone:** Tap prompt appears on first load; tapping grants permission, overlay clears, and live numeric tilt values change smoothly when the phone is tilted.
- **Numbers to tune at top of `sketch.js`:**
  - `SENSOR_PROMPT_TEXT = 'Tap to enable motion sensors'`

### Step 4: Asset Preload with Vector Fallbacks
- **What to build:** Preload `character1.png` and `character2.png` from the `references/` directory, providing fallback procedural shapes (a simple circle and a simple heart) if the files are not yet in place.
- **Functions to use:**
  - `p5.js`: `preload()`, `loadImage()`, `image()`, `imageMode(CENTER)`.
- **What you see on laptop:** Assets load into memory without console errors, and draw centered placeholder shapes if files are absent.
- **What you see on phone:** Assets load cleanly on the mobile browser over GitHub Pages / local server.
- **Numbers to tune at top of `sketch.js`:**
  - `SPRITE_SIZE_RATIO = 0.14` (approximate fraction of screen width)

### Step 5: Double-Tap Gesture Detection
- **What to build:** Implement double-tap detection using pointer/touch callbacks to reliably record tap timestamps and positions, filtering out accidental single taps and long drags.
- **Functions to use:**
  - `p5.js`: `mousePressed()` (or touch events handled through p5 2.x pointer standards), `millis()`, `dist()`.
- **What you see on laptop:** Double-clicking rapidly logs a successful double-click and draws a temporary debug marker at the mouse location.
- **What you see on phone:** Rapid double-tapping with your finger reliably triggers at the touch point without triggering browser zoom.
- **Numbers to tune at top of `sketch.js`:**
  - `DOUBLE_TAP_MAX_DELAY = 300` (max milliseconds between taps)
  - `DOUBLE_TAP_MAX_DISTANCE = 25` (max pixels drift between taps)

### Step 6: Entity Spawning, Tilt Gravity, and Screen Boundary Bounce
- **What to build:** Create an entity system where double-tapping spawns a heart (`character2.png`) up to a 100-character limit; the heart immediately accelerates according to device tilt and bounces elastically off all four screen edges.
- **Functions to use:**
  - `p5.js`: `constrain()`, `image()`, `rotationX`, `rotationY`.
- **What you see on laptop:** Double-clicking creates a heart that rests at the bottom or moves if key/mouse tilt simulation is used.
- **What you see on phone:** Double-tapping spawns a heart that immediately slides, gathers speed when you tilt the phone, and bounces cleanly off the edges of the screen without getting stuck.
- **Numbers to tune at top of `sketch.js`:**
  - `MAX_ENTITIES = 100`
  - `GRAVITY_FORCE = 0.35`
  - `FRICTION_DAMPING = 0.98`
  - `RESTITUTION = 0.75` (bounciness against screen edges)

### Step 7: Timed Transformation from Heart to Character
- **What to build:** Track each spawned heart's lifetime so that after exactly 2 seconds (2000 ms), the sprite image swaps from `character2.png` to `character1.png` while seamlessly preserving position and velocity, with no sound and no visual effects.
- **Functions to use:**
  - `p5.js`: `millis()`.
- **What you see on laptop:** Double-clicking creates a heart; exactly 2 seconds later it switches to the character image while continuing on its path.
- **What you see on phone:** Double-tap spawns a heart sliding around; at 2 seconds it changes into `character1.png` mid-motion.
- **Numbers to tune at top of `sketch.js`:**
  - `TRANSFORM_DELAY_MS = 2000`

### Step 8: Mutual Elastic Collisions Between All Sprites
- **What to build:** Add circle-to-circle collision detection and response between all active sprites (hearts and characters alike) so they bounce off each other elastically in addition to bouncing off screen boundaries.
- **Functions to use:**
  - `p5.js`: `dist()`, `atan2()`, `cos()`, `sin()`.
- **What you see on laptop:** Multiple spawned entities collide and rebound off one another realistically.
- **What you see on phone:** Tilting the phone rolls characters and hearts into each other; they collide, rebound, and scatter across the grid without overlapping or glitching, staying stable up to 100 items.
- **Numbers to tune at top of `sketch.js`:**
  - `COLLISION_RESTITUTION = 0.85` (bounciness between colliding sprites)

---

## Assumptions
- Character and heart sprites are square or roughly circular in proportion and can be treated as circular bounding colliders of identical diameter (~14% screen width) for collision math.
- The 2-second countdown begins immediately upon the second tap of the double-tap gesture.
- If the 100 entity cap is reached, additional double-taps are ignored until the sketch is refreshed.
- Motion permissions will be requested on the first user tap via p5-phone's sensor activation flow.

---

## Changes

### Step 1: Canvas Setup, Gesture Locking, and Screen Wake Lock
- `sketch.js` rebuilt for a full-window responsive canvas.
- `setup()` calls `createCanvas(windowWidth, windowHeight)`, `lockGestures()` to block pull-to-refresh and pinch-zoom, `showDesktopQr()` for the desktop QR corner code, and `requestWakeLock()`.
- Added `windowResized()` calling `resizeCanvas(windowWidth, windowHeight)` so the canvas follows rotation and browser chrome changes.
- Added `requestWakeLock()` helper requesting `navigator.wakeLock.request('screen')`, guarded by `'wakeLock' in navigator` with a swallowed `.catch` for unsupported/denied cases.
- `draw()` keeps the current flat background for now; the Step 2 grid replaces it.
- No tunable numbers introduced at this step, per plan.

### Step 2: Background Grid Rendering
- Added tunable constants at the top of `sketch.js`: `GRID_SIZE = 36`, `GRID_LINE_COLOR = 232`, `GRID_LINE_WEIGHT = 1`.
- Added `drawGrid()`, called from `draw()`: `background(255)` then `stroke`/`strokeWeight` loops drawing vertical and horizontal lines across the current `width` and `height`.
- Because the grid reads `width` and `height` every frame, it recalculates itself on resize/rotation with no extra code beyond Step 1's `windowResized()`.

### Step 3: Sensor Activation Overlay & Tilt Detection Test
- Added tunable constant `SENSOR_PROMPT_TEXT = 'Tap to enable motion sensors'`.
- `setup()` now calls `enableSensorTap(SENSOR_PROMPT_TEXT)` after `lockGestures()`, so the permission request happens from a real user tap (required by iOS transient activation).
- `draw()` reads motion only behind `if (window.sensorsEnabled) return;` — before the tap the prompt overlay is the only thing on screen; after it, live `rotationX`, `rotationY`, `rotationZ` values are drawn in the top-left using `nf(rotationX, 2, 1)` for fixed one-decimal formatting.

### Step 4: Asset Preload with Vector Fallbacks
- Copied the three reference files into the project's own `references/` directory: `character1.png`, `character2.png`, `layout.design.jpg`. Previously the PNGs only existed inside `.agents/skills/p5js-2x/references/`, which is skill documentation, not sketch assets.
- Added tunable constant `SPRITE_SIZE_RATIO = 0.14`.
- Replaced `preload()` with `loadAssets()`, an `async` function called at the end of `setup()` that uses `await loadImage()` — the p5.js 2.x pattern, since 2.x `load*` calls return Promises and `preload()` is no longer the default idiom.
- Each load is wrapped in its own `try`/`catch`, so a missing file leaves the variable `null` instead of throwing and blanking the sketch.
- `drawAssetPreview()` draws both sprites centered at 14% of canvas width, and `drawFallbackHeart()` / `fallbackCircle()` render a procedural pink heart and blue circle when the corresponding PNG failed to load.
- `imageMode(CENTER)` is set once in `loadAssets()` so all later sprite drawing positions from the center.
- The preview pair is temporary: Step 6 replaces this with real spawned entities.

### Step 5: Double-Tap Gesture Detection
- Added tunables `DOUBLE_TAP_MAX_DELAY = 300` and `DOUBLE_TAP_MAX_DISTANCE = 25`, plus module-level `lastTapTime`, `lastTapX`, `lastTapY`, `debugMarker`.
- Implemented detection in `mousePressed()` using `millis()` for the time window and `dist()` for drift between taps. p5.js 2.x unifies mouse and touch under the pointer model, so this one callback covers finger taps on the phone; p5 1.x `touchStarted()` is not used.
- `lastTapTime` is reset to `0` after a successful pair so a third tap cannot chain into a false triple-tap match.
- `drawDebugMarker()` flashes a green 24px circle for 500ms at the detected point and logs coordinates, so the gesture is verifiable before spawning exists.
- `mousePressed()` returns `false` to leave touch handling to p5-phone's gesture lock.

### Step 6: Entity Spawning, Tilt Gravity, and Screen Boundary Bounce
- Added tunables `MAX_ENTITIES = 100`, `GRAVITY_FORCE = 0.35`, `FRICTION_DAMPING = 0.98`, `RESTITUTION = 0.75`.
- Added module-level `entities = []`. Each entity is a plain object with `x`, `y`, `vx`, `vy`, `size`, `isHeart`, `born`.
- `spawnEntity(x, y)` pushes a heart at the tap point and silently returns if `entities.length >= MAX_ENTITIES`, so the cap needs no external reset.
- `mousePressed()` now calls `spawnEntity(mouseX, mouseY)` on a confirmed double tap, replacing Step 5's log-only behaviour. The debug marker is kept.
- `updateEntities()` runs each frame: adds tilt-derived acceleration, damps velocity by `FRICTION_DAMPING`, integrates position, then calls `bounceWithinScreen()`.
- `readTilt()` gates on `window.sensorsEnabled` and returns `{ x: 0, y: 0 }` when sensors are off, then normalizes `rotationY` (left/right tilt drives `x`) and `rotationX` (front/back tilt drives `y`) through `constrain(v / 45, -1, 1)` so the force stays bounded at ±1.
- `bounceWithinScreen()` clamps each sprite to stay fully inside the canvas using half its size, and flips the velocity sign with `Math.abs()` * `RESTITUTION` so restitution never flips an entity outward. All four edges handled symmetrically.
- `drawEntities()` renders every entity centered with `image(img, e.x, e.y, e.size, e.size)`, falling back to the procedural heart/circle shapes. The Step 4 static preview pair was removed since sprites are now real entities.
- `size` is captured at spawn time from `width * SPRITE_SIZE_RATIO`; on rotation, `windowResized()` resizes the canvas and positions clamp against the new bounds.
- Entity count is drawn in the tilt readout so the 100 cap is visible while testing.

### Step 7: Timed Transformation from Heart to Character
- Added tunable `TRANSFORM_DELAY_MS = 2000`.
- Each entity stores `born: millis()` at spawn, and `updateEntities()` flips `e.isHeart = false` once `millis() - e.born >= TRANSFORM_DELAY_MS`.
- Only the `isHeart` flag changes, so position and velocity are untouched across the swap — the sprite keeps its exact path with no sound or visual effect, as specified.
- `drawEntities()` reads `isHeart` each frame to pick `heartImg`/`character2` art or `characterImg`/`character1` art, so the swap is automatic and needs no separate transform branch.

### Step 8: Mutual Elastic Collisions Between All Sprites
- Added tunable `COLLISION_RESTITUTION = 0.85`.
- `updateEntities()` now ends with `resolveEntityCollisions()`, so collision response runs after integration and after the wall bounce in the same frame — sprites can never be pushed back out through an edge after a mutual hit.
- `resolveEntityCollisions()` is a pairwise `for i` / `for j` loop over `entities`, treating each sprite as a circle of radius `size / 2`. `dist()` gives the centre distance, skipped when it already meets or exceeds the combined radii.
- Zero-distance guard: if two sprites are exactly coincident (both spawned on the same pixel, or after a hard overlap) `dist()` returns 0 and the division below would produce `NaN`. In that case the code substitutes a `(1, 0)` axis and `d = 1` so the response stays finite and they still separate.
- Overlap is resolved by splitting the penetration in half along the unit normal `n`, computed as `dx / d`, `dy / d`, moving each sprite by `overlap = (minDistance - d) / 2` in opposite directions. Symmetric splitting avoids drift toward one sprite.
- Elastic impulse uses the relative velocity projected onto the normal: `separatingSpeed = (b.v - a.v) · n`. `atan2` is not needed because the normal is derived from the position delta directly.
- The `if (separatingSpeed > 0) continue` guard makes the response idempotent — a pair already moving apart is skipped, which prevents the jitter/spiral-of-death when two sprites rest in contact under tilt gravity.
- `impulse = (-(1 + COLLISION_RESTITUTION) * separatingSpeed) / 2` is then subtracted from `a.v` and added to `b.v`, giving equal-and-opposite momentum exchange with `COLLISION_RESTITUTION` controlling bounciness between sprites (separate from `RESTITUTION`, which only applies to screen edges).
- Both hearts and characters collide, since the check reads only position and size.

---

## Final State Notes
- All eight steps are implemented. Bumping behaviour comes entirely from the constants block at the top of `sketch.js`; nothing below `setup()` needs editing for tuning.
- `index.html` references `sketch.js?v=4`. This query string must be incremented on every deploy, because GitHub Pages serves `Cache-Control: max-age=600` and mobile browsers will otherwise run a stale sketch for up to 10 minutes.

### Tuning Pass: Larger, Faster Movement
- `SPRITE_SIZE_RATIO` raised `0.14` → `0.22` (14% → 22% of canvas width per sprite).
- `GRAVITY_FORCE` raised `0.35` → `1.1` for a much stronger pull from tilt.
- `FRICTION_DAMPING` raised `0.98` → `0.995` so velocity decays far more slowly and sprites keep gliding between bounces. Note this is a per-frame multiplier: `0.995` retains ~74% of speed after 100 frames versus ~18% at `0.98`.
- `RESTITUTION` `0.75` → `0.85` and `COLLISION_RESTITUTION` `0.85` → `0.9` so bounces stay lively at the higher speed.
- Added `MAX_SPEED = 14` as a new tunable, enforced in `updateEntities()` by normalizing velocity with `dist()` when exceeded. Without a cap, the reduced damping lets a sprite accumulate enough speed in one frame to skip past another sprite's collision radius entirely (tunneling), which shows up as sprites passing through each other. 14px/frame stays well under the 22%-of-width sprite diameter.
- Sprite size is captured at spawn time from `width * SPRITE_SIZE_RATIO`, so the larger ratio takes effect for newly spawned entities; existing ones keep the size they were born with until refresh.

### Tuning Pass 2: Large Sprites, Strong Gravity, Aggressive Bounces
- `SPRITE_SIZE_RATIO` `0.22` → **`0.34`** — roughly a third of screen width per sprite.
- `GRAVITY_FORCE` `1.1` → **`2.4`**, more than doubling the acceleration from tilt.
- `FRICTION_DAMPING` `0.995` → **`0.998`** — retains ~97% of speed per 100 frames, so sprites accelerate hard instead of coasting to a stop.
- `RESTITUTION` `0.85` → **`0.92`** and `COLLISION_RESTITUTION` `0.9` → **`0.95`** for livelier bounces off edges and off each other.
- `MAX_SPEED` `14` → **`22`**, raised to stay safely under the new 34%-of-width sprite diameter and avoid tunneling.

#### Falling straight down when tilted
- New tunable `TILT_RANGE = 25`, replacing the hardcoded `/ 45` divisor in `readTilt()`. A phone held upright sits near `rotationX ≈ 0`, so a smaller range means useful force arrives at a much shallower angle. 25° reaches full force.
- New tunable `TILT_CURVE = 1.7`, applied in the new `curveTilt()` helper: `Math.sign(n) * Math.pow(Math.abs(n), TILT_CURVE)` on the normalized value. The exponent above 1 makes the response nonlinear — gentle near level so sprites settle instead of buzzing, then steep near the limit so past ~15° they pull hard toward the low edge.
- New tunable `VERTICAL_GRAVITY_MULT = 1.6`, applied only to the `tilt.y` term in `updateEntities()`. Front/back tilt produces a stronger pull than left/right tilt, which is what makes the sprites visibly drop rather than slide when the phone is tipped up or down.
- Entity readout now shows `entities: N / 100` so the cap is easier to confirm at the larger sprite size.

#### Notes for further tuning
- `TILT_CURVE` below 1 would invert the behaviour (more sensitive when nearly level, weaker when steep). Raise it for a more dramatic drop-off; lower it toward 1 for linear feel.
- If sprites pass through each other when moving fast, reduce `MAX_SPEED` — or raise `SPRITE_SIZE_RATIO`, since collision radius scales with sprite size.

### Tuning Pass 3: Speed Increase and Frame-Rate Independence
- `GRAVITY_FORCE` `2.4` → **`4.5`**, `FRICTION_DAMPING` `0.998` → **`0.999`**, `MAX_SPEED` `22` → **`40`**.
- The root cause of perceived slowness was not just the force values: the physics ran in raw per-frame units, so behaviour depended entirely on refresh rate. At 120Hz a phone integrates twice as often as a 60Hz laptop, and `FRICTION_DAMPING` is a per-frame multiplier, so a 120Hz device also lost twice as much speed per second. The same code felt slow and sluggish on one device and different on another.
- Added `frameScale()` helper, used throughout `updateEntities()`: `constrain(deltaTime / (1000 / 60), 0.25, 3)`. This returns ~1.0 at 60fps, ~2.0 at 120fps, and is clamped at both ends so a slow frame or a backgrounded tab cannot spike the physics.
- Gravity and position integration are multiplied by `frameScale()`, so acceleration is per-second rather than per-frame and a 120Hz phone moves sprites at the same perceived speed as a 60Hz laptop.
- Damping is converted per-frame via `Math.pow(FRICTION_DAMPING, step)` rather than applied raw, which keeps the *total* energy loss per second constant across refresh rates instead of double-decaying at 120Hz.
- `MAX_SPEED` is likewise scaled (`MAX_SPEED * step`) so the velocity cap is a real per-second ceiling, not a per-frame one that effectively halves the top speed on high-refresh displays.
- Tunneling safety still holds: at 120Hz the effective per-frame travel stays near the 60Hz value because both force and cap scale together, and the 40px cap remains well under the 34%-of-width sprite diameter.
- `frameRate()` added to the on-screen readout so the actual refresh rate is visible while testing — useful for confirming whether a device is running at 60 or 120.
- `index.html` bumped to `sketch.js?v=6`.
- Added `BUILD_ID = 'v6'` constant, shown in the on-screen readout next to `fps`. This is a diagnostic: if the phone displays a different build string than expected, the device is running a cached copy and no amount of cache-busting in the URL will help until its site data is cleared. Bump `BUILD_ID` alongside the `?v=` number on every deploy.

### Asset Swap: New Heart Image
- Replaced `references/character2.png` with a new pixel-art heart (414KB → 814KB). The path is unchanged, so no code change was needed for the swap itself.
- Added `assetUrl(file)` helper appending `?v=BUILD_ID` to asset paths, and routed both `loadImage()` calls through it. This is necessary because GitHub Pages caches the PNGs for 10 minutes too — bumping the `?v=` on `sketch.js` alone refreshes the code but leaves the phone showing the *old cached PNG*. The query string is what makes replaced art appear immediately.
- `BUILD_ID` → `'v7'` and `index.html` → `sketch.js?v=7`, both bumped together.
- One asset can now be refreshed independently of the code: bumping `BUILD_ID` invalidates both the script and every image in one step.
- Note on the new art: it is a wide, near-square-bounding shape with a transparent background. Sprites still draw into a square box of `SPRITE_SIZE_RATIO` of screen width and collide as circles of `size / 2`, so a wide heart will visually overlap neighbours slightly more than the collision model implies, and will render slightly smaller than its bounding box implies.
- Hardware sensors stay behind `window.sensorsEnabled`. On desktop the values read 0, so sprites settle and collide under gravity alone — real sliding requires the phone.
- Assets live in `references/` (copied out of the skills folder): `character1.png`, `character2.png`, `layout.design.jpg`. Procedural fallbacks cover either PNG failing to load.

---

## Rewrite: 4-Player Shared World (from `plan.md2.md`)

Scope delivered, per request: all 4 users add + remove sprites in only their own region, zooming out shows the other 3 regions live, and succeeding the back-camera color challenge wipes every hater. The remaining `plan.md2.md` steps (dual-camera reach-in, per-scan colored rewards, etc.) are **not** in this build.

### Architecture
- `sketch.js` rewritten around a **2400×2400 torus world** split into 4 fixed 1200×1200 regions. `regionAt(x, y)` maps any world point to region 0–3; `wrapX()`/`wrapY()` wrap coordinates, so sprites leaving one edge re-enter the opposite one. Wall bouncing is gone: `RESTITUTION`, `COLLISION_RESTITUTION`, `FRICTION_DAMPING`, `SPRITE_SIZE_RATIO` and the screen-bounce/collision code were removed.
- **PeerJS host/client topology** (`peerjs@1.5.4` added to `index.html`). The first tab to claim `ROOM_ID + '-host'` becomes the authoritative host; everyone else connects as a client. The host simulates *everything* (tilt physics per player, hater wandering/fleeing, infection, the heart timer, the challenge clock) and broadcasts full state ~15×/sec (`NETWORK_SYNC_RATE_MS = 66`). Clients interpolate positions (`clientTick` lerp with a torus-jump snap) and send only their view/tilt.
- Clients are assigned regions in join order (host = region 0); each phone's camera opens centered on its own region (`centerOnRegion`), so you start on "your island" and pinch out to find the other three.
- If PeerJS is unavailable, the room is full, or no host answers within ~3 join attempts / 8s, the sketch falls back to `goSolo()` — a local, offline host on region 0 flagged "Solo mode" in the HUD.

### Region rules
- Double-tap in your own region spawns a heart → character after `HEART_TRANSFORM_MS = 2000` (same as before). Double-tap outside it shows "That is not your region" and nothing spawns.
- Kill is also region-gated, on both ends: the client only targets entities inside its region (`findKillTarget`), and the host re-validates every `KILL` message against the sender's assigned region, so a modified client cannot remove things from someone else's region. The same validation guards `SPAWN`.
- Anyone can kill a **hater** that wanders into their region; haters flee at `HATER_FLEE_SPEED` whenever any player's current view contains them, otherwise wander at `HATER_BASE_SPEED`, and infect non-hater sprites within `INFECTION_RADIUS` (tinted dark).

### Color challenge (hater wipe)
- The host schedules the first challenge after `FIRST_CHALLENGE_DELAY_MS = 15000`, then every `CHALLENGE_INTERVAL_MS = 45000` after a win or a miss.
- When active, every phone shows a HUD card with a random color name + swatch, a 30s countdown (`COLOR_CHALLENGE_DURATION_SEC`), a small live back-camera window (`facingMode: environment`) and a green **Scan** button. Pressing Scan samples the center 16×16 px of the camera feed (`sampleCameraColor`) and compares it to the target RGB with `COLOR_MATCH_THRESHOLD = 75`.
- On a match the host runs `hostWipeHaters()`: every hater is removed, the challenge closes, "All haters wiped!" is broadcast, and the next one is scheduled 45s later. On a miss/timeout: "Challenge missed".
- The camera is created lazily from the first user tap (`ensureCamera()` from `mousePressed`/`userSetupComplete`) so the permission prompt rides a real gesture. `camReady()` gates preview and sampling on `videoWidth > 0`, and a failed attempt releases the request flag after 6s so a later tap can retry.

### Tunables replaced / added
- Removed: `RESTITUTION`, `COLLISION_RESTITUTION`, `FRICTION_DAMPING`, `SPRITE_SIZE_RATIO`, `DOUBLE_TAP_MAX_DELAY`, `TRANSFORM_DELAY_MS` (renamed), old per-frame gravity constants.
- Added: `ROOM_ID`, `MAX_PLAYERS = 4`, `WORLD_WIDTH/WORLD_HEIGHT = 2400`, `MIN_ZOOM/MAX_ZOOM`, `DOUBLE_TAP_TIME_MS`, `HEART_TRANSFORM_MS`, `SPRITE_SIZE = 55` (world px, screen-size independent), `HATER_COUNT = 6`, `HATER_BASE/FLEE_SPEED`, `INFECTION_RADIUS`, `KILL_HITBOX_RADIUS`, `COLOR_*`, `CAM_WINDOW_*`, `NETWORK_SYNC_RATE_MS`, `FIRST_CHALLENGE_DELAY_MS`, `CHALLENGE_INTERVAL_MS`, `MOVE_GRAVITY`, `MOVE_MAX_SPEED`. `MAX_ENTITIES = 100` kept as the global cap; tilt tuning (`TILT_RANGE`, `TILT_CURVE`, `VERTICAL_GRAVITY_MULT`) carried over unchanged.

### Deviations from `plan.md2.md`
- `MIN_ZOOM` is **0.14**, not the planned 0.35 — 0.35 shows only ~1.5 regions on a phone; 0.14 fits all 2400 world px on screen so the "zoom out and see the big picture" moment actually lands.
- Input uses `mousePressed/mouseDragged/mouseReleased` + `touches[]` instead of the plan's `touchStarted/touchMoved` — p5.js 2.x removed the touch callbacks as no-ops. Pinch-zoom and one-finger pan are built on `touches[]`; `mouseWheel` zooms on desktop.
- Kill is literal own-region-only (a hater that flees into someone else's quadrant can only be removed by that region's owner). This matches the plan's assumptions; the "chase across the map" reading would need a rule change.
- `references/hater.png` does not exist yet — `tryLoad()` leaves `haterImg` null and `drawFallbackHater()` draws a dark spiky blob with red eyes. Drop the file into `references/` and it is used automatically (via `assetUrl`).
- The plan's "infinite map" is a fixed 2400×2400 torus (the grid draws beyond the edges, so it *looks* endless in every direction).
- Success grants the group wipe (per this build's scope), not the plan's extra colored character.

### p5.js 2.x / p5-phone notes hit during this pass
- p5 2.x reserves global names: our `screenToWorld()` collided with p5's built-in (fatal "Cannot redefine property" at load) → renamed `screenToWorldPoint()`. Top-level `const key` / `const step` also trip redeclaration warnings → renamed. Any new helper name should be checked against the 2.x reference.
- Camera readiness must be checked via `navigator.mediaDevices` (not `window.mediaDevices`, which is undefined — this silently disabled the camera in the first draft).

### Verification
- Host path exercised live in a desktop browser: host claim, region-0 centering, 6 haters seeded/wandering/wrapping, double-tap spawn + 2s transform + double-tap kill, challenge cycle (activates → 30s → miss → reschedules), zoom to 0.14.
- Message-level tests drove the host/client logic directly: `WELCOME` state application on a client (region 2, view centered, entities/owner synced), spawn accepted only in the sender's region, kills rejected outside it, `SCAN` success removing all 6 haters and clearing the challenge, tilt deltas (4.5/3.6 px per unit step), infection on contact, and torus interpolation.
- WebRTC DataChannels cannot negotiate inside the OpenCode embedded browser, so the live multi-tab sync path was **not** end-to-end verified here — it needs a real test on 2+ phones (or two separate desktop browsers). The PeerJS message flow itself is exercised via the simulated messages above.

### Known limitations / next steps
- If the host phone locks its screen, its simulation pauses for everyone (single-host model). Clients drop to solo after ~30s of dead host; reloading rejoins.
- Everyone visiting the deployed page shares one fixed room (`ROOM_ID`), so the 5th+ visitor lands in solo mode — by design for the 4-player piece.
- `index.html` → `sketch.js?v=8` and `BUILD_ID = 'v8'`, bumped together per the cache-busting convention. The HUD keeps the `fps:` / `build:` readout bottom-left and adds `haters left: N`.

### Art Swap & Tuning Pass 4: Map Base, Three Profile Looks, Calmer Motion (v9)
- **New art** (all in `references/`, loaded through `assetUrl()` so `BUILD_ID` invalidates them): `map.png` (1254×1254), `goodpfp1.png` / `goodpfp.2.png` / `goodpfp.3.png` (1254×1254 each), `badpfp.png` (1235×1274) used as the hater art in place of the never-supplied `hater.png`.
- **Map as the base**: `drawGrid()` (and `GRID_SIZE` / `GRID_LINE_COLOR` / `GRID_LINE_WEIGHT`) removed. `drawMap()` draws `map.png` stretched over exactly `0,0 → WORLD_WIDTH,WORLD_HEIGHT` with `imageMode(CORNER)` inside `push()`/`pop()` so the CENTER mode used by sprites is preserved. Outside the world the canvas stays white.
- Region outlines restyled for the photo base: your region gets a brighter blue border, the other three semi-transparent white; the region labels now sit on backing chips (blue for yours, translucent black otherwise) so they stay readable over the map photo. The translucent blue fill that used to wash your whole region is gone.
- **Three good looks, randomly picked**: `characterImg` replaced by `goodPfps = []`. Each spawned character stores `look: Math.floor(Math.random() * LOOK_COUNT)` (`LOOK_COUNT = 3`), drawn as `goodPfps[look % length]`. The heart still spawns first and transforms after 2s into one of the three looks. `look` is a plain entity field, so it syncs to clients automatically — it was added to both branches of `applyState()`'s field copy. `character1.png` is no longer loaded.
- The old `character2.png` heart is unchanged, and `badpfp.png` renders un-tinted (the `tint(70)` on haters was dropped since the art itself reads as "bad"). Infected characters are still darkened with `tint(70)`.
- **Calmer motion** — the old constants were inherited from the single-screen sketch and were wildly fast at world scale (40px/frame crosses the whole 2400px map in one second):
  - `MOVE_GRAVITY` `4.5` → **`0.5`** (tilt acceleration, previously hardcoded in `updateCharacters`).
  - `MOVE_MAX_SPEED` `40` → **`6`** (~360 world px/s at full tilt — about 8× slower; a 1200px region now takes ~3.3s to cross).
  - New `MOVE_DAMPING = 0.985`, applied as `Math.pow(MOVE_DAMPING, step)` to velocity each step — sprites now glide to a stop within a couple of seconds when the phone is level, instead of drifting forever.
  - `TILT_RANGE` `25` → **`30`** and `TILT_CURVE` `1.7` → **`2.0`**: full force now needs a steeper tilt and the response is gentler near level, giving finer low-speed control.
- **Bigger sprites**: `SPRITE_SIZE` `55` → **`70`** world px; `INFECTION_RADIUS` `35` → `45` and `KILL_HITBOX_RADIUS` `40` → `50` scaled to match.
- Verified locally: all assets load; random `look` spread across the three pfps; one second of full tilt moves a sprite ~180px horizontally / ~290px vertically (previously up to 2400px/s) and velocity decays to a near-stop when level; map, region chips, and sprites render with no console errors.
- `BUILD_ID` → `'v9'`, `index.html` → `sketch.js?v=9`, bumped together.

### Art & HUD Pass 5: Punchier Tilt, Big Banner, Bottom Camera, New Heart (v10)
- **Tilt un-frozen** (v9 had over-corrected to "not moving at all"; v10 lands between v8's manic 40px/frame and v9's dead 6):
  - `MOVE_GRAVITY` `0.5` → **`1.6`** and `MOVE_DAMPING` `0.985` → **`0.995`** — acceleration more than triples and the glide-to-stop lasts longer, so a held tilt ramps 0 → full speed in ~¼ second.
  - `MOVE_MAX_SPEED` `6` → **`11`** (~660 world px/s at full tilt; a 1200px region takes ~1.8s to cross — visibly alive, ~2.2× slower than v8's blur).
  - `TILT_RANGE` `30` → **`25`** and `TILT_CURVE` `2.0` → **`1.3`** — full force at a shallower hold angle and a near-linear curve, so casual ~12–15° tilts actually push instead of dying in the old quadratic's dead zone.
- **Camera window enlarged and moved to the bottom**: `CAM_WINDOW_WIDTH/HEIGHT` `120×90` → **`200×150`** (~2.8× the area, easier to hunt colors in). The preview sits at the bottom-right with a white frame; the crosshair over the sampled center spot and the scan button were recomputed off the new window position (the old code had the top-right position hardcoded). The **SCAN COLOR** button now sits directly *above* the preview (it was below, which would run off-screen at the new position) at bold 18px.
- **Find-color HUD redesigned as a top banner**: `drawChallengeHud()` split into `drawChallengeBanner()` + camera/button drawing. A ~400px-wide card at the very top holds a 52px color swatch, **FIND PURPLE** in bold up-to-30px type, and a bold `24s LEFT` countdown that turns red under 10s. New `fitTextSize()` helper shrinks the labels until they fit the card so narrow phones don't clip. While the banner is up, the small status labels (region/connection/haters/message/solo) shift below it via a `topY` offset in `drawHud()` instead of hiding behind it.
- The always-on `fps: / build:` readout is now drawn *after* the challenge HUD so the new bottom-right camera window can never cover it.
- **Heart art swapped**: `heartImg` now loads `references/nh.png` (1277×1231, effectively square so the square sprite slot doesn't distort it) instead of `character2.png`. Spawn still shows the heart for `HEART_TRANSFORM_MS = 2000`, then one of the three good looks.
- Verified locally with a faked capture element (real getUserMedia still denied in the test browser): nh.png loads as the heart; 20 frames of half-tilt ramps speed 0→11 with a 148px drift; the banner renders at the top (swatch pixel exact-match to the target RGB, card white, dark text confirmed by pixel counts), the 200×150 preview at bottom-right, scan button green above it; a forced scan against a solid-red feed still matches at distance ≈28 (< 75) and reports "Color found!". No console errors on load or during the challenge.
- `BUILD_ID` → `'v10'`, `index.html` → `sketch.js?v=10`, bumped together.

