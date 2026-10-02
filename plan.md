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
- Hardware sensors stay behind `window.sensorsEnabled`. On desktop the values read 0, so sprites settle and collide under gravity alone — real sliding requires the phone.
- Assets live in `references/` (copied out of the skills folder): `character1.png`, `character2.png`, `layout.design.jpg`. Procedural fallbacks cover either PNG failing to load.