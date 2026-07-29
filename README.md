# Motion Arcade

Motion Arcade is a privacy-minded collection of motion games, creative tools, and
interaction labs built with React, Vite, TensorFlow.js, MediaPipe Hands, and
MoveNet. The repository is still named `finger-tracking-game`; the product is
organized around **Play**, **Create**, and **Labs**.

The app has no backend requirement. Home, pointer-compatible activities, saved
progress, and local creative tools work without signing in or granting camera
access.

## Product Tour

### Action-first Home

Home keeps the camera off and puts useful actions first:

- **Arcade Run**, **Quick play**, a daily challenge, and a recommended first
  session for new visitors.
- **Continue**, recent results, local totals, favorites, recommendations, and
  achievement progress for returning visitors.
- A searchable library with Play/Create/Labs, duration, movement, and player
  filters. Preview and experimental work is labeled rather than presented as a
  finished game.
- Direct access to **My Creations**, camera readiness, and Settings.

Each activity has a stable route, so links such as `/play/sky-patrol`,
`/create/light-painting`, and `/labs/probability-table` can be opened directly
and participate in browser Back navigation.

### Play

The supported game library includes:

- **Arcade Run**, **Ready, Set, Whack!**, **Sky Patrol**, **Slice Air**,
  **Missile Command**, and **Brick Dodger**.
- **Gesture Memory**, **Hand Bounce**, **Breakout**, **Two-Hand Breakout**,
  **Finger Pong**, **Tic Tac Toe**, **Invaders**, and **Flappy**.

Games provide goals, pause/recovery behavior, and end-of-round results where
applicable. Results feed an on-device progression record with recent sessions,
personal bests, play totals, achievements, and medals.

Arcade Run builds deterministic three-, five-, or ten-minute playlists from
compatible games. It supports daily routes, per-game recaps, retry/skip,
aggregate scoring, circuit medals, and local resume for an unfinished run.

### Create

- **Motion Visualizer** remixes seven live effects with palettes, intensity,
  trails, camera opacity, favorite effects, and saved looks. It can export an
  SVG composition without including the camera image.
- **Light Painting** supports pointer or tracked painting, tool controls,
  freeze/replay, image export, privacy-safe ten-second WebM capture, and local
  gallery saves. Video export records the artwork canvas, never the camera
  image.
- **World Painter** creates rule-grown landscapes from reproducible seeds and
  Blank, River, Highland, or Island starters, with named projects, revisions,
  local saves, and restorable JSON export.
- **Jam Studio** (`/create/jam-studio`, served by
  `/circle-of-fifths.html`) combines a Circle of Fifths instrument with drum
  grooves. It accepts hand tracking, pointer, touch, and keyboard input and can
  lock to a key, play progression presets, switch timbres, arpeggiate chords,
  mix or mute individual drums, and record a repeating loop of chord changes
  and live drum hits. A loop is capped at 32 seconds and 256 symbolic events;
  it can be kept in one local save slot or exported as JSON. No audio or camera
  frames are recorded.

**My Creations** is the local shelf for Light Paintings and World Painter
projects. It can search, filter, reopen, rename, export, and delete saved work.
Gallery metadata and world documents use browser storage; saved image blobs use
IndexedDB. There is no cloud library or cross-device sync.

### Labs

Labs deliberately expose less-settled interaction work:

- **Track Runner**, **Conveyor Toss**, and **Pinch Sandbox** are camera-driven
  control and physics previews.
- **Star Flight** offers three finite gate courses with precision scoring,
  streaks, misses, time-and-accuracy medals, pinch boost, and an endless Free
  Flight option.
- **Probability Table** is a camera-free probability experiment that compares
  predictions with finite trial results.
- **Pose Quest** (`/labs/pose-quest`) turns whole-body visibility diagnostics
  into three short, skippable silhouette challenges—a wide reach, victory
  statue, and hands-on-hips stance—with raw keypoint details kept under an
  advanced disclosure.
- **Parallax Forest: Guardian Trail** (`/labs/forest-discovery`) is a
  three-clue depth survey. It can use on-device head pose or an explicit
  pointer-and-arrow-key mode, and clearly identifies the scene as a simulated
  window-depth effect.
- **Spatial Desk** and **Spatial Investigation** explore multi-hand spatial
  interfaces and gesture training.
- **Gesture Analytics** (`/labs/gesture-analytics`) is an internal diagnostic
  route rather than a normal library card. It can capture bounded sessions,
  replay and compare them, and import/export a versioned archive. Camera images
  are never stored, but session archives contain sampled hand coordinates and
  should be reviewed before sharing.

## Controls And Camera Setup

All supported and flagship Play entries currently provide a pointer fallback.
Fullscreen activities can be steered with a mouse or touch; arrow keys move the
fallback pointer and Space/Enter activates it. Gesture Memory and Jam Studio
also expose activity-specific keyboard controls. Camera-specific preview and
experimental Labs still require tracking unless their screen offers a manual
mode.

Choose **Explore without camera** when it is offered to use fallback controls.
Choose **Set up camera** for tracked controls. Setup then:

1. Requests permission only after that choice.
2. Loads the tracking model, shows framing and lighting guidance, and lets the
   user choose a camera.
3. Requires a real steady-pointer-and-pinch readiness check before reporting
   success.

Advanced calibration remains available for experiences that benefit from a
tighter screen-to-fingertip map. During play, a brief tracking interruption is
tolerated; sustained loss freezes simulation, waits for three stable
reacquisition seconds, and resumes through a safety countdown. Camera/model and
unexpected runtime failures lead to scoped retry, restart, or Home recovery
rather than exposing raw error details.

Settings applies across experiences and includes dominant hand, seated range,
mirroring, dwell timing, cursor smoothing and size, pinch sensitivity, UI
scale, reduced motion, high contrast, low-sensory effects, adaptive performance,
camera-preview size, mute, and separate music/effects volumes. It also exposes
camera stop, reset, privacy, and local-data deletion controls.

## Privacy And Local Data

- Camera access is opt-in. Frames are processed in the browser and are not
  uploaded or saved by the application. Motion Arcade does not request
  microphone access.
- Pinned MediaPipe Hands and MoveNet model assets are served from the same
  origin as the app. Runtime tracking does not depend on a third-party model
  CDN.
- There is no account system, advertising SDK, or third-party analytics.
- The app keeps bounded, aggregate-only experience-health counters on the
  device for scored games: starts/completions, retry and abandonment counts,
  time-to-first-success buckets, selection failures, tutorial outcomes, and
  tracking-loss durations. It stores no raw event stream, timestamps, session
  identifiers, camera data, or landmarks, and Settings deletes these counters
  with the rest of local product data.
- Preferences, calibration, favorites, recent activity, progression, unfinished
  Arcade Runs, gesture personalization, saved visualizer looks, Jam Studio
  loops, and selected lab sessions may be stored in `localStorage`. Creative
  image assets may be stored in IndexedDB.
- Browser storage is local to the current site and browser profile. Use Settings
  or the browser's site-data controls to clear it. Export files leave the app
  only because the user explicitly downloads them.
- Verbose local development logs are disabled by default. Opt in with
  `VITE_VERBOSE_LOGS=true` or `?debugLogs=1`; production builds do not send
  those logs.

See the plain-language policy at [`public/privacy.html`](./public/privacy.html).

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- A modern browser; current desktop Chromium is the best-tested target
- A webcam only for camera-controlled activities
- HTTPS for remote camera access (`localhost` is a secure-context exception)

The responsive release matrix covers common desktop, phone, and tablet
viewports. Camera performance still depends on lighting, framing, GPU support,
and the selected tracking profile.

## Install And Run

```bash
npm ci
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`. Browse Home
without a camera prompt, then choose an activity or run setup when tracked input
is wanted. `npm install` is also supported for ordinary dependency updates.

To inspect the production output locally:

```bash
npm run build
npm run preview
```

## Validation

- `npm test` — Node unit and source-contract tests.
- `npm run test:ci` — the same suite with the CI reporter.
- `npm run test:e2e` — Chromium journeys, deterministic synthetic-camera
  permission/model recovery checks, deep-link checks, accessibility gates, and
  responsive-layout checks.
- `npm run build` — builds `index.html` and `circle-of-fifths.html` into
  `dist/`.
- `npm run check:bundle-budget` — checks eager main-page assets after a build.
- `npm run audit` — fails on high-severity dependency advisories.
- `npm run check` — unit tests, production build, bundle budget, dependency
  audit, and browser tests.
- `npm run symphony` — optional local Symphony workflow wrapper; it is not
  needed to run Motion Arcade.

Install the Chromium test runtime once if Playwright asks for it:

```bash
npx playwright install chromium
```

The eager asset budgets enforced against `dist/index.html` are 800 KiB raw /
250 KiB gzip for JavaScript and 210 KiB raw / 42 KiB gzip for CSS. Lazy camera
and activity chunks are intentionally excluded from the first-visit budget.

## Static Deployment And Deep Links

Deploy the contents of `dist/` over HTTPS. Files copied from `public/` include:

- `_redirects`, which preserves the standalone Circle of Fifths page and
  rewrites other application routes to `/index.html`.
- `_headers`, which supplies the security policy, limits camera permission to
  the same origin, disables microphone access, and configures immutable
  same-origin model assets.

Hosts that do not understand those files need equivalent configuration:

1. Serve `/circle-of-fifths.html` as a real file and optionally redirect
   `/circle-of-fifths` to it.
2. Serve existing assets normally.
3. Rewrite other non-file routes, including `/play/*`, `/create/*`, `/labs/*`,
   `/setup`, and `/settings`, to `/index.html` with a success response.
4. Preserve the `_headers` security behavior where the platform allows it, and
   serve `.wasm` tracking assets with the correct content type.

Without the SPA rewrite, direct activity links may work in the Vite dev server
but return a host-level 404 after deployment.

## Troubleshooting

- **No camera prompt:** start setup or a tracked activity first, then check
  browser and OS permissions and close other apps holding the camera.
- **Hand tracking does not initialize:** use Chromium with WebGL enabled and
  confirm `/vendor/mediapipe/hands/` is deployed.
- **Pose tracking does not initialize:** confirm `/vendor/movenet/` and its
  relative shard paths are served unchanged.
- **Controls feel offset or noisy:** rerun setup/calibration, keep the complete
  hand in frame, improve lighting, and close GPU-heavy tabs.
- **Jam Studio is silent:** interact with the page so the browser can start its
  `AudioContext`, and confirm site audio is allowed.
