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