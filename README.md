# Finger Whack

Minimal webcam-based Whack-a-Mole game using React + Vite and TensorFlow.js hand pose tracking (MediaPipe Hands model).

## Requirements

- Node.js 18+
- Chrome (recommended)
- Webcam access

## Quick Start

If you are creating this from scratch, use:

```bash
npm create vite@latest finger-whack -- --template react
cd finger-whack
npm install
npm i @tensorflow-models/hand-pose-detection @tensorflow/tfjs-core @tensorflow/tfjs-backend-webgl @tensorflow/tfjs-backend-cpu
npm run dev
```

For this repository directly:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`) in Chrome.

## Symphony Setup

This repo is configured for Symphony with:

- [`WORKFLOW.md`](./WORKFLOW.md) for the tracker/workspace runtime
- [`AGENTS.md`](./AGENTS.md) for repo-specific execution guidance
- repo-local skills under [`.codex/skills`](./.codex/skills)

To use it with the local Symphony tracker setup:

1. Ensure the tracker project slug is `finger-tracking-game`.
2. Set `TRACKER_API_KEY` for the tracker service.
3. Optionally set `TARGET_REPO_URL`; otherwise the workflow defaults to `git@github.com:jduffey/finger-tracking-game.git`.
4. Run `npm run symphony` from this repository to launch Symphony against `WORKFLOW.md`.

The local launcher defaults `TRACKER_API_KEY` to `dev-key` and uses dashboard
port `4101` so it can run alongside the `codex-casino` setup on `4100`. It
also auto-resolves Codex from `CODEX_BIN`, then `codex` on `PATH`, then
`/Applications/Codex.app/Contents/Resources/codex`.

## Verbose Logs

- Running `npm run dev` now creates a log file in `logs/`.
- File name format is `YYYY-MM-DD-HH-MM-SS.log`.
- Browser runtime events (tracking frames, calibration, pinch transitions, game state transitions, lifecycle events, console messages, and unhandled errors) are streamed into that file for troubleshooting.
- `logs/` is git-ignored.
- Tracking now starts with MediaPipe runtime first (for more stable hand coordinates on this machine), then can probe TFJS as a fallback path if needed.
- If repeated invalid landmarks or long no-hand streaks occur, the app auto-recovers runtime/backend and logs each attempt in detail.
- Hand-detected status uses a short grace window to avoid flickering off on single dropped frames.
- Use **Log Tracking Extents** in the UI to log raw vs clamped fingertip extents, visible-area-normalized extents, out-of-visible-bounds ratios, and camera cover/crop bounds for edge-alignment diagnostics.

## How It Works

1. The app requests webcam permission and starts with MediaPipe runtime (then can fallback/probe TFJS backends if needed).
2. Hand landmarks are inferred in a `requestAnimationFrame` loop using MediaPipe Hands.
3. Calibration collects 9 screen targets. Each pinch samples index fingertip data over 10 frames and averages it.
4. An affine transform is solved with least squares:
   - `x = a1*u + a2*v + a3`
   - `y = b1*u + b2*v + b3`
5. The tracker maps fingertip coordinates into the visible camera window (derived from object-fit cover crop), then applies calibration and cursor smoothing.
6. In game mode, pinch rising-edge events hit moles when the smoothed cursor is inside the active mole zone.
7. In fullscreen camera mode, you can switch to webcam-backed overlay games where the index fingertip controls left-right movement on top of the full feed, including Breakout/Arkanoid, a support-hand Breakout co-op variant, and a Space Invaders-style shooter.

## Controls

- **Start Calibration**: begin 9-point calibration
- **Pinch** (thumb + index): confirm calibration target / hit mole
- **Start Game / Restart Game**: play 30-second round
- **Recalibrate**: clear stored transform and return to calibration
- **Camera overlay**: always shows fingertip markers (thumb/index/middle/ring/pinky)
- **Fullscreen Camera > Breakout Co-op**: overlays a richer brick-breaker on the full webcam feed where the index fingertip steers the paddle, a second-hand pinch triggers a temporary shield pulse, prism bricks split extra balls, the HUD tracks score/lives/shield charge, and a pinch after a clear or wipeout restarts the round
- **Fullscreen Camera > Breakout**: overlays a webcam-backed Breakout/Arkanoid mode with a 3-second launch countdown, slower ball speed, score HUD, rainbow capsule drops, and multi-ball powerups
- **Fullscreen Camera > Invaders**: overlays a Space Invaders-style shooter where the index fingertip steers the ship, pinch fires on cooldown, enemy rows sweep downward, and pinch restarts after a loss or clear
- **Fullscreen Camera > Flappy**: overlays a Flappy Bird-inspired mode on the full webcam feed where each distinct pinch produces one flap, pipes scroll right-to-left, score increments on gap clears, and a pinch after a crash restarts the round
- **Debug overlay**: adds landmarks, raw pointer marker, and pinch/FPS info
- **Log Tracking Extents**: writes raw/clamped/visible-normalized fingertip coverage plus visible camera bounds to the log file

## Calibration Persistence

Calibration is saved in `localStorage` and reused on reload. You can clear it with **Recalibrate**.
Newer builds use a newer calibration storage key; after updating, do one fresh calibration pass.

## Troubleshooting

- Camera prompt does not appear:
  - Check Chrome site settings and allow camera access.
  - Ensure no other app is exclusively locking the webcam.
- Cursor movement feels off:
  - Run calibration again.
  - Keep hand in frame and hold steady while pinching targets.
- Poor tracking performance:
  - Improve lighting.
  - Keep one hand visible and reduce background clutter.
  - Close other heavy browser tabs/processes.
- MediaPipe runtime fallback fails to initialize:
  - Confirm internet access (the fallback uses `https://cdn.jsdelivr.net/npm/@mediapipe/hands`).
