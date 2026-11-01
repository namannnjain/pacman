// gestureStability.js — turns noisy per-frame guesses into rare, deliberate events.
//
// Rules:
//  1. A gesture must be seen continuously for `holdMs` (default 600 ms).
//  2. Short dropouts (<= graceMs) don't reset the timer -> no flicker-resets.
//  3. At least `minFrames` frames and a decent average confidence are required,
//     so a single frame can never trigger anything.
//  4. After firing, ALL gestures are blocked for `cooldownMs` (no duplicates,
//     no two gestures back-to-back).

export class GestureStabilizer {
  constructor({ holdMs = 600, graceMs = 200, cooldownMs = 2000, minFrames = 5, minAvgConfidence = 0.6 } = {}) {
    this.holdMs = holdMs;
    this.graceMs = graceMs;
    this.cooldownMs = cooldownMs;
    this.minFrames = minFrames;
    this.minAvgConfidence = minAvgConfidence;
    this.reset();
  }

  /** Clear everything, including the cooldown. */
  reset() {
    this.cooldownUntil = 0;
    this._clearHold();
  }

  _clearHold() {
    this.currentId = null;
    this.startedAt = 0;
    this.lastSeen = 0;
    this.frames = 0;
    this.confSum = 0;
  }

  /**
   * @param {{id:string, confidence:number}|null} candidate  this frame's classification
   * @param {number} now  ms timestamp
   * @returns {{state:string, id:string|null, progress:number, confidence:number, activated:boolean, heldMs?:number}}
   *   state: 'idle' | 'holding' | 'cooldown' | 'activated'
   */
  update(candidate, now) {
    if (now < this.cooldownUntil) {
      return { state: 'cooldown', id: null, progress: 0, confidence: 0, activated: false, cooldownLeftMs: this.cooldownUntil - now };
    }
    const id = candidate ? candidate.id : null;

    if (id !== null && id === this.currentId) {
      // Same gesture continues: accumulate evidence.
      this.lastSeen = now;
      this.frames++;
      this.confSum += candidate.confidence;
    } else if (this.currentId === null || now - this.lastSeen > this.graceMs) {
      // Nothing being tracked, or the old gesture has been gone/different for too long: restart.
      this._clearHold();
      if (id !== null) {
        this.currentId = id;
        this.startedAt = now;
        this.lastSeen = now;
        this.frames = 1;
        this.confSum = candidate.confidence;
      }
    }
    // else: a brief blip inside the grace period -> ignore it.

    if (this.currentId === null) {
      return { state: 'idle', id: null, progress: 0, confidence: 0, activated: false };
    }

    const heldMs = now - this.startedAt;
    const progress = Math.min(1, heldMs / this.holdMs);
    const confidence = this.confSum / this.frames;

    if (progress >= 1 && this.frames >= this.minFrames && confidence >= this.minAvgConfidence) {
      const id2 = this.currentId;
      this._clearHold();
      this.cooldownUntil = now + this.cooldownMs;
      return { state: 'activated', id: id2, progress: 1, confidence, activated: true, heldMs };
    }
    return { state: 'holding', id: this.currentId, progress, confidence, activated: false };
  }
}
