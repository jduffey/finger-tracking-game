# Motion Arcade

Motion Arcade is a camera-powered collection of motion games and creative experiments
built with React, Vite, and TensorFlow.js. The repository is still named
`finger-tracking-game`, but the user-facing experience is organized around playing,
creating, and exploring rather than around a tracking demo.

## What Is In This Repo

### Main app (`/`)

- **Home**: browse featured activities, search the library, switch between Play,
  Create, and Labs, and revisit favorites or recent modes without granting camera
  access first.
- **Camera & Tracking Setup**: a privacy-first permission step with live readiness,
  device selection, recovery guidance, and a pointer-only alternative where supported.
- **Play**: arcade games including Sky Patrol, Slice Air, Missile Command, Brick
  Dodger, Breakout, Finger Pong, Gesture Memory, and more.
- **Create**: camera visualizers, gesture art, the Circle of Fifths instrument, and
  other expressive tools.
- **Labs**: pose tracking, off-axis perspective, gesture analytics, spatial
  interfaces, and experimental interaction studies. Preview and experimental
  activities are labeled in the library.
- **Settings**: handedness, dwell and pinch tuning, camera preview, visual comfort,
  audio, favorites, recent activity, and local-data controls.

Fullscreen activities support a hand-driven dwell control and an ordinary pointer
fallback. Showing a usable index fingertip is enough to drive the launcher; recognizing
every fingertip is not required.

### Secondary page (`/circle-of-fifths.html`)

- A dedicated fullscreen Circle of Fifths instrument.
- One-hand index-finger tracking steers chord selection.
- Pinch interactions choose drum presets and adjust BPM.
- Uses webcam input and browser audio output.

## Requirements

- Node.js 20.19 or newer (or Node.js 22.12+)
- npm
- Webcam access
- A modern desktop Chromium browser is recommended
- No third-party model CDN is required; pinned MediaPipe Hands assets are served
  from the same origin as the app

Camera access requires a
[secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts).
`localhost` works for local development; remote deployments should use HTTPS.

## Install And Run

For normal local use, you do not need Symphony or any backend service.

If you want a clean lockfile install, use:

```bash
npm ci
npm run dev
```

If you prefer, `npm install` works too.

Then:

1. Open the local URL printed by Vite. It is usually `http://localhost:5173`, but Vite will pick another port if that one is busy.
2. Browse Home and choose an activity.
3. If the activity uses tracking, choose **Set up camera** and approve the browser
   permission prompt. The app does not request camera access just to browse.
4. Follow the framing and model-readiness steps, then start the activity.

Advanced calibration remains available for modes that benefit from a tighter
screen-to-fingertip mapping. The Circle of Fifths instrument can also be opened directly
at `/circle-of-fifths.html`.

To preview the production build locally:

```bash
npm run build
npm run preview
```

## Scripts

- `npm run dev`: starts the Vite development server
- `npm run build`: builds both `index.html` and `circle-of-fifths.html` into `dist/`
- `npm run preview`: serves the built output locally
- `npm test`: runs the Node test suite
- `npm run test:ci`: runs the same suite with the explicit CI reporter
- `npm run test:e2e`: runs camera-free Chromium journeys and accessibility smoke checks
- `npm run audit`: checks installed dependencies for high-severity advisories
- `npm run check:bundle-budget`: checks the built main page's eager JS and CSS against the startup budgets
- `npm run check`: runs unit and browser tests, creates a production build, checks the startup bundle budget, and audits dependencies
- `npm run symphony`: launches the optional Symphony workflow wrapper

Pull requests and pushes to `main` run `npm run check` on Node.js 22 through the
repository's GitHub Actions quality workflow.

### Production bundle budgets

The startup budget is based on the assets referenced directly by `dist/index.html`:
module scripts, module preloads, and stylesheets. Lazy activity and camera-tracking
chunks are intentionally excluded because they are not downloaded during the first
visit to Home.

| Asset | Raw budget | Gzip budget |
| --- | ---: | ---: |
| Initial JavaScript | 800 KiB | 250 KiB |
| Initial CSS | 210 KiB | 42 KiB |

These limits leave modest headroom above the current production baseline while still
catching accidental eager imports or unbounded shared styles. Run `npm run build`
followed by `npm run check:bundle-budget` after changing entry-point imports, shared
dependencies, or global CSS. An intentional budget increase should include a measured
explanation in the pull request rather than changing the thresholds as a routine fix.

## Camera, Privacy, And Local Data

- Camera access starts only after a user chooses to set up or launch tracking and
  approves the browser permission prompt.
- Camera frames are processed locally in the browser. The application does not upload
  or save video frames and does not request microphone access.
- Hand tracking starts with the MediaPipe Hands runtime and can probe or fall back to
  TFJS backends when needed.
- Pinned MediaPipe Hands model assets are served by the app from the same origin.
- Body Pose Lab and Off-Axis Forest Walk use pose detection rather than the hand-tracking flow.
- Calibration, preferences, favorites, recent activity, gesture personalization, and
  selected game or lab progress can be stored in the browser's `localStorage`.
- Local data can be cleared from Settings or through the browser's site-data controls.
- Verbose browser/runtime events are disabled by default. Developers can opt in with
  `VITE_VERBOSE_LOGS=true` or `?debugLogs=1`; production builds do not send those logs.
- The codebase contains no account system, advertising SDK, or third-party analytics.

The user-facing policy is available at [`/privacy.html`](./public/privacy.html).

## Optional Symphony Setup

This repository includes Symphony-specific files, but they are not required to run the app itself.

To use `npm run symphony`:

1. Have a built local Symphony checkout at `${SYMPHONY_REPO:-$HOME/repos/symphony}` so `elixir/bin/symphony` exists.
2. Make Codex available through `CODEX_BIN`, `codex` on `PATH`, or `/Applications/Codex.app/Contents/Resources/codex`.
3. Set `TRACKER_API_KEY` if you do not want the launcher default of `dev-key`.
4. Optionally override `TARGET_REPO_URL`, `SYMPHONY_DASHBOARD_PORT` (default `4101`), `SYMPHONY_LOCAL_REPO_PATH`, or `SYMPHONY_MERGE_BASE`.
5. Run `npm run symphony`.

## Troubleshooting

- **No camera prompt appears**: check browser and OS camera permissions, and make sure another app is not exclusively holding the webcam.
- **The page loads but hand tracking does not start**: retry in Chrome or another Chromium browser with WebGL enabled and confirm the host serves the bundled `/vendor/mediapipe/hands/` assets.
- **The cursor feels off**: rerun calibration and keep your hand fully visible while capturing.
- **Tracking is noisy or slow**: improve lighting, reduce background clutter, and close other GPU-heavy browser tabs.
- **The Circle of Fifths page is silent**: confirm the browser allows audio playback and interact with the page so the `AudioContext` can start.
