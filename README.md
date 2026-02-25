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

## Verbose Logs

- Running `npm run dev` now creates a log file in `logs/`.
- File name format is `YYYY-MM-DD-HH-MM-SS.log`.
- Browser runtime events (tracking frames, calibration, pinch transitions, game state transitions, lifecycle events, console messages, and unhandled errors) are streamed into that file for troubleshooting.
- `logs/` is git-ignored.
- If TFJS/WebGL returns repeated invalid landmarks or no-hand streaks, the app can automatically reinitialize tracking and fall back to MediaPipe runtime / TFJS CPU (logged in detail).

## How It Works

1. The app requests webcam permission and starts TFJS with the WebGL backend.
2. Hand landmarks are inferred in a `requestAnimationFrame` loop using MediaPipe Hands.
3. Calibration collects 9 screen targets. Each pinch samples index fingertip data over 10 frames and averages it.
4. An affine transform is solved with least squares:
   - `x = a1*u + a2*v + a3`
   - `y = b1*u + b2*v + b3`
5. The transform maps mirrored camera coordinates to screen coordinates, then cursor smoothing is applied.
6. In game mode, pinch rising-edge events hit moles when the smoothed cursor is inside the active mole zone.

## Controls

- **Start Calibration**: begin 9-point calibration
- **Pinch** (thumb + index): confirm calibration target / hit mole
- **Start Game / Restart Game**: play 30-second round
- **Recalibrate**: clear stored transform and return to calibration
- **Debug overlay**: shows landmarks, raw pointer marker, and pinch/FPS info

## Calibration Persistence

Calibration is saved in `localStorage` and reused on reload. You can clear it with **Recalibrate**.

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
