//////////////////////////////////////////////////////////////////////////////////////
// Helpline (secret gesture easter egg)
//
// After the last life is lost the GAME OVER screen opens a 10 second window.  If the
// player shows one of four secret hand gestures to the webcam they get a second chance:
//
//   HEART          revive with 2 lives
//   OK_HAND        revive with 1 life + power mode (ghosts turn blue for a while)
//   THUMBS_UP      leaderboard bonus (score + high score), no revive
//   MIDDLE_FINGER  revive with 1 life... and 10 extra ghosts chasing you
//
// The gestures are never listed on screen, the player only sees a hint to "use a gesture".
//
// Gesture recognition lives in gesture/js (the standalone detector, an ES module loaded
// lazily with import()).  If the module, the model or the camera can't be loaded, the
// game simply behaves as before: no hint, no window.
//
// Test switches (add to the URL):
//   ?oneLife       start a normal game with no spare lives (game over on the first death)
//   ?egg_debug     keys 1-4 act as the four gestures during the game over window

var helpline = (function() {

    var FPS = 60;

    ////////////////////////////////////////////////////////////////////////////////
    // Tunables

    var WINDOW_SECONDS   = 10;        // how long the game over screen waits for a gesture
    var EFFECT_FRAMES    = 2.4*FPS;   // how long the gesture effect plays before the game continues
    var BONUS_POINTS     = 5000;      // THUMBS_UP
    var POWER_SECONDS    = 10;        // OK_HAND: minimum length of the power mode
    var SWARM_GHOSTS     = 10;        // MIDDLE_FINGER: extra ghosts
    var SWARM_SECONDS    = 20;        // MIDDLE_FINGER: how long they stay (they pop out one by one)

    var DETECTOR_URL = "./gesture/js/gestureController.js";
    var TRACKER_URL  = "./gesture/js/handTracker.js";

    var search = (typeof window != "undefined") ? window.location.search : "";
    var DEBUG_KEYS = /[?&]egg_debug/.test(search);
    var ONE_LIFE   = /[?&]oneLife/.test(search);
    var USE_LOCAL  = /[?&]local=1/.test(search); // offline assets (see gesture/README.md)

    // what each gesture does, and the text shown for it
    var GESTURES = {
        HEART:         { title: "SECOND CHANCE!", sub: "2 LIVES",              color: "#ff5fa8", lives: 2 },
        OK_HAND:       { title: "POWER MODE!",    sub: "1 LIFE + POWER",       color: "#ffe600", lives: 1 },
        THUMBS_UP:     { title: "LEADERBOARD BONUS!", sub: "+" + BONUS_POINTS, color: "#ffd24a", lives: 0 },
        MIDDLE_FINGER: { title: "10 GHOSTS!?",    sub: "1 LIFE. GOOD LUCK",    color: "#ff3030", lives: 1 },
    };

    ////////////////////////////////////////////////////////////////////////////////
    // State

    var detector = null;     // SecretGestureDetector, once loaded
    var loading = false;
    var cameraReady = false; // detector started (model loaded + camera open)
    var failed = false;      // something went wrong: easter egg disabled for this page view
    var windowOpen = false;
    var pending = null;      // gesture id waiting to be picked up by overState

    var usedThisGame = false; // only one helpline gesture is allowed per game

    var onPlayStart = null;  // one-shot function run when the revived level starts playing

    var effect = null;       // {id, frames, parts}

    // preview box (DOM)
    var box, video, overlay, overlayCtx;

    ////////////////////////////////////////////////////////////////////////////////
    // Preview box: small mirrored webcam view while the window is open

    var CSS = [
        "#helpline{position:fixed;right:12px;bottom:12px;width:176px;padding:8px;background:#000;",
        "  z-index:6;opacity:0;pointer-events:none;transition:opacity .25s;font-family:ArcadeR,monospace;",
        "  box-shadow:0 -3px 0 0 #00ff00,0 3px 0 0 #00ff00,-3px 0 0 0 #00ff00,3px 0 0 0 #00ff00,",
        "             inset 0 0 0 3px #000,inset 0 0 0 5px #00b300;}",
        "#helpline.on{opacity:1;}",
        "#helpline .hl-view{position:relative;width:160px;height:120px;background:#001a00;overflow:hidden;}",
        "#helpline video,#helpline canvas{position:absolute;left:0;top:0;width:160px;height:120px;",
        "  transform:scaleX(-1);image-rendering:pixelated;}",
        "#helpline video{object-fit:cover;filter:contrast(1.1) saturate(.6) brightness(.9);}",
        "#helpline .hl-cap{color:#00ff00;font-size:7px;text-align:center;margin-top:6px;letter-spacing:1px;}",
    ].join("\n");

    var buildBox = function() {
        if (box || typeof document == "undefined") return;
        var st = document.createElement("style");
        st.textContent = CSS;
        document.head.appendChild(st);

        box = document.createElement("div");
        box.id = "helpline";
        var view = document.createElement("div");
        view.className = "hl-view";
        video = document.createElement("video");
        video.muted = true;
        video.setAttribute("playsinline", "");
        overlay = document.createElement("canvas");
        overlay.width = 160;
        overlay.height = 120;
        overlayCtx = overlay.getContext("2d");
        view.appendChild(video);
        view.appendChild(overlay);
        var cap = document.createElement("div");
        cap.className = "hl-cap";
        cap.textContent = "CAM";
        box.appendChild(view);
        box.appendChild(cap);
        document.body.appendChild(box);
    };

    // draw the hand skeleton on the small overlay (called for every processed frame)
    var HAND_LINKS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
                      [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
    var drawHands = function(info) {
        if (!overlayCtx) return;
        var c = overlayCtx, w = overlay.width, h = overlay.height, i, k, hand, p, q;
        c.clearRect(0, 0, w, h);
        c.lineWidth = 1;
        c.strokeStyle = "#00ff66";
        c.fillStyle = "#ffff00";
        for (i=0; i<info.hands.length; i++) {
            hand = info.hands[i].landmarks;
            c.beginPath();
            for (k=0; k<HAND_LINKS.length; k++) {
                p = hand[HAND_LINKS[k][0]];
                q = hand[HAND_LINKS[k][1]];
                c.moveTo(p.x*w, p.y*h);
                c.lineTo(q.x*w, q.y*h);
            }
            c.stroke();
            for (k=0; k<hand.length; k++)
                c.fillRect(Math.round(hand[k].x*w)-1, Math.round(hand[k].y*h)-1, 2, 2);
        }
    };

    ////////////////////////////////////////////////////////////////////////////////
    // Detector loading

    var onGesture = function(g) {
        if (!windowOpen || pending) return;
        if (GESTURES[g.id]) pending = g.id;
    };

    var startDetector = function() {
        return detector.start().then(function() {
            cameraReady = true;
            loading = false;
        }).catch(function(err) {
            // no camera, permission denied, offline, file:// ...  -> quietly run without the easter egg
            console.warn("[helpline] disabled:", err && err.message ? err.message : err);
            failed = true;
            loading = false;
        });
    };

    var load = function() {
        if (loading || cameraReady || failed) return;
        loading = true;
        buildBox();
        if (detector) { // came back from the home screen: just reopen the camera
            startDetector();
            return;
        }
        var imports = [import(DETECTOR_URL)];
        if (USE_LOCAL) imports.push(import(TRACKER_URL));
        Promise.all(imports).then(function(mods) {
            var opts = {
                video: video,
                onGestureDetected: onGesture,
                onFrame: function(info) { if (windowOpen) drawHands(info); },
                onStatusChange: function(s) {
                    if (s.state == "error") {
                        console.warn("[helpline] " + s.message);
                        cameraReady = false;
                        failed = (s.error && s.error.code != "camera-disconnected") || failed;
                        loading = false;
                    }
                },
            };
            if (USE_LOCAL) opts.tracker = mods[1].LOCAL_ASSETS;
            detector = new mods[0].SecretGestureDetector(opts);
            return startDetector();
        }).catch(function(err) { // the module itself could not be loaded
            console.warn("[helpline] disabled:", err && err.message ? err.message : err);
            failed = true;
            loading = false;
        });
    };

    ////////////////////////////////////////////////////////////////////////////////
    // Pixel sprites for the effects

    var HEART = [
        ".XX.XX.",
        "XXXXXXX",
        "XXXXXXX",
        "XXXXXXX",
        ".XXXXX.",
        "..XXX..",
        "...X...",
    ];
    var STAR = [
        "...X...",
        "...X...",
        ".XXXXX.",
        "XXXXXXX",
        ".XXXXX.",
        "..X.X..",
        ".X...X.",
    ];
    var COIN = [
        ".XXXX.",
        "XXXXXX",
        "XX..XX",
        "XX..XX",
        "XXXXXX",
        ".XXXX.",
    ];
    var SKULL = [
        ".XXXXX.",
        "XXXXXXX",
        "X..X..X",
        "X..X..X",
        "XXXXXXX",
        ".XXXXX.",
        ".X.X.X.",
    ];
    var SOUNDS = { HEART: "helpHeart", OK_HAND: "helpPower", THUMBS_UP: "helpBonus", MIDDLE_FINGER: "helpGhosts" };
    var SPRITES = { HEART: HEART, OK_HAND: STAR, THUMBS_UP: COIN, MIDDLE_FINGER: SKULL };

    var drawBitmap = function(ctx, bmp, x, y, s, color) {
        var r, c;
        ctx.fillStyle = color;
        for (r=0; r<bmp.length; r++)
            for (c=0; c<bmp[r].length; c++)
                if (bmp[r].charAt(c) == "X")
                    ctx.fillRect(Math.round(x + c*s), Math.round(y + r*s), s, s);
    };

    // a pixel-art open hand for the hint
    var HAND = [
        "...X.X.X....",
        "...X.X.X.X..",
        ".X.X.X.X.X..",
        ".X.XXXXXXX..",
        ".XXXXXXXXXX.",
        ".XXXXXXXXXX.",
        "..XXXXXXXXX.",
        "...XXXXXXX..",
        "....XXXXX...",
    ];

    ////////////////////////////////////////////////////////////////////////////////
    // Effect particles (map coordinates: 224 x 288)

    var rand = function(a, b) { return a + Math.random()*(b-a); };

    var makeParticles = function(id) {
        var parts = [], i, p;
        var W = 224, H = 288;
        if (id == "HEART") {
            for (i=0; i<46; i++)
                parts.push({ x: rand(0,W), y: H+rand(0,60), vx: rand(-.3,.3), vy: rand(-2.6,-1.1), s: Math.random()<.4?3:2,
                             c: ["#ff5fa8","#ff2d6f","#ffb8d8"][i%3], t: 0 });
        }
        else if (id == "OK_HAND") {
            for (i=0; i<40; i++) {
                var a = rand(0, Math.PI*2), v = rand(1.2, 3.8);
                parts.push({ x: W/2, y: 130, vx: Math.cos(a)*v, vy: Math.sin(a)*v, s: Math.random()<.5?3:2,
                             c: ["#ffe600","#ffffff","#00ffff"][i%3], t: 0 });
            }
        }
        else if (id == "THUMBS_UP") {
            for (i=0; i<40; i++)
                parts.push({ x: rand(0,W), y: -rand(0,100), vx: rand(-.2,.2), vy: rand(1.4,3.2), s: 2, c: "#ffd24a", t: 0 });
        }
        else { // MIDDLE_FINGER: skulls and bugs sweeping in from both sides
            for (i=0; i<30; i++) {
                var left = i%2 == 0;
                parts.push({ x: left ? -rand(0,120) : W+rand(0,120), y: rand(30,H-30), vx: (left?1:-1)*rand(1.6,3.4), vy: 0,
                             s: 2, c: i%3==0 ? "#ff3030" : "#ffffff", t: 0, bug: i%3 != 0 });
            }
        }
        return parts;
    };

    var drawEffect = function(ctx) {
        if (!effect) return;
        var g = GESTURES[effect.id], f = effect.frames, i, p;
        var W = 224, H = 288;
        var fade = Math.min(1, f/12) * Math.min(1, (EFFECT_FRAMES-f)/20);

        ctx.save();

        // screen flash / tint
        ctx.globalAlpha = Math.max(0, 0.45 - f/40);
        ctx.fillStyle = g.color;
        ctx.fillRect(-8, -8, W+16, H+16);
        if (effect.id == "MIDDLE_FINGER") { // angry pulsing red frame
            ctx.globalAlpha = 0.25 + 0.2*Math.sin(f*0.5);
            ctx.strokeStyle = "#ff0000";
            ctx.lineWidth = 6;
            ctx.strokeRect(0, 0, W, H);
        }

        // expanding rings for power mode
        if (effect.id == "OK_HAND") {
            ctx.globalAlpha = Math.max(0, 1 - f/50);
            ctx.strokeStyle = "#ffe600";
            ctx.lineWidth = 2;
            for (i=0; i<3; i++) {
                var r = 8 + f*3.2 - i*22;
                if (r <= 0) continue;
                ctx.beginPath();
                ctx.arc(W/2, 130, r, 0, Math.PI*2);
                ctx.stroke();
            }
        }

        // particles
        var bmp = SPRITES[effect.id];
        for (i=0; i<effect.parts.length; i++) {
            p = effect.parts[i];
            p.x += p.vx; p.y += p.vy; p.t++;
            if (effect.id == "HEART") p.x += Math.sin((p.t + i*7)*0.1)*0.4;
            ctx.globalAlpha = Math.min(1, fade*1.4);
            if (p.bug) {
                customSprites.drawVirus(ctx, p.x, p.y, Math.floor(p.t/6)%2, 1);
            }
            else if (effect.id == "OK_HAND") {
                ctx.fillStyle = p.c;
                ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
            }
            else if (effect.id == "THUMBS_UP") {
                drawBitmap(ctx, bmp, p.x, p.y, p.s, Math.floor((p.t+i)/5)%2 ? "#ffd24a" : "#fff3b0");
            }
            else {
                drawBitmap(ctx, bmp, p.x, p.y, p.s, p.c);
            }
        }

        // big banner
        ctx.globalAlpha = fade;
        var bw = W-24, bh = 54, bx = 12, by = 86;
        ctx.fillStyle = "#000";
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = g.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx+1, by+1, bw-2, bh-2);
        drawBitmap(ctx, bmp, W/2 - 3.5*3, by+6, 3, g.color);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = "9px ArcadeR";
        ctx.fillStyle = g.color;
        ctx.fillText(g.title, W/2, by+ 6 + 24);
        ctx.font = "7px ArcadeR";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(g.sub, W/2, by + 6 + 38);
        ctx.restore();
    };

    ////////////////////////////////////////////////////////////////////////////////
    // Public API

    return {
        WINDOW_FRAMES: WINDOW_SECONDS*FPS,
        EFFECT_FRAMES: EFFECT_FRAMES,

        // lives at the start of a normal game (?oneLife is a test switch)
        getStartLives: function() { return ONE_LIFE ? 1 : 3; },

        // a brand new game starts: the helpline is available again
        newGame: function() { usedThisGame = false; },

        // a normal game is starting: get the model and camera ready in the background
        prepare: function() {
            if (practiceMode) return;
            load();
        },

        // back on the home screen: release the camera
        release: function() {
            if (detector && cameraReady) {
                detector.stop();
                cameraReady = false;
            }
            windowOpen = false;
            if (box) box.className = "";
        },

        // the game over screen is showing; returns true if the gesture window is open
        open: function() {
            if (practiceMode || usedThisGame || !cameraReady || !detector || !detector.isRunning()) return false;
            pending = null;
            effect = null;
            windowOpen = true;
            overlayCtx && overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
            detector.enableDetection();
            box.className = "on";
            audio.helpHint.play();
            return true;
        },

        // stop listening (window over, or a gesture was accepted)
        close: function() {
            windowOpen = false;
            if (detector) detector.disableDetection();
            if (box) box.className = "";
        },

        // debug keys 1-4 act like the gestures (only with ?egg_debug)
        pressKey: function(code) {
            if (!DEBUG_KEYS || !windowOpen || pending) return;
            var id = ["HEART", "OK_HAND", "THUMBS_UP", "MIDDLE_FINGER"][code-49];
            if (id) pending = id;
        },
        isDebug: function() { return DEBUG_KEYS; },

        // gesture waiting to be handled (cleared when read)
        take: function() {
            var g = pending;
            pending = null;
            return g;
        },

        // start the on-screen effect for a gesture
        startEffect: function(id) {
            usedThisGame = true; // that was this game's one helpline
            effect = { id: id, frames: 0, parts: makeParticles(id) };
            audio[SOUNDS[id]].play();
        },
        updateEffect: function() { if (effect) effect.frames++; },
        drawEffect: drawEffect,

        // apply the gesture's reward.  Returns the state the game should go to next:
        // "restart" (revive) or "home".
        apply: function(id) {
            var g = GESTURES[id];
            effect = null;
            if (id == "THUMBS_UP") {
                addScore(BONUS_POINTS); // also raises the high score when it beats it
                return "home";
            }
            extraLives = g.lives; // readyRestartState will use one of them
            if (id == "OK_HAND") {
                onPlayStart = function() { energizer.activate(POWER_SECONDS*FPS); };
            }
            else if (id == "MIDDLE_FINGER") {
                onPlayStart = function() { powerups.spawnSwarm(SWARM_GHOSTS, SWARM_SECONDS); };
            }
            return "restart";
        },

        // called when a (revived) level starts playing
        playStarted: function() {
            if (onPlayStart) {
                var f = onPlayStart;
                onPlayStart = null;
                f();
            }
        },
        cancelPending: function() { onPlayStart = null; },

        // the "use a gesture" hint drawn under GAME OVER; frame = frames since the window opened
        drawHint: function(ctx, frame) {
            var left = Math.max(0, Math.ceil((this.WINDOW_FRAMES - frame)/FPS));
            ctx.save();
            // black backing so the text is readable on top of the maze
            ctx.fillStyle = "#000";
            ctx.fillRect(24, 170, 176, 80);
            ctx.strokeStyle = "#2121ff";
            ctx.lineWidth = 1;
            ctx.strokeRect(24.5, 170.5, 175, 79);
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            var blink = Math.floor(frame/20) % 2 == 0;
            ctx.font = "8px ArcadeR";
            ctx.fillStyle = blink ? "#00ffff" : "#00a0a0";
            ctx.fillText("PSST... NEED HELP?", 112, 176);
            ctx.font = "7px ArcadeR";
            ctx.fillStyle = "#ffffff";
            ctx.fillText("USE A HAND GESTURE", 112, 190);
            // little hand that waves
            drawBitmap(ctx, HAND, 112 - 6*2, 203 + (Math.floor(frame/15)%2), 2, "#ffb8ae");
            // countdown bar
            var w = 120, x = 112 - w/2, y = 228;
            ctx.fillStyle = "#222";
            ctx.fillRect(x, y, w, 4);
            ctx.fillStyle = left <= 3 ? "#ff3030" : "#00ff66";
            ctx.fillRect(x, y, Math.round(w * (1 - frame/this.WINDOW_FRAMES)), 4);
            ctx.font = "7px ArcadeR";
            ctx.fillStyle = "#ffff00";
            ctx.fillText(String(left), 112, y+9);
            ctx.restore();
        },
    };
})();

// ?egg_debug: number keys stand in for the gestures
if (typeof window != "undefined" && helpline.isDebug()) {
    window.addEventListener("keydown", function(e) { helpline.pressKey(e.keyCode); }, false);
}
