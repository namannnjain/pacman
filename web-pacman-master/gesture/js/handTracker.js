// handTracker.js — wraps MediaPipe Hand Landmarker. Returns plain landmark data.

const VER = '0.10.14';
/** Default: load everything from public CDNs (needs internet). */
export const CDN_ASSETS = {
  bundleUrl: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/vision_bundle.mjs`,
  wasmUrl: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`,
  modelUrl: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
};
/** Offline: filled by `npm run setup:local`. Paths are relative to this file. */
export const LOCAL_ASSETS = {
  bundleUrl: new URL('../assets/vision_bundle.mjs', import.meta.url).href,
  wasmUrl: new URL('../assets/wasm', import.meta.url).href,
  modelUrl: new URL('../assets/models/hand_landmarker.task', import.meta.url).href,
};

const DEFAULTS = {
  ...CDN_ASSETS,
  numHands: 2,
  minHandDetectionConfidence: 0.6, // palm detector: find a new hand
  minHandPresenceConfidence: 0.6,  // is a hand still there?
  minTrackingConfidence: 0.5,      // keep following between frames
  delegate: 'GPU',                 // falls back to CPU automatically
};

export class HandTracker {
  constructor(options = {}) {
    this.cfg = { ...DEFAULTS, ...options };
    this.landmarker = null;
    this._lastTs = -1;          // MediaPipe requires strictly increasing timestamps
    this._lastVideoTime = -1;   // lets us skip frames the video hasn't updated
  }

  async init() {
    if (this.landmarker) return;
    const c = this.cfg;
    // Dynamic import so asset location is configurable at runtime.
    const mod = await import(/* @vite-ignore */ c.bundleUrl);
    const fileset = await mod.FilesetResolver.forVisionTasks(c.wasmUrl);
    const make = (delegate) => mod.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: c.modelUrl, delegate },
      runningMode: 'VIDEO',
      numHands: c.numHands,
      minHandDetectionConfidence: c.minHandDetectionConfidence,
      minHandPresenceConfidence: c.minHandPresenceConfidence,
      minTrackingConfidence: c.minTrackingConfidence,
    });
    try {
      this.landmarker = await make(c.delegate);
    } catch (e) {
      if (c.delegate !== 'CPU') {
        try { this.landmarker = await make('CPU'); }
        catch (e2) { throw this._modelError(e2); }
      } else throw this._modelError(e);
    }
  }

  _modelError(e) {
    const err = new Error('Could not load the MediaPipe hand model: ' + (e && e.message ? e.message : e));
    err.code = 'model-load-failed';
    err.cause = e;
    return err;
  }

  /**
   * Run detection on the current video frame.
   * @returns {null | Array<{landmarks, worldLandmarks, score, label}>}
   *   null  = no new video frame yet (nothing was processed)
   *   []    = processed, no hands visible
   * landmarks:      21 points, x/y normalized 0..1 of the image (+ relative z)
   * worldLandmarks: 21 points in metres, origin at the hand's centre (rotation-friendly, size-true)
   */
  detect(video, nowMs) {
    if (!this.landmarker) throw new Error('HandTracker not initialised');
    if (video.readyState < 2 || video.currentTime === this._lastVideoTime) return null;
    this._lastVideoTime = video.currentTime;

    let ts = Math.round(nowMs);
    if (ts <= this._lastTs) ts = this._lastTs + 1;
    this._lastTs = ts;

    const r = this.landmarker.detectForVideo(video, ts);
    const hands = [];
    for (let i = 0; i < (r.landmarks ? r.landmarks.length : 0); i++) {
      const h = r.handedness && r.handedness[i] && r.handedness[i][0];
      hands.push({
        landmarks: r.landmarks[i],
        worldLandmarks: (r.worldLandmarks && r.worldLandmarks[i]) || r.landmarks[i],
        score: h ? h.score : 1,
        label: h ? h.categoryName : '?',
      });
    }
    return hands;
  }

  /** Forget the video clock (call after the camera restarts). */
  resetVideoClock() { this._lastVideoTime = -1; }

  close() {
    if (this.landmarker) { this.landmarker.close(); this.landmarker = null; }
  }
}
