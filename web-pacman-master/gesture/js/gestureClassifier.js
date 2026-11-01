// gestureClassifier.js — custom, landmark-based classification of 4 gestures.
//
// MediaPipe gives 21 landmarks per hand (0 = wrist, 4 = thumb tip, 8 = index tip,
// 12 = middle tip, 16 = ring tip, 20 = pinky tip; see the diagram in the README).
// We use TWO coordinate sets:
//   * worldLandmarks (metres, 3D): for finger bending and palm direction.
//     These don't depend on camera distance or wrist rotation.
//   * landmarks (image, 2D): for where the two hands are relative to each other.
//     Everything there is divided by the hand's own on-screen size, so it works
//     at any distance from the camera.
// We never use the Left/Right label, and everything is mirror-symmetric, so a
// mirrored preview does not matter and either hand works.
//
// Every test yields a "goodness" from 0..1 using soft ramps (rampUp / rampDown).
// A gesture's confidence is the MINIMUM of its tests (weakest link). If the best
// gesture is below minConfidence, or two different gestures are nearly tied, we
// return null instead of guessing.

export const GESTURE_IDS = ['HEART', 'OK_HAND', 'THUMBS_UP', 'MIDDLE_FINGER'];
export const CLASSIFIER_CONFIG = { minConfidence: 0.55, ambiguityMargin: 0.12, minHandScore: 0.5 };

const FINGERS = { index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] };

// ---------- tiny vector helpers ----------
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dist = (a, b) => len(sub(a, b));
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 });
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** 0 at/below `lo`, 1 at/above `hi`, linear between. */
const rampUp = (v, lo, hi) => clamp01((v - lo) / (hi - lo));
/** 1 at/below `good`, 0 at/above `bad`, linear between. */
const rampDown = (v, good, bad) => clamp01((bad - v) / (bad - good));
/** Angle (degrees) at point b between segments b->a and b->c. 180 = perfectly straight. */
const angleDeg = (a, b, c) => {
  const u = norm(sub(a, b)), v = norm(sub(c, b));
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180 / Math.PI;
};

// ---------- finger extension (0 = fully folded, 1 = fully straight) ----------
/**
 * Combines two independent cues so one noisy cue can't fool us:
 *  - joint angles at PIP and DIP (straight finger ~175 deg, curled ~60-100 deg)
 *  - "reach": fingertip-to-wrist distance divided by knuckle-to-wrist distance
 *    (~1.9 when straight, ~1.0 when curled into the palm)
 */
function fingerExtension(w, ids) {
  const [mcp, pip, dip, tip] = ids.map(i => w[i]);
  const angle = 0.7 * rampUp(angleDeg(mcp, pip, dip), 100, 165) + 0.3 * rampUp(angleDeg(pip, dip, tip), 120, 170);
  const reach = rampUp(dist(w[0], tip) / dist(w[0], mcp), 1.15, 1.8);
  return 0.6 * angle + 0.4 * reach;
}

/** Thumb folds sideways, so use IP-joint angle + distance of the tip from the index knuckle. */
function thumbExtension(w) {
  const handSize = dist(w[0], w[9]);
  const angle = rampUp(angleDeg(w[2], w[3], w[4]), 125, 165);
  const away = rampUp(dist(w[4], w[5]) / handSize, 0.55, 0.95);
  return 0.5 * angle + 0.5 * away;
}

/** Good-ness helpers: "is this finger clearly out / clearly folded?" */
const wantExt = (e) => rampUp(e, 0.4, 0.75);
const wantFold = (e) => rampDown(e, 0.25, 0.6);

// ---------- per-hand analysis ----------
function analyseHand(hand, aspect) {
  const w = hand.worldLandmarks;
  const p2 = hand.landmarks.map(p => ({ x: p.x * aspect, y: p.y, z: 0 })); // aspect-corrected image coords
  const ext = { thumb: thumbExtension(w) };
  for (const f of Object.keys(FINGERS)) ext[f] = fingerExtension(w, FINGERS[f]);

  // Palm normal: perpendicular to the palm plane (index knuckle & pinky knuckle vs wrist).
  // Its SIGN depends on left/right hand, so we only ever use it as a line (absolute dot).
  const normal = norm(cross(sub(w[5], w[0]), sub(w[17], w[0])));
  // Thumb helpers (used by THUMBS_UP). Image y points DOWN, so "up" is -y.
  const thumbAngle = angleDeg(w[2], w[3], w[4]);
  const thumbAway = dist(w[4], w[5]) / dist(w[0], w[9]);
  const tv = sub(p2[4], p2[2]);
  const thumbUpDeg = Math.acos(Math.max(-1, Math.min(1, -tv.y / (len(tv) || 1)))) * 180 / Math.PI;
  const pinchDist = dist(w[4], w[8]) / dist(w[0], w[9]);
  const dir = norm(sub(w[9], w[0])); // wrist -> middle knuckle = which way the fingers point

  const d2 = (a, b) => dist(p2[a], p2[b]);
  const size2D = Math.max(d2(0, 9), 1.2 * d2(5, 17)); // on-screen hand size (max() resists foreshortening)
  const pinch2D = d2(4, 8) / size2D; // thumb-tip <-> index-tip gap as seen in the image
  const ids = [0, 5, 9, 13, 17];
  const center2D = { x: ids.reduce((s, i) => s + p2[i].x, 0) / 5, y: ids.reduce((s, i) => s + p2[i].y, 0) / 5, z: 0 };
  return { ext, normal, dir, pinchDist, pinch2D, thumbAngle, thumbAway, thumbUpDeg, p2, size2D, center2D };
}

// ---------- scoring ----------
// Each scoreX() returns a dictionary of named sub-scores (0..1). A gesture's confidence is the
// smallest one ("weakest link"), and its name is shown in the debug UI so you can see WHY a
// gesture is not triggering (e.g. "weak: touch 12%").
const weakest = (parts) => {
  let name = '', v = Infinity;
  for (const [k, x] of Object.entries(parts)) if (x < v) { v = x; name = k; }
  return { score: v, weakest: name, parts };
};

/** THUMBS_UP 👍: thumb straight and pointing UP, other four fingers folded. */
function scoreThumbsUp(h) {
  const e = h.ext;
  // Looser than thumbExtension(): in a thumbs-up the thumb rests against the fist.
  const thumbOut = 0.6 * rampUp(h.thumbAngle, 120, 160) + 0.4 * rampUp(h.thumbAway, 0.4, 0.8);
  return weakest({
    thumbOut: wantExt(thumbOut), thumbUp: rampDown(h.thumbUpDeg, 30, 70),
    index: wantFold(e.index), middle: wantFold(e.middle), ring: wantFold(e.ring), pinky: wantFold(e.pinky),
  });
}

/** MIDDLE_FINGER 🖕: middle straight; index, ring, pinky folded. Thumb may be anywhere. */
function scoreMiddleFinger(h) {
  const e = h.ext;
  return weakest({ middle: wantExt(e.middle), index: wantFold(e.index), ring: wantFold(e.ring), pinky: wantFold(e.pinky) });
}

/**
 * OK_HAND 👌: thumb tip touches index tip (a ring); middle, ring, pinky straight.
 * The touch is measured BOTH in 3D and in the image and the better one counts. Depth from a
 * single camera is noisy when the palm faces the camera (the ring points at the lens), but then
 * the ring is clearly visible in 2D. Seen from behind, the 3D value is the reliable one.
 */
function scoreOkHand(h) {
  const e = h.ext;
  return weakest({
    touch: rampDown(Math.min(h.pinchDist, h.pinch2D), 0.2, 0.55),
    indexBent: rampDown(e.index, 0.6, 0.95),   // index must not be straight (it curls to meet the thumb)
    middle: wantExt(e.middle), ringFinger: wantExt(e.ring), pinky: wantExt(e.pinky),
  });
}

/**
 * HEART 🫶: thumb tips meet at the bottom, index tips meet at the top, hands side by side.
 * Everything is divided by the average on-screen hand size (so distance from camera is irrelevant).
 */
function scoreHeart(a, b) {
  const s = (a.size2D + b.size2D) / 2;
  const d = (p, q) => dist(p, q) / s;
  const thumbMeet = mid(a.p2[4], b.p2[4]);
  const indexMeet = mid(a.p2[8], b.p2[8]);
  const axis = sub(indexMeet, thumbMeet); // from the heart's bottom point to its top dip
  const fromUpDeg = Math.acos(Math.max(-1, Math.min(1, -axis.y / (len(axis) || 1)))) * 180 / Math.PI; // image y points down
  return weakest({
    thumbsTouch: rampDown(d(a.p2[4], b.p2[4]), 0.5, 1.3),
    indexTouch: rampDown(d(a.p2[8], b.p2[8]), 0.5, 1.3),
    span: rampUp(len(axis) / s, 0.2, 0.5),               // heart has height
    upright: rampDown(fromUpDeg, 35, 80),                // top is above the bottom
    apart: rampUp(d(a.center2D, b.center2D), 0.4, 0.9),  // hands side by side, not clumped
    lobeA: rampUp(d(a.p2[4], a.p2[8]), 0.2, 0.45),       // each hand's thumb & index tips are open
    lobeB: rampUp(d(b.p2[4], b.p2[8]), 0.2, 0.45),
  });
}

/**
 * Classify the hands in one frame.
 * @param {Array} hands  output of HandTracker.detect()
 * @param {{aspect:number}} opts  video width/height (so x and y distances are comparable)
 * @returns {{best, scores, details}}  scores: 0..1 per gesture; details: {id:{weakest, parts}} for debug UI
 */
export function classifyGestures(hands, { aspect = 4 / 3 } = {}) {
  const scores = { HEART: 0, OK_HAND: 0, THUMBS_UP: 0, MIDDLE_FINGER: 0 };
  const details = {};
  const good = hands.filter(h => h.score >= CLASSIFIER_CONFIG.minHandScore).map(h => analyseHand(h, aspect));
  if (good.length === 0) return { best: null, scores, details };

  const single = { OK_HAND: scoreOkHand, THUMBS_UP: scoreThumbsUp, MIDDLE_FINGER: scoreMiddleFinger };
  for (const h of good) {
    for (const [id, fn] of Object.entries(single)) {
      const r = fn(h);
      if (r.score >= scores[id]) { scores[id] = r.score; details[id] = r; }
    }
  }
  if (good.length >= 2) {
    const r = scoreHeart(good[0], good[1]);
    scores.HEART = r.score; details.HEART = r;
  }
  return { best: pickBest(scores), scores, details };
}

/**
 * Choose the single winning gesture from per-gesture scores, or null.
 * null if best < minConfidence, or two gestures are nearly tied (never two at once).
 * Exception: HEART wins a tie, because a heart also contains partial one-hand shapes.
 */
export function pickBest(scores) {
  const ranked = GESTURE_IDS.map(id => ({ id, confidence: scores[id] || 0 }))
    .filter(c => c.confidence >= CLASSIFIER_CONFIG.minConfidence)
    .sort((x, y) => y.confidence - x.confidence);
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0].confidence - ranked[1].confidence < CLASSIFIER_CONFIG.ambiguityMargin) {
    return ranked.find(c => c.id === 'HEART' && ranked[0].confidence - c.confidence < CLASSIFIER_CONFIG.ambiguityMargin) || null;
  }
  return ranked[0];
}
