# Plan: 4-Player Infinite Map with Wandering Haters & Back-Camera Color Hunting

## Idea

I want the final work to be a shared screen multiple users on multiple phones have access to. I want every user to start with a region on a map you can populate with sprites and zoom out of. I also want there to be negative sprites or ‘haters’ which the users should ‘kill’/ remove by double tapping. The ‘haters’ will run away while users follow them on the map and try to remove them. That will be a shared goal to make the scene more entertaining. 

there will be a certain time slot the program gives that will pick a random color and ask user to scan that color in 30 seconds. if they succeed, they get an additional positive profile added of the same color.

- everyone starts with their own region
- Everyone sees all other regions but can only edit their own
- Haters can travel
- Group goal: chase and remove haters
- 4 users so there is initially 4 regions on 1 map and map is not making itself based on additional users.
- file name: hater.png
- yes they freely travel across all map once they are in frame they try to travel faster to run away. also nothing bounces within screen anymore - all travel out of frame. they also spread disease to positive characters and make them same dark color as haters
- yes wrap around and wander forever. zoom out is 2 finger zoom and drag. since they can only add + remove from their own island, their startign region should indicate 'your region'
- yes small live window cam but no target and yes user taps 'scan'

## References

| File / Asset | Location | Role / Description |
| :--- | :--- | :--- |
| `character1.png` | `references/character1.png` | Positive character sprite. |
| `character2.png` | `references/character2.png` | Heart sprite spawned on double tap (turns into character after 2 seconds). |
| `hater.png` | `references/hater.png` | Negative wandering sprite that infects positive characters and flees when in view. |
| `layout.design.jpg` | `references/layout.design.jpg` | Original concept sketch showing double-tap spawn and 2-second heart-to-character transformation. |

## Steps

### Step 1: PeerJS Multi-Client Room & Region Assignment
- **What to build:** Set up client-to-client networking using PeerJS loaded from CDN. On launch, connect the phone to a fixed shared 4-player room. Assign each incoming player one of the 4 quadrants (2x2 grid: Region 0 to Region 3). Display a persistent floating label at the top: "Your Region: [Region Index]".
- **Functions to use:**
  - `p5.js`: `createCanvas(windowWidth, windowHeight)`, `windowResized()`, `resizeCanvas()`, `text()`, `textAlign()`, `fill()`.
  - `p5-phone` & browser: `lockGestures()`, `showDesktopQr()`, `navigator.wakeLock.request('screen')`.
  - `PeerJS`: `window.Peer()`, `peer.connect()`, `peer.on('connection')`, `conn.on('data')`.
- **What you see on laptop:** Open four browser tabs; each tab connects to the room and claims regions 0 through 3 sequentially.
- **What you see on phone:** Opening the link assigns an available region, displays the region label, and stays connected without dropping.
- **Numbers to tune at top of `sketch.js`:**
  - `ROOM_ID = "atelier-shared-world-4p"`
  - `MAX_PLAYERS = 4`

### Step 2: 2D Camera System (2-Finger Pinch Zoom, Drag Pan & Infinite Torus Wrap)
- **What to build:** Build the virtual world camera system using matrix transformations. Center the camera on the user's assigned home region by default. Allow the user to drag to pan and use two fingers to pinch-to-zoom out to view all 4 regions. Implement toroidal coordinate wrapping so entities and coordinates wrap seamlessly when passing virtual world boundaries.
- **Functions to use:**
  - `p5.js`: `push()`, `pop()`, `translate()`, `scale()`, `touches`, `touchMoved()`, `mouseDragged()`.
- **What you see on laptop:** Mouse drag pans across all four quadrants; mouse scroll wheel zooms in and out.
- **What you see on phone:** Two-finger drag pans smoothly; two-finger pinch zooms out to reveal all four regions with smooth touch coordinates.
- **Numbers to tune at top of `sketch.js`:**
  - `WORLD_WIDTH = 2400`
  - `WORLD_HEIGHT = 2400`
  - `MIN_ZOOM = 0.35`
  - `MAX_ZOOM = 1.5`

### Step 3: Region-Gated Double Tap & 2-Second Heart Transition
- **What to build:** Implement double-tap detection that maps screen touch coordinates into virtual world coordinates. If the tap is inside the user's assigned region, spawn a heart (`character2.png`) that drifts with device tilt. After 2 seconds, transform it into `character1.png`. Prevent taps from modifying or spawning entities in other players' regions.
- **Functions to use:**
  - `p5.js`: `millis()`, `image()`, `imageMode(CENTER)`, `touchStarted()`, `rotationX`, `rotationY`.
  - `p5-phone`: `enableSensorTap()`.
- **What you see on laptop:** Double-clicking in the home region creates a heart; 2 seconds later it switches to the character image. Clicking outside the home region is rejected.
- **What you see on phone:** Double-tapping inside the player's region spawns a heart that drifts outward across the map.
- **Numbers to tune at top of `sketch.js`:**
  - `DOUBLE_TAP_TIME_MS = 300`
  - `HEART_TRANSFORM_MS = 2000`
  - `SPRITE_SIZE = 55`

### Step 4: Autonomous Hater Sprites (Fleeing & Infection System)
- **What to build:** Spawn autonomous "hater" entities (`hater.png`) that wander continuously across the entire map and wrap around boundaries. When a hater is inside the current screen viewport ("in frame"), increase its movement speed to flee from the player's view center. When a hater collides with any positive character, infect that character—turning its tint dark to match the haters.
- **Functions to use:**
  - `p5.js`: `dist()`, `image()`, `tint()`, `noTint()`, `createVector()`.
- **What you see on laptop:** Hater sprites drift between all quadrants; when they touch positive sprites, the positive sprites turn dark.
- **Phone view:** Moving the viewport over a hater causes it to speed up and flee toward neighboring regions.
- **Numbers to tune at top of `sketch.js`:**
  - `HATER_COUNT = 6`
  - `HATER_BASE_SPEED = 1.5`
  - `HATER_FLEE_SPEED = 4.0`
  - `INFECTION_RADIUS = 35`

### Step 5: Double-Tap Hater Removal (Shared Group Goal)
- **What to build:** Allow any player to remove ("kill") a hater or an infected sprite anywhere within their own region by double-tapping directly on it. Broadcast the removal event across PeerJS to update all connected phones instantly.
- **Functions to use:**
  - `p5.js`: `dist()`, `touchStarted()`.
  - `PeerJS`: `conn.send({ type: 'KILL', id: entityId })`.
- **What you see on laptop:** Double-clicking on a hater within the local region removes it from the array and notifies other open tabs.
- **What you see on phone:** Chasing a fleeing hater into your territory and double-tapping directly on it eliminates it from the screen for all players.
- **Numbers to tune at top of `sketch.js`:**
  - `KILL_HITBOX_RADIUS = 40`

### Step 6: Back-Camera Color-Scanning Window Challenge
- **What to build:** Implement a timed scanning challenge triggered periodically. The game displays a target color swatch and a 30-second countdown timer. Open a small live back-camera (`facingMode: "environment"`) feed window in the corner. Render a "Scan" button. When pressed, sample the average RGB color of the center pixels of the camera feed. If the Euclidean distance to the target color is within the tolerance threshold, add an extra positive character tinted to that color in the player's region.
- **Functions to use:**
  - `p5.js`: `createCapture()`, `image()`, `rect()`, `dist()`.
  - `p5-phone`: camera constraints helper `{ video: { facingMode: { ideal: "environment" } } }`.
- **What you see on laptop:** Uses default webcam; displays a target color box, video preview box, and countdown; clicking "Scan" matches against webcam feed color.
- **What you see on phone:** Back camera activates in a small floating corner box; pointing the lens at an object matching the target color and pressing "Scan" grants a new colored character.
- **Numbers to tune at top of `sketch.js`:**
  - `COLOR_CHALLENGE_DURATION_SEC = 30`
  - `COLOR_MATCH_THRESHOLD = 75`
  - `CAM_WINDOW_WIDTH = 120`
  - `CAM_WINDOW_HEIGHT = 90`

### Step 7: Multiplayer State Synchronization & Edge Testing
- **What to build:** Synchronize entity positions, states (healthy, heart, infected, removed), and color-challenge rewards across all connected peers at a lightweight interval (10-15 updates/sec) using PeerJS broadcast channels.
- **Functions to use:**
  - `p5.js`: `frameRate(60)`.
  - `PeerJS`: `conn.send()`, `peer.on('data')`.
- **What you see on laptop:** Actions taken in Tab 1 (moving sprites, transforming hearts, eliminating haters) mirror in Tabs 2, 3, and 4.
- **What you see on phone:** Multiple phones held side-by-side show characters seamlessly drifting across boundaries between screens without lag.
- **Numbers to tune at top of `sketch.js`:**
  - `NETWORK_SYNC_RATE_MS = 66`

## Assumptions

- Multi-client communication uses PeerJS directly via a free public signaling server loaded via `<script>` tag in `index.html`, eliminating the need for a custom Node.js server.
- The 4-player shared map is arranged in a 2x2 grid measuring 2400x2400 virtual pixels.
- Characters and haters wrap seamlessly around the world edges (toroidal geometry) rather than bouncing off walls.
- Double-tapping to remove haters is permitted only when the hater is currently positioned within the user's assigned region.
- Camera scanning runs at a small sub-resolution (120x90) to preserve mobile battery and prevent frame rate drops.

## Changes