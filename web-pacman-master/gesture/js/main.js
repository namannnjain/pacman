// main.js — debug UI. Wires the DOM to SecretGestureDetector. (No game logic here either.)
import { SecretGestureDetector } from './gestureController.js';
import { LOCAL_ASSETS } from './handTracker.js';

const $ = (id) => document.getElementById(id);
const GESTURES = [
  { id: 'HEART', emoji: '🫶' }, { id: 'OK_HAND', emoji: '👌' },
  { id: 'THUMBS_UP', emoji: '👍' }, { id: 'MIDDLE_FINGER', emoji: '🖕' },
];
// Pairs of landmark indices to draw as the hand skeleton.
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

// Build the four status cards.
const cardEls = {};
for (const g of GESTURES) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<div class="emoji">${g.emoji}</div><div class="name">${g.id}</div><div class="bar"><div></div></div><div class="why"></div>`;
  $('cards').appendChild(el);
  cardEls[g.id] = el;
}

const canvas = $('overlay');
const ctx = canvas.getContext('2d');
const useLocal = new URLSearchParams(location.search).has('local'); // index.html?local=1 -> offline assets

const detector = new SecretGestureDetector({
  video: $('video'),
  processWhenDisabled: true,            // debug UI wants live landmarks always
  tracker: useLocal ? LOCAL_ASSETS : {},
  onStatusChange: showStatus,
  onFrame: showFrame,
  onGestureDetected: (g) => {
    log(`<b>${g.id}</b> detected (${Math.round(g.confidence * 100)}%, held ${Math.round(g.heldMs)} ms)`);
    cardEls[g.id].classList.add('fired');
    setTimeout(() => cardEls[g.id].classList.remove('fired'), 1500);
  },
});

function showStatus(s) {
  $('statusText').textContent = s.message;
  $('dot').className = 'dot ' + (s.state === 'running' ? 'ok' : s.state === 'error' ? 'err' : s.state === 'stopped' || s.state === 'idle' ? '' : 'busy');
  const running = s.state === 'running';
  $('btnStart').disabled = running || s.state === 'loading-model' || s.state === 'starting-camera';
  $('btnStop').disabled = !running;
  $('btnReset').disabled = !running;
  $('hint').classList.toggle('hide', running);
  $('hint').textContent = s.state === 'error' ? 'Camera off' : 'Press START CAMERA';
  const err = $('error');
  err.hidden = s.state !== 'error';
  if (s.state === 'error') err.textContent = s.message;
  if (!running) clearReadout();
}

function showFrame(f) {
  if (canvas.width !== f.videoWidth) { canvas.width = f.videoWidth; canvas.height = f.videoHeight; }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 3;
  for (const h of f.hands) {
    const P = h.landmarks.map(p => [p.x * canvas.width, p.y * canvas.height]);
    ctx.strokeStyle = '#00f0ff'; ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 8;
    ctx.beginPath();
    for (const [a, b] of BONES) { ctx.moveTo(...P[a]); ctx.lineTo(...P[b]); }
    ctx.stroke();
    ctx.fillStyle = '#ff2bd6';
    for (const [x, y] of P) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); }
  }
  ctx.shadowBlur = 0;

  $('hands').textContent = f.hands.length;
  $('fps').textContent = Math.round(f.fps);
  const c = f.candidate;
  $('gesture').textContent = c ? c.id : '—';
  const conf = c ? c.confidence : 0;
  $('confBar').style.width = conf * 100 + '%';
  $('confVal').textContent = Math.round(conf * 100) + '%';
  const prog = f.stability ? f.stability.progress : 0;
  $('stabBar').style.width = prog * 100 + '%';
  $('stabVal').textContent = f.stability && f.stability.state === 'cooldown' ? 'cooldown' : Math.round(prog * 100) + '%';
  for (const g of GESTURES) {
    cardEls[g.id].querySelector('.bar > div').style.width = f.scores[g.id] * 100 + '%';
    cardEls[g.id].classList.toggle('active', !!c && c.id === g.id);
    // Show the weakest test so you can see why a gesture isn't firing (e.g. "touch 12%").
    const d = f.details && f.details[g.id];
    cardEls[g.id].querySelector('.why').textContent = !d ? '' : f.scores[g.id] >= 0.55 ? 'ok' : d.weakest + ' ' + Math.round(d.parts[d.weakest] * 100) + '%';
  }
}

function clearReadout() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const id of ['hands', 'fps']) $(id).textContent = '0';
  $('gesture').textContent = '—';
  for (const id of ['confBar', 'stabBar']) $(id).style.width = '0';
  $('confVal').textContent = '0%'; $('stabVal').textContent = '0%';
  for (const g of GESTURES) { cardEls[g.id].querySelector('.bar > div').style.width = '0'; cardEls[g.id].classList.remove('active'); }
}

function log(html) {
  const li = document.createElement('li');
  li.innerHTML = new Date().toLocaleTimeString() + '  ' + html;
  $('log').prepend(li);
  while ($('log').children.length > 50) $('log').lastChild.remove();
}

$('btnStart').onclick = async () => {
  try { await detector.start(); detector.enableDetection(); } catch (e) { /* shown via onStatusChange */ }
};
$('btnStop').onclick = () => detector.stop();
$('btnReset').onclick = () => { detector.reset(); $('log').innerHTML = ''; };
window.addEventListener('pagehide', () => detector.destroy()); // release camera if the tab closes
window.detector = detector; // handy in the browser console
