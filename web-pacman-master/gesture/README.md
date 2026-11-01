# Secret Gesture Detector

Standalone, browser-only webcam gesture detector (MediaPipe Hand Landmarker + vanilla JS).
No Python, no backend, no Pac-Man logic. It recognises 4 custom gestures and calls your callback.

| ID | Gesture | Hands |
|---|---|---|
| `HEART` 🫶 | thumb tips touch (bottom), index tips touch (top) | 2 |
| `OK_HAND` 👌 | thumb tip touches index tip (ring), other 3 fingers straight | 1 |
| `THUMBS_UP` 👍 | thumb straight and pointing up, other 4 fingers folded | 1 |
| `MIDDLE_FINGER` 🖕 | middle out, index/ring/pinky folded | 1 |

## Run locally
```bash
cd gesture-detector
npm install            # installs @mediapipe/tasks-vision (only needed for offline mode)
npm start              # serves on http://localhost:5173
```
Open http://localhost:5173/ (debug console) or http://localhost:5173/test.html (API/10-second-window test).
Any static server works (`python3 -m http.server` too). The camera needs `http://localhost` or `https://`.

**Offline mode** (no internet at the stall): `npm install && npm run setup:local`, then open `/?local=1`.
This copies the WASM + bundle into `assets/` and downloads `hand_landmarker.task` into `assets/models/`.
In your own code pass `tracker: LOCAL_ASSETS` (exported from `js/handTracker.js`).

## Integration API
Copy the `js/` folder into the game and:
```js
import { SecretGestureDetector } from './gesture-detector/js/gestureController.js';

const detector = new SecretGestureDetector({
  onGestureDetected: (g) => {           // g = { id, confidence, heldMs, timestamp }
    switch (g.id) {
      case 'HEART': /* revive, 2 lives */ break;
      case 'OK_HAND': /* revive, 1 life + power mode */ break;
      case 'THUMBS_UP': /* leaderboard bonus */ break;
      case 'MIDDLE_FINGER': /* revive, 1 life + 10 ghosts */ break;
    }
  },
  onStatusChange: (s) => console.log(s),  // { state, detectionEnabled, message, error? }
});

await detector.start();        // load model + open camera ONCE (e.g. at game start). Detection is still OFF.
detector.enableDetection();    // call when the player loses all lives
detector.disableDetection();   // call when YOUR 10-second timer expires. No callbacks while disabled.
detector.stop();               // release camera (page exit). destroy() also frees the model.
detector.isRunning();          // camera + loop active?
```
Options: `targetFps` (24), `holdMs` (600), `cooldownMs` (2000), `video` (your own `<video>` for preview),
`camera` ({width,height,facingMode,deviceId}), `tracker` (asset URLs), `onFrame` (debug data every frame).
`start()` rejects with an `Error` whose `.code` is one of `permission-denied`, `no-camera`, `camera-busy`,
`unsupported`, `model-load-failed`. If the camera is unplugged mid-game, `onStatusChange` gets `state:'error'`,
`error.code === 'camera-disconnected'`; call `start()` again to recover.
`start()` should be called from a user gesture (click) the first time so the browser shows the permission prompt cleanly.

## How it works
`camera.js` (getUserMedia) -> `handTracker.js` (MediaPipe, returns landmarks) -> `gestureClassifier.js`
(per-frame guess) -> `gestureStability.js` (hold 600 ms, grace 200 ms, cooldown 2 s) -> `gestureController.js` (callbacks).
- Finger extension = joint angles (PIP/DIP) + fingertip-to-wrist reach ratio, using 3D world landmarks, so wrist rotation and camera distance don't matter.
- Two-hand tests use image positions divided by on-screen hand size (scale-free). HEART checks thumb-tip contact, index-tip contact, thumb->index axis pointing up, hands side by side, open lobes. OK_HAND checks that thumb-tip and index-tip are touching (3D distance / hand size), index is bent, and middle/ring/pinky are straight.
- Each gesture's confidence = weakest of its tests. Below 0.55, or two gestures within 0.12 of each other -> `null`.
- Left/right labels are never used and the preview mirroring is CSS-only, so mirrored/unmirrored and either hand are fine.

## Known limitations (honest list)
- **OK_HAND**: needs the palm roughly toward the camera so the ring is visible; if the ring is seen edge-on the thumb/index contact can be missed. Don't confuse with a loose pinch: the other three fingers must be clearly straight.
- **HEART**: the 🫶 pose seen from the front; thumbs must be visible (not hidden behind the fingers). Rotating the heart more than ~60 degrees is rejected on purpose.
- Thresholds were designed from landmark geometry, not tuned on a dataset. Verify with the checklist and adjust the ramp numbers in `gestureClassifier.js` if your lighting/camera differ. The card bars in the debug UI show the live score for each gesture, which makes tuning easy.
- Good light, plain-ish background, hands 40-100 cm from the camera, whole hand in frame.

## Test checklist
- [ ] Start Camera -> status dot green, skeleton follows hands, hands count correct (0/1/2).
- [ ] 👍 held 1 s -> `THUMBS_UP` fires once; thumb sideways/down or open hand -> does not fire.
- [ ] 🖕 held 1 s -> `MIDDLE_FINGER` fires once; index+middle (peace) -> does not fire.
- [ ] 🫶 held 1 s -> `HEART` fires once; two hands just side by side -> does not fire.
- [ ] 👌 held 1 s -> `OK_HAND` fires once; open hand or fist -> does not fire.
- [ ] Open hand / fist -> nothing fires. Quick flash of a gesture (<0.5 s) -> nothing fires.
- [ ] After a trigger, nothing fires for ~2 s (cooldown); holding the gesture longer does not repeat it immediately.
- [ ] test.html: events only appear while the window is open; none after "window expired".
- [ ] Stop Camera turns the camera light off. Deny permission -> readable error. Unplug camera -> error state.
- [ ] Left-hand and right-hand versions of 👍 / 🖕 both work; tested at ~50 cm and ~100 cm.

## Troubleshooting
| Problem | Fix |
|---|---|
| Blank page / module errors | Don't open via `file://`; use `npm start`. |
| "Could not load the hand model" | CDN blocked / offline: use offline mode. Check the console Network tab. |
| Permission denied | Click the camera icon in the address bar -> Allow, then Start again. |
| "Camera in use" | Close other tabs/apps using the webcam. |
| Slow / laggy | Lower `targetFps`, close heavy tabs; GPU delegate falls back to CPU automatically. |
| Gesture won't trigger | Watch its card bar in the debug UI: if it never exceeds ~55%, improve light / show whole hand / adjust thresholds. |
| Fires too easily | Raise `holdMs` or `minConfidence` in `CLASSIFIER_CONFIG`. |
