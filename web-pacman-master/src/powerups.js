//////////////////////////////////////////////////////////////////////////////////////
// Power-up orbs
//
// Special orbs occasionally spawn on top of a random pellet (hiding it while the orb
// is there).  Touching an orb applies a buff or a debuff to Pac-Man:
//
//   STACK SHIELD  (buff)   nullifies the next ghost attack, lasts up to 5 seconds
//   O(N)          (buff)   speeds Pac-Man up for 5 seconds
//   O(N^2)        (debuff) slows Pac-Man down for 7 seconds
//   FORK BOMB     (debuff) spawns two extra computer-virus monsters for 10 seconds
//
// The pellet underneath is eaten as usual when Pac-Man touches the orb, so the
// normal "all dots eaten" level-complete logic is never affected.
//
// All timers are counted in game frames (60 per second) and are saved/loaded by the
// VCR, so rewinding in practice mode behaves correctly.

var ORB_SHIELD = 0;
var ORB_SPEED_UP = 1;
var ORB_SLOW_DOWN = 2;
var ORB_FORK_BOMB = 3;

var powerups = (function() {

    var FPS = 60;

    ////////////////////////////////////////////////////////////////////////////////
    // Tunables

    var SHIELD_DURATION    = 5*FPS;  // shield expires if no ghost hits it within this time
    var SHIELD_GRACE       = 1.5*FPS;// brief protection after the shield breaks, so Pac-Man
                                     // can get out of the ghost he's overlapping
    var SPEED_UP_DURATION  = 5*FPS;  // O(N)
    var SLOW_DOWN_DURATION = 7*FPS;  // O(N^2)

    var VIRUS_DURATION     = 10*FPS; // FORK BOMB: how long the extra viruses stay
    var VIRUS_SPAWN_GAP    = 0.6*FPS;// the second virus appears this long after the first
    var VIRUS_SPAWN_GRACE  = 0.8*FPS;// a freshly spawned virus is harmless (and flickers) this long
    var VIRUS_FADE_TIME    = 1*FPS;  // viruses flicker out during the last moments

    var ORB_LIFETIME     = 12*FPS;   // an uncollected orb disappears after this long
    var ORB_BLINK_TIME   = 2.5*FPS;  // orb blinks during its last moments
    var SPAWN_MIN_DELAY  = 5*FPS;    // random delay between spawns
    var SPAWN_MAX_DELAY  = 11*FPS;
    var MAX_ORBS         = 2;        // max orbs on the map at once
    var MIN_SPAWN_DIST   = 8;        // min distance (in tiles) from Pac-Man when spawning

    var POPUP_DURATION   = 100;      // frames the pickup text floats above Pac-Man

    // speed effects, expressed as steps per frame
    // (normal speed is a table of 1s and 2s, depending on the level; see Actor.js)
    var SPEED_UP_STEPS   = 2;        // always the maximum
    var SLOW_DOWN_STEPS  = [1,0];    // one step every other frame (about half speed)

    var SPEED_NONE = -1;

    var INFO = [];
    INFO[ORB_SHIELD]    = { hud:"SHIELD", popup:"STACK SHIELD",   color:"#3d9bff", dark:"#1b4fa8", good:true  };
    INFO[ORB_SPEED_UP]  = { hud:"O(N)",   popup:"O(N) SPEED UP",   color:"#00ffa6", dark:"#00805a", good:true  };
    INFO[ORB_SLOW_DOWN] = { hud:"O(N^2)", popup:"O(N^2) SLOWED",   color:"#ff2d6f", dark:"#8f1240", good:false };
    INFO[ORB_FORK_BOMB] = { hud:"FORK BOMB", popup:"FORK BOMB!",    color:"#c35bff", dark:"#5a1f8f", good:false };

    ////////////////////////////////////////////////////////////////////////////////
    // State

    var orbs;           // list of {x,y,type,framesLeft}  (x,y in tiles)
    var spawnTimer;     // frames until the next spawn attempt
    var shieldFrames;   // frames of shield left (0 = no shield)
    var graceFrames;    // frames of post-shield protection left
    var speedType;      // SPEED_NONE, ORB_SPEED_UP, or ORB_SLOW_DOWN
    var speedFrames;    // frames of speed effect left
    var speedTotal;     // total length of the current speed effect (for the HUD ring)
    var tick;           // free-running frame counter for animations
    var viruses = [];   // pool of extra monsters (Ghost objects, created on first use)
    var virusCount = 0; // how many of the pool are in play (2 for FORK BOMB, 10 for the ghost swarm)
    var virusStyle = "virus"; // "virus" = 🦠 sprites (FORK BOMB), "bugs" = ghost-bug sprites (helpline swarm)
    var virusFrames;    // frames of the extra monsters left (0 = none on the map)

    var popupText, popupColor, popupX, popupY, popupFrames;

    var saved = {};

    ////////////////////////////////////////////////////////////////////////////////
    // Helpers

    var randInt = function(min, max) {
        return Math.floor(Math.random() * (max-min+1)) + min;
    };

    // Test mode: open index.html?forkbomb to make every orb a Fork Bomb, spawning every ~3s.
    var FORCE_FORK = (typeof window != "undefined") && /[?&]forkbomb/.test(window.location.search);

    var nextSpawnDelay = function() {
        if (FORCE_FORK) return 3*FPS;
        return randInt(SPAWN_MIN_DELAY, SPAWN_MAX_DELAY);
    };

    // Orb types come out of a shuffled bag, so every 4 orbs contain each type exactly once
    // (pure randomness could go a minute or more without a Fork Bomb).
    var bag = [];
    var nextOrbType = function() {
        if (FORCE_FORK) return ORB_FORK_BOMB;
        if (bag.length == 0) {
            bag = [ORB_SHIELD, ORB_SPEED_UP, ORB_SLOW_DOWN, ORB_FORK_BOMB];
            var i, j, t;
            for (i=bag.length-1; i>0; i--) {
                j = randInt(0, i);
                t = bag[i]; bag[i] = bag[j]; bag[j] = t;
            }
        }
        return bag.pop();
    };

    var showPopup = function(text, color) {
        popupText = text;
        popupColor = color;
        popupX = pacman.pixel.x;
        popupY = pacman.pixel.y - 12;
        popupFrames = POPUP_DURATION;
    };

    var isOrbAt = function(x, y) {
        var i;
        for (i=0; i<orbs.length; i++) {
            if (orbs[i].x == x && orbs[i].y == y)
                return true;
        }
        return false;
    };

    // pick a random pellet tile that is far enough from Pac-Man and spawn an orb on it
    var trySpawn = function() {
        if (!map || orbs.length >= MAX_ORBS)
            return;

        var candidates = [];
        var x, y, i = 0;
        for (y=0; y<map.numRows; y++) {
            for (x=0; x<map.numCols; x++, i++) {
                if (map.currentTiles[i] != '.')
                    continue; // only plain pellets (not energizers, not empty tiles)
                if (Math.abs(x-pacman.tile.x) + Math.abs(y-pacman.tile.y) < MIN_SPAWN_DIST)
                    continue;
                if (isOrbAt(x,y))
                    continue;
                candidates.push({x:x, y:y});
            }
        }
        if (candidates.length == 0)
            return;

        var c = candidates[randInt(0, candidates.length-1)];
        orbs.push({
            x: c.x,
            y: c.y,
            type: nextOrbType(),
            framesLeft: ORB_LIFETIME,
        });
    };

    ////////////////////////////////////////////////////////////////////////////////
    // FORK BOMB viruses
    //
    // The viruses are ordinary Ghost objects (so they steer and move through the maze
    // exactly like the bugs) that live outside the 'actors'/'ghosts' lists.  They are
    // never scared and cannot be eaten.  Virus 0 chases Pac-Man directly (like Blinky),
    // virus 1 ambushes four tiles ahead (like Pinky).

    var BUG_COLORS = ["#ff0000", "#ffb8ff", "#00ffff", "#ffb851"]; // same colors as the four ghosts

    // grow the pool to at least n monsters
    var ensureViruses = function(n) {
        var i, v;
        for (i=viruses.length; i<n; i++) {
            v = new Ghost();
            v.name = "virus" + i;
            v.color = "#7cfc00";
            v.isVisible = true;
            v.index = i;
            v.savedAge = {};
            if (i % 2 == 0) { // even ones chase Pac-Man directly (like Blinky)
                v.getTargetTile = function() { return { x: pacman.tile.x, y: pacman.tile.y }; };
                v.getTargetPixel = function() { return { x: pacman.pixel.x, y: pacman.pixel.y }; };
            }
            else {            // odd ones ambush four tiles ahead (like Pinky)
                v.getTargetTile = pinky.getTargetTile;
                v.getTargetPixel = pinky.getTargetPixel;
            }
            viruses.push(v);
        }
    };

    // put 'count' extra monsters on the map for 'frames' frames; they pop out of the ghost
    // house door one after another
    var startViruses = function(count, frames, style) {
        ensureViruses(count);
        virusCount = count;
        virusStyle = style;
        var gap = (style == "bugs") ? 0.45*FPS : VIRUS_SPAWN_GAP;
        var i, v, corner;
        for (i=0; i<count; i++) {
            v = viruses[i];
            corner = (style == "bugs") ? ghosts[i%4].cornerTile : ghosts[(2*i+1)%4].cornerTile;
            v.cornerTile = { x: corner.x, y: corner.y };
            v.startPixel = { x: blinky.startPixel.x, y: blinky.startPixel.y };
            v.startDirEnum = (i % 2 == 0) ? DIR_LEFT : DIR_RIGHT;
            v.startMode = v.arriveHomeMode = GHOST_OUTSIDE;
            v.mode = GHOST_OUTSIDE;
            v.scared = false;
            v.sigReverse = false;
            v.sigLeaveHome = false;
            v.elroy = 0;
            v.savedSigReverse = {};
            v.savedSigLeaveHome = {};
            v.savedMode = {};
            v.savedScared = {};
            v.savedElroy = {};
            v.savedFaceDirEnum = {};
            v.savedAge = {};
            Actor.prototype.reset.apply(v);
            v.faceDirEnum = v.dirEnum;
            v.age = -i*gap; // negative age = not on the map yet
        }
        virusFrames = frames;
    };

    var virusOnMap = function(v) { return v.age >= 0; };
    var virusArmed = function(v)  { return v.age >= VIRUS_SPAWN_GRACE; };

    var collect = function(orb) {
        var info = INFO[orb.type];

        if (orb.type == ORB_SHIELD) {
            shieldFrames = SHIELD_DURATION;
        }
        else if (orb.type == ORB_SPEED_UP) {
            // a new speed orb replaces whatever speed effect was active
            speedType = ORB_SPEED_UP;
            speedFrames = speedTotal = SPEED_UP_DURATION;
        }
        else if (orb.type == ORB_SLOW_DOWN) {
            speedType = ORB_SLOW_DOWN;
            speedFrames = speedTotal = SLOW_DOWN_DURATION;
        }
        else if (orb.type == ORB_FORK_BOMB) {
            if (virusFrames > 0)
                virusFrames = Math.max(virusFrames, VIRUS_DURATION); // already infected: restart the clock
            else
                startViruses(2, VIRUS_DURATION, "virus");
        }

        showPopup(info.popup, info.color);
        if (info.good)
            audio.credit.play();
        else
            audio.eatingGhost.play();
    };

    ////////////////////////////////////////////////////////////////////////////////
    // Public API

    return {

        reset: function() {
            orbs = [];
            spawnTimer = nextSpawnDelay();
            shieldFrames = 0;
            graceFrames = 0;
            speedType = SPEED_NONE;
            speedFrames = 0;
            speedTotal = 1;
            tick = 0;
            popupFrames = 0;
            virusFrames = 0;
            virusCount = 0;
        },

        // advance one frame (called from playState.update)
        update: function() {
            var i;
            tick++;

            if (shieldFrames > 0) shieldFrames--;
            if (graceFrames > 0)  graceFrames--;
            if (popupFrames > 0)  popupFrames--;
            if (virusFrames > 0) {
                virusFrames--;
                for (i=0; i<virusCount; i++) {
                    viruses[i].age++;
                    if (virusOnMap(viruses[i]))
                        viruses[i].frames++;
                }
            }
            if (speedFrames > 0) {
                speedFrames--;
                if (speedFrames == 0)
                    speedType = SPEED_NONE;
            }

            // age orbs and remove the expired ones
            for (i=orbs.length-1; i>=0; i--) {
                if (--orbs[i].framesLeft <= 0)
                    orbs.splice(i,1);
            }

            // spawn
            if (spawnTimer > 0) {
                spawnTimer--;
            }
            else {
                trySpawn();
                spawnTimer = nextSpawnDelay();
            }
        },

        // test whether Pac-Man is touching an orb (called once per movement step)
        testCollide: function() {
            var i, o;
            for (i=orbs.length-1; i>=0; i--) {
                o = orbs[i];
                if (o.x == pacman.tile.x && o.y == pacman.tile.y) {
                    orbs.splice(i,1);
                    collect(o);
                }
            }
        },

        // Called when a ghost catches Pac-Man.
        // Returns true if the attack was nullified (by the shield, or the brief grace
        // period right after the shield broke).
        absorbGhostHit: function() {
            if (shieldFrames > 0) {
                shieldFrames = 0;
                graceFrames = SHIELD_GRACE;
                showPopup("BLOCKED!", INFO[ORB_SHIELD].color);
                audio.eatingFruit.play();
                return true;
            }
            return graceFrames > 0;
        },

        // Returns the number of steps Pac-Man should take this frame if a speed effect
        // is active, otherwise undefined (so the normal speed table is used).
        getNumSteps: function(frames) {
            if (speedType == ORB_SPEED_UP)
                return SPEED_UP_STEPS;
            if (speedType == ORB_SLOW_DOWN)
                return SLOW_DOWN_STEPS[frames % SLOW_DOWN_STEPS.length];
            return undefined;
        },

        // Helpline easter egg: put 'count' ghost-bugs on the map for 'seconds' seconds
        spawnSwarm: function(count, seconds) {
            startViruses(count, seconds*FPS, "bugs");
        },

        // advance the viruses by one movement step (called from playState.update, like actors)
        updateViruses: function(j) {
            if (virusFrames <= 0) return;
            var i;
            for (i=0; i<virusCount; i++)
                if (virusOnMap(viruses[i]))
                    viruses[i].update(j);
        },

        // true if an armed virus is on Pac-Man's tile
        virusTouchesPacman: function() {
            if (virusFrames <= 0) return false;
            var i, v;
            for (i=0; i<virusCount; i++) {
                v = viruses[i];
                if (virusOnMap(v) && virusArmed(v) && v.tile.x == pacman.tile.x && v.tile.y == pacman.tile.y)
                    return true;
            }
            return false;
        },

        // durations (in seconds) and colors, so the on-screen legend always matches the game
        getLegendInfo: function() {
            return {
                shieldSec:  SHIELD_DURATION/FPS,
                speedSec:   SPEED_UP_DURATION/FPS,
                slowSec:    SLOW_DOWN_DURATION/FPS,
                virusSec:   VIRUS_DURATION/FPS,
                orbSec:     ORB_LIFETIME/FPS,
                colors: {
                    shield: INFO[ORB_SHIELD].color,
                    speed:  INFO[ORB_SPEED_UP].color,
                    slow:   INFO[ORB_SLOW_DOWN].color,
                    fork:   INFO[ORB_FORK_BOMB].color,
                },
            };
        },

        isShielded: function() { return shieldFrames > 0; },
        getOrbs: function() { return orbs; },

        ////////////////////////////////////////////////////////////////////////////
        // VCR support

        save: function(t) {
            var copy = [];
            var i, o;
            for (i=0; i<orbs.length; i++) {
                o = orbs[i];
                copy.push({x:o.x, y:o.y, type:o.type, framesLeft:o.framesLeft});
            }
            saved[t] = {
                orbs: copy,
                spawnTimer: spawnTimer,
                shieldFrames: shieldFrames,
                graceFrames: graceFrames,
                speedType: speedType,
                speedFrames: speedFrames,
                speedTotal: speedTotal,
                tick: tick,
                popupText: popupText,
                popupColor: popupColor,
                popupX: popupX,
                popupY: popupY,
                popupFrames: popupFrames,
                virusFrames: virusFrames,
                virusCount: virusCount,
                virusStyle: virusStyle,
            };
            if (virusFrames > 0) {
                for (i=0; i<virusCount; i++) {
                    viruses[i].save(t);
                    viruses[i].savedAge[t] = viruses[i].age;
                }
            }
        },

        load: function(t) {
            var s = saved[t];
            if (!s) return;
            var i, o;
            orbs = [];
            for (i=0; i<s.orbs.length; i++) {
                o = s.orbs[i];
                orbs.push({x:o.x, y:o.y, type:o.type, framesLeft:o.framesLeft});
            }
            spawnTimer = s.spawnTimer;
            shieldFrames = s.shieldFrames;
            graceFrames = s.graceFrames;
            speedType = s.speedType;
            speedFrames = s.speedFrames;
            speedTotal = s.speedTotal;
            tick = s.tick;
            popupText = s.popupText;
            popupColor = s.popupColor;
            popupX = s.popupX;
            popupY = s.popupY;
            popupFrames = s.popupFrames;
            virusFrames = s.virusFrames;
            virusCount = s.virusCount;
            virusStyle = s.virusStyle;
            if (virusFrames > 0) {
                for (i=0; i<virusCount; i++) {
                    viruses[i].load(t);
                    viruses[i].age = viruses[i].savedAge[t];
                }
            }
        },

        ////////////////////////////////////////////////////////////////////////////
        // Drawing (each takes the canvas context to draw on, in map coordinates)

        // draw the orbs sitting on the map
        drawOrbs: function(ctx) {
            var i, o, info, g;
            var cx, cy, pulse;
            for (i=0; i<orbs.length; i++) {
                o = orbs[i];

                // blink just before disappearing
                if (o.framesLeft < ORB_BLINK_TIME && Math.floor(o.framesLeft/8) % 2 == 0)
                    continue;

                info = INFO[o.type];
                cx = o.x*tileSize + midTile.x + 0.5; // same center as the pellet underneath
                cy = o.y*tileSize + midTile.y;
                pulse = 0.5 + 0.5*Math.sin(tick*0.15 + o.x + o.y);

                ctx.save();

                // black backing to hide the pellet
                ctx.fillStyle = "#000";
                ctx.beginPath();
                ctx.arc(cx, cy, 3.6, 0, Math.PI*2);
                ctx.fill();

                // pulsing glow ring
                ctx.globalAlpha = 0.3 + 0.4*pulse;
                ctx.strokeStyle = info.color;
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.arc(cx, cy, 3.7 + 0.5*pulse, 0, Math.PI*2);
                ctx.stroke();
                ctx.globalAlpha = 1;

                // orb body
                g = ctx.createRadialGradient(cx-1, cy-1, 0.2, cx, cy, 3.2);
                g.addColorStop(0, "#fff");
                g.addColorStop(0.4, info.color);
                g.addColorStop(1, info.dark);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(cx, cy, 3.2, 0, Math.PI*2);
                ctx.fill();

                // icon
                ctx.fillStyle = "#fff";
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 0.7;
                ctx.lineJoin = "round";
                ctx.beginPath();
                if (o.type == ORB_SHIELD) {
                    ctx.moveTo(cx-1.3, cy-1.3);
                    ctx.lineTo(cx+1.3, cy-1.3);
                    ctx.lineTo(cx+1.3, cy+0.3);
                    ctx.lineTo(cx,     cy+1.6);
                    ctx.lineTo(cx-1.3, cy+0.3);
                    ctx.closePath();
                    ctx.fill();
                }
                else if (o.type == ORB_SPEED_UP) {
                    ctx.moveTo(cx-1.6, cy-1.3);
                    ctx.lineTo(cx-0.3, cy);
                    ctx.lineTo(cx-1.6, cy+1.3);
                    ctx.moveTo(cx+0.2, cy-1.3);
                    ctx.lineTo(cx+1.5, cy);
                    ctx.lineTo(cx+0.2, cy+1.3);
                    ctx.stroke();
                }
                else if (o.type == ORB_FORK_BOMB) { // virus: body + spikes
                    var k, ang;
                    for (k=0; k<8; k++) {
                        ang = k*Math.PI/4;
                        ctx.moveTo(cx + 1.0*Math.cos(ang), cy + 1.0*Math.sin(ang));
                        ctx.lineTo(cx + 1.9*Math.cos(ang), cy + 1.9*Math.sin(ang));
                    }
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(cx, cy, 1.1, 0, Math.PI*2);
                    ctx.fill();
                }
                else { // slow down: hourglass
                    ctx.moveTo(cx-1.4, cy-1.5);
                    ctx.lineTo(cx+1.4, cy-1.5);
                    ctx.lineTo(cx,     cy);
                    ctx.closePath();
                    ctx.moveTo(cx-1.4, cy+1.5);
                    ctx.lineTo(cx+1.4, cy+1.5);
                    ctx.lineTo(cx,     cy);
                    ctx.closePath();
                    ctx.fill();
                }

                ctx.restore();
            }
        },

        // draw the FORK BOMB viruses (called right after the regular actors)
        drawViruses: function(ctx) {
            if (virusFrames <= 0) return;
            var i, v, alpha, frame;
            for (i=0; i<virusCount; i++) {
                v = viruses[i];
                if (!virusOnMap(v)) continue;
                alpha = 1;
                if (!virusArmed(v))                 // just spawned: flicker, harmless
                    alpha = (Math.floor(v.age/4) % 2 == 0) ? 0.25 : 0.6;
                else if (virusFrames < VIRUS_FADE_TIME) // about to vanish: flicker
                    alpha = (Math.floor(virusFrames/5) % 2 == 0) ? 0.25 : 1;
                frame = Math.floor(v.frames/8) % 2;
                if (virusStyle == "bugs") {
                    ctx.save();
                    ctx.globalAlpha = ctx.globalAlpha * alpha;
                    ctx.translate(v.pixel.x-7, v.pixel.y-7);
                    if (!customSprites.drawGhostBody(ctx, 7, 7, frame, v.faceDirEnum, false, false, BUG_COLORS[i%4])) {
                        ctx.restore();
                        customSprites.drawVirus(ctx, v.pixel.x, v.pixel.y, frame, alpha);
                        continue;
                    }
                    ctx.restore();
                }
                else
                    customSprites.drawVirus(ctx, v.pixel.x, v.pixel.y, frame, alpha);
            }
        },

        // draw timer rings around Pac-Man for the active effects
        drawAuras: function(ctx) {
            if (shieldFrames <= 0 && speedFrames <= 0 && graceFrames <= 0)
                return;

            var x = pacman.pixel.x + 0.5;
            var y = pacman.pixel.y;
            var start = -Math.PI/2;

            var ring = function(r, frac, color) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                // faint full track
                ctx.globalAlpha = 0.2;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI*2);
                ctx.stroke();
                // remaining time
                ctx.globalAlpha = 0.95;
                ctx.beginPath();
                ctx.arc(x, y, r, start, start + Math.PI*2*frac);
                ctx.stroke();
            };

            ctx.save();
            var r = 9.5;
            if (shieldFrames > 0) {
                ring(r, shieldFrames/SHIELD_DURATION, INFO[ORB_SHIELD].color);
                r += 2;
            }
            if (graceFrames > 0 && Math.floor(graceFrames/5) % 2 == 0) {
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.arc(x, y, 9.5, 0, Math.PI*2);
                ctx.stroke();
            }
            if (speedFrames > 0) {
                ring(r, speedFrames/speedTotal, INFO[speedType].color);
            }
            ctx.restore();
        },

        // draw the active-effect labels (top right) and the floating pickup text
        drawHud: function(ctx) {
            ctx.save();
            ctx.font = "6px ArcadeR";
            ctx.textBaseline = "top";

            // active effects: one centered line in the gap between the score header and the
            // maze, e.g.  SHIELD 4   O(N) 6   FORK BOMB 9
            var chips = [];
            if (shieldFrames > 0)
                chips.push({ t: INFO[ORB_SHIELD].hud + " " + Math.ceil(shieldFrames/FPS), c: INFO[ORB_SHIELD].color });
            if (speedFrames > 0)
                chips.push({ t: INFO[speedType].hud + " " + Math.ceil(speedFrames/FPS), c: INFO[speedType].color });
            if (virusFrames > 0)
                chips.push({
                    t: (virusStyle == "bugs" ? virusCount + " GHOSTS" : INFO[ORB_FORK_BOMB].hud) + " " + Math.ceil(virusFrames/FPS),
                    c: (virusStyle == "bugs" ? "#ff3d3d" : INFO[ORB_FORK_BOMB].color) });
            if (chips.length > 0) {
                var gap = 8, total = -gap, i;
                for (i=0; i<chips.length; i++) {
                    chips[i].w = ctx.measureText(chips[i].t).width;
                    total += chips[i].w + gap;
                }
                var x = map.numCols*tileSize/2 - total/2;
                ctx.textAlign = "left";
                for (i=0; i<chips.length; i++) {
                    ctx.fillStyle = chips[i].c;
                    ctx.fillText(chips[i].t, x, 17.5);
                    x += chips[i].w + gap;
                }
            }

            // floating pickup text
            if (popupFrames > 0) {
                var w = ctx.measureText(popupText).width;
                var px = Math.max(w/2+2, Math.min(map.numCols*tileSize - w/2 - 2, popupX));
                var py = popupY - (POPUP_DURATION-popupFrames)*0.12;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.globalAlpha = Math.min(1, popupFrames/30);
                ctx.lineWidth = 2;
                ctx.lineJoin = "round";
                ctx.strokeStyle = "#000";
                ctx.strokeText(popupText, px, py);
                ctx.fillStyle = popupColor;
                ctx.fillText(popupText, px, py);
            }
            ctx.restore();
        },
    };
})();

powerups.reset();
