// gestureController.js — the public API. Combines camera + tracker + classifier + stability.
// Contains NO game logic: it only recognises gestures and calls your callbacks.

import { Camera } from './camera.js';
import { HandTracker } from './handTracker.js';
import { classifyGestures, pickBest, GESTURE_IDS } from './gestureClassifier.js';
import { GestureStabilizer } from './gestureStability.js';

export { GESTURE_IDS };

export class SecretGestureDetector {
  /**
   * @param {object} options
   * @param {(g:{id:string,confidence:number,heldMs:number,timestamp:number})=>void} options.onGestureDetected
   * @param {(s:{state:string,detectionEnabled:boolean,message:string,error?:Error})=>void} [options.onStatusChange]
   *        state: 'idle'|'loading-model'|'starting-camera'|'running'|'stopped'|'error'
   * @param {(info:object)=>void} [options.onFrame]  debug hook, called after every processed frame
   * @param {HTMLVideoElement} [options.video]  pass your own <video> to show a preview
   * @param {number} [options.targetFps=24]  detection updates per second (15-30 is a good range)
   * @param {number} [options.holdMs=600]    how long a gesture must be held
   * @param {number} [options.cooldownMs=2000]
   * @param {boolean} [options.processWhenDisabled=false]  keep running inference (for debug UIs) while disabled;
   *        callbacks are STILL suppressed. Leave false in the real game to save CPU.
   * @param {object} [options.camera]   {width,height,facingMode,deviceId}
   * @param {object} [options.tracker]  {bundleUrl,wasmUrl,modelUrl,...} (e.g. LOCAL_ASSETS from handTracker.js)
   */
  constructor(options = {}) {
    this.opts = { targetFps: 24, holdMs: 600, cooldownMs: 2000, graceMs: 200, processWhenDisabled: false, ...options };
    this.video = this.opts.video || document.createElement('video');
    this.camera = new Camera({ video: this.video, ...(this.opts.camera || {}), onEnded: () => this._onCameraEnded() });
    this.tracker = new HandTracker(this.opts.tracker || {});
    this.stabilizer = new GestureStabilizer({ holdMs: this.opts.holdMs, cooldownMs: this.opts.cooldownMs, graceMs: this.opts.graceMs });

    this._running = false;
    this._starting = null;
    this._cancelStart = false;
    this._detectionEnabled = false;
    this._raf = 0;
    this._lastTick = 0;
    this._errors = 0;
    this._fps = 0;
    this._lastFrameAt = 0;
    this._smooth = null;   // exponentially smoothed per-gesture scores
    this._loop = this._loop.bind(this);
  }

  // ---------------- public API ----------------

  /** Load the model (first time only), open the camera, start the loop. Detection stays DISABLED until enableDetection(). */
  async start() {
    if (this._running) return;
    if (!this._starting) this._starting = this._doStart().finally(() => { this._starting = null; });
    return this._starting;
  }

  /** Stop the loop and release the camera. The model stays loaded so the next start() is fast. */
  stop() {
    if (this._starting) this._cancelStart = true;
    this._halt();
    this._detectionEnabled = false;
    this._setStatus('stopped', 'Stopped');
  }

  /** Begin emitting gestures. Also clears any old hold/cooldown state. */
  enableDetection() {
    this.stabilizer.reset();
    this._detectionEnabled = true;
    this._smooth = null;
    this._setStatus(this._running ? 'running' : 'idle', 'Detection enabled');
  }

  /** Stop emitting gestures (camera keeps running so re-enabling is instant). */
  disableDetection() {
    this._detectionEnabled = false;
    this.stabilizer.reset();
    this._setStatus(this._running ? 'running' : 'idle', 'Detection disabled');
  }

  isRunning() { return this._running; }
  isDetectionEnabled() { return this._detectionEnabled; }

  /** Forget any gesture currently being held and clear the cooldown. */
  reset() { this.stabilizer.reset(); }

  /** stop() + free the model. Call when the page/game is done with gestures for good. */
  destroy() { this.stop(); this.tracker.close(); }

  // ---------------- internals ----------------

  async _doStart() {
    this._cancelStart = false;
    try {
      this._setStatus('loading-model', 'Loading hand model…');
      await this.tracker.init();
      this._setStatus('starting-camera', 'Waiting for camera permission…');
      await this.camera.start();
    } catch (err) {
      this.camera.stop();
      this._setStatus('error', err.message, err);
      throw err;
    }
    if (this._cancelStart) { this.camera.stop(); return; }
    this.tracker.resetVideoClock();
    this.stabilizer.reset();
    this._running = true;
    this._errors = 0;
    this._lastTick = 0;
    this._raf = requestAnimationFrame(this._loop);
    this._setStatus('running', 'Camera running');
  }

  _halt() {
    this._running = false;
    this._smooth = null;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this.camera.stop();
    this.stabilizer.reset();
  }

  _onCameraEnded() {
    if (!this._running) return;
    this._halt();
    this._detectionEnabled = false;
    const err = new Error('Camera disconnected.');
    err.code = 'camera-disconnected';
    this._setStatus('error', err.message, err);
  }

  _loop(ts) {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._loop);
    // Throttle to ~targetFps (rAF runs at the screen rate, usually 60 Hz). The -4 ms absorbs frame jitter.
    if (ts - this._lastTick < 1000 / this.opts.targetFps - 4) return;
    this._lastTick = ts;
    this._processFrame();
  }

  _processFrame() {
    if (!this._detectionEnabled && !this.opts.processWhenDisabled) return;
    const now = performance.now();
    let hands;
    try {
      hands = this.tracker.detect(this.video, now);
      this._errors = 0;
    } catch (e) {
      // Occasional errors are tolerated; many in a row mean something is really broken.
      if (++this._errors >= 5) {
        this._halt();
        this._detectionEnabled = false;
        this._setStatus('error', 'Hand tracking failed repeatedly: ' + e.message, e);
      }
      return;
    }
    if (hands === null) return; // video hasn't produced a new frame yet

    if (this._lastFrameAt) {
      const inst = 1000 / Math.max(1, now - this._lastFrameAt);
      this._fps = this._fps ? this._fps * 0.8 + inst * 0.2 : inst;
    }
    this._lastFrameAt = now;

    const aspect = (this.video.videoWidth / this.video.videoHeight) || 4 / 3;
    const cls = classifyGestures(hands, { aspect });
    const raw = cls.scores;
    // Smooth scores over time (EMA): removes single-frame spikes/dips from landmark jitter.
    // When no hand is visible the scores decay quickly so stale gestures don't linger.
    const k = hands.length ? 0.5 : 0.8;
    if (!this._smooth) this._smooth = { ...raw };
    for (const id of GESTURE_IDS) this._smooth[id] += k * (raw[id] - this._smooth[id]);
    const scores = { ...this._smooth };
    const best = pickBest(scores);

    let stability = null;
    if (this._detectionEnabled) {
      stability = this.stabilizer.update(best, now);
      if (stability.activated) {
        this._safe(this.opts.onGestureDetected, {
          id: stability.id, confidence: stability.confidence, heldMs: stability.heldMs, timestamp: Date.now(),
        });
      }
    }
    this._safe(this.opts.onFrame, {
      hands, scores, details: cls.details, candidate: best, stability, fps: this._fps,
      detectionEnabled: this._detectionEnabled, videoWidth: this.video.videoWidth, videoHeight: this.video.videoHeight,
    });
  }

  _setStatus(state, message, error) {
    this._safe(this.opts.onStatusChange, { state, detectionEnabled: this._detectionEnabled, message, error });
  }

  /** A bug in the game's callback must never kill our loop. */
  _safe(fn, arg) {
    if (typeof fn !== 'function') return;
    try { fn(arg); } catch (e) { console.error('[SecretGestureDetector] callback threw:', e); }
  }
}
