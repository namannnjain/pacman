//////////////////////////////////////////////////////////////////////////////////////
// Local leaderboard + nickname prompt
//
// - Before a normal game (PLAY / PLAY TURBO) the player is asked for a nickname.
// - When that game ends (game over, or QUIT from the pause menu) the score is saved.
// - The top scores are kept in this browser's localStorage and shown on the
//   LEADERBOARD screen (home screen).
//
// Practice mode never touches the leaderboard.
// To wipe the board, run  clearLeaderboard()  in the browser console.

var playerName = "";

var leaderboard = (function() {

    var KEY = "pacmanLeaderboard";
    var NAME_KEY = "pacmanNickname";
    var MAX_ENTRIES = 10;
    var NAME_LEN = 10;

    var gameActive = false;   // a leaderboard game is in progress (not yet saved)
    var latest = null;        // the entry saved most recently (highlighted on the board)

    var read = function() {
        try {
            var a = JSON.parse(localStorage.getItem(KEY) || "[]");
            return Array.isArray(a) ? a : [];
        } catch (e) { return []; }
    };
    var write = function(a) {
        try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {}
    };

    var clean = function(n) {
        n = String(n || "").toUpperCase().replace(/[^A-Z0-9 _.\-]/g, "").replace(/\s+/g, " ").trim();
        return n.slice(0, NAME_LEN).trim();
    };

    var api = {
        NAME_LEN: NAME_LEN,
        MAX_ENTRIES: MAX_ENTRIES,
        clean: clean,

        getSavedName: function() {
            try { return clean(localStorage.getItem(NAME_KEY)); } catch (e) { return ""; }
        },

        // a new leaderboard game starts under this nickname
        beginGame: function(name) {
            playerName = clean(name) || "PLAYER";
            try { localStorage.setItem(NAME_KEY, playerName); } catch (e) {}
            gameActive = true;
            latest = null;
        },

        // the current game is over: save its score (once)
        submitGame: function() {
            if (!gameActive) return;
            gameActive = false;
            if (practiceMode) return;
            var score = getScore();
            if (!(score > 0)) return;
            var entry = { name: playerName || "PLAYER", score: score, turbo: !!turboMode, t: Date.now() };
            var list = read();
            list.push(entry);
            // highest first; on a tie the older score stays ahead
            list.sort(function(a, b) { return (b.score - a.score) || (a.t - b.t); });
            list = list.slice(0, MAX_ENTRIES);
            write(list);
            latest = (list.indexOf(entry) >= 0) ? entry : null;
        },

        isPlaying: function() { return gameActive; },
        getEntries: function() { return read(); },
        isLatest: function(e) { return !!latest && e.t == latest.t && e.score == latest.score && e.name == latest.name; },
        clear: function() { write([]); latest = null; },
    };
    return api;
})();

if (typeof window != "undefined") {
    window.clearLeaderboard = function() { leaderboard.clear(); };
}

//////////////////////////////////////////////////////////////////////////////////////
// Live top-10 panel, shown to the right of the maze while a game is being played

var leaderboardPanel = (function() {

    var WIDTH = 236;          // css pixels
    var MIN_WIDTH = 180;      // the panel narrows to this before it hides // free space needed right of the maze, otherwise the panel stays hidden
    var panel = null, timer = 0, wanted = false;
    var COLORS = ["#ffd24a", "#d0d0d0", "#cd7f32"];

    var CSS = [
        "#lbpanel{position:fixed;top:50%;width:" + WIDTH + "px;box-sizing:border-box;transform:translateY(-50%);",
        "  z-index:5;display:none;user-select:none;-webkit-user-select:none;font-family:ArcadeR,monospace;",
        "  color:#fff;background:#000;padding:12px 12px 10px;image-rendering:pixelated;line-height:1;",
        "  box-shadow:0 -3px 0 0 #00ff00,0 3px 0 0 #00ff00,-3px 0 0 0 #00ff00,3px 0 0 0 #00ff00,",
        "             inset 0 0 0 3px #000,inset 0 0 0 5px #00b300;}",
        "#lbpanel .lb-title{color:#ffff00;font-size:13px;letter-spacing:1px;}",
        "#lbpanel .lb-sub{color:#00ffff;font-size:8px;margin-top:5px;}",
        "#lbpanel .lb-dots{height:4px;margin:8px 0;opacity:.9;",
        "  background:repeating-linear-gradient(90deg,#ffb8ae 0 4px,transparent 4px 12px);}",
        "#lbpanel .lb-row{display:flex;font-size:9px;margin:0 0 7px;white-space:nowrap;}",
        "#lbpanel .lb-rank{flex:0 0 26px;text-align:right;padding-right:8px;}",
        "#lbpanel .lb-name{flex:1;min-width:0;overflow:hidden;}",
        "#lbpanel .lb-score{flex:0 0 auto;text-align:right;padding-left:6px;}",
        "#lbpanel .lb-you{color:#00ffff;margin:0;}",
    ].join("\n");

    var esc = function(t) {
        return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };

    var render = function() {
        var list = leaderboard.getEntries(), html = "", i, e, c, empty;
        html += '<div class="lb-title">TOP 10</div><div class="lb-sub">LEADERBOARD</div><div class="lb-dots"></div>';
        for (i=0; i<leaderboard.MAX_ENTRIES; i++) {
            e = list[i];
            empty = !e;
            c = empty ? "#444" : (COLORS[i] || "#fff");
            html += '<div class="lb-row" style="color:' + c + '">' +
                '<span class="lb-rank">' + (i+1) + '.</span>' +
                '<span class="lb-name">' + (empty ? "---" : esc(e.name)) + '</span>' +
                '<span class="lb-score">' + (empty ? "" : e.score) + '</span></div>';
        }
        // the running game of the current player
        if (leaderboard.isPlaying() && !practiceMode) {
            html += '<div class="lb-dots"></div><div class="lb-row lb-you"><span class="lb-rank"></span>' +
                '<span class="lb-name">' + esc(playerName) + '</span>' +
                '<span class="lb-score">' + getScore() + '</span></div>';
        }
        return html;
    };

    var place = function() {
        if (!panel) return;
        var gc = document.getElementById("canvas");
        var show = wanted && gc && window.innerWidth >= 780;
        if (show) {
            var r = gc.getBoundingClientRect();
            // right edge of the maze itself (the canvas has empty margin beyond it)
            var mazeRight = (r.left + r.right)/2 + (mapWidth/2) * (r.width/screenWidth);
            var gap = window.innerWidth - mazeRight;
            var w = Math.min(WIDTH, Math.floor(gap - 24));
            if (w < MIN_WIDTH) {
                show = false;
            } else {
                panel.style.width = w + "px";
                panel.style.left = Math.round(mazeRight + Math.min(30, (gap - w)/2)) + "px";
            }
        }
        panel.style.display = show ? "block" : "none";
    };

    var refresh = function() {
        if (!panel) return;
        var html = render();
        if (html != panel.getAttribute("data-html")) {
            panel.setAttribute("data-html", html);
            panel.innerHTML = html;
        }
        place();
    };

    var build = function() {
        if (panel || typeof document == "undefined") return;
        var st = document.createElement("style");
        st.textContent = CSS;
        document.head.appendChild(st);
        panel = document.createElement("div");
        panel.id = "lbpanel";
        document.body.appendChild(panel);
        window.addEventListener("resize", place, false);
    };

    return {
        show: function() {
            build();
            wanted = true;
            refresh();
            if (!timer) timer = setInterval(refresh, 400);
        },
        hide: function() {
            wanted = false;
            if (timer) { clearInterval(timer); timer = 0; }
            if (panel) panel.style.display = "none";
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Nickname state (a small DOM prompt on top of the black game screen)

var nicknameState = (function() {

    var panel = null, input = null, active = false;

    var CSS = [
        "#nick{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;display:none;",
        "  width:300px;box-sizing:border-box;padding:22px 20px 18px;background:#000;color:#fff;text-align:center;",
        "  font-family:ArcadeR,monospace;image-rendering:pixelated;line-height:1;",
        "  box-shadow:0 -3px 0 0 #00ff00,0 3px 0 0 #00ff00,-3px 0 0 0 #00ff00,3px 0 0 0 #00ff00,",
        "             inset 0 0 0 3px #000,inset 0 0 0 5px #00b300;}",
        "#nick .nk-title{color:#ffff00;font-size:14px;letter-spacing:1px;margin-bottom:16px;}",
        "#nick input{width:100%;box-sizing:border-box;background:#000;color:#fff;border:2px solid #2121ff;",
        "  font-family:ArcadeR,monospace;font-size:16px;text-align:center;text-transform:uppercase;",
        "  letter-spacing:2px;padding:10px 6px;outline:none;caret-color:#ffff00;}",
        "#nick input:focus{border-color:#00ffff;}",
        "#nick .nk-btns{display:flex;gap:10px;margin-top:16px;}",
        "#nick button{flex:1;background:#000;color:#fff;border:2px solid #2121ff;cursor:pointer;",
        "  font-family:ArcadeR,monospace;font-size:11px;padding:10px 4px;}",
        "#nick button:hover,#nick button:focus{border-color:#ffff00;color:#ffff00;outline:none;}",
        "#nick .nk-hint{color:#c8c8c8;font-size:7px;line-height:1.7;margin-top:14px;}",
        "#nick .nk-hint span{color:#ffb8ae;}",
    ].join("\n");

    var build = function() {
        if (panel || typeof document == "undefined") return;
        var st = document.createElement("style");
        st.textContent = CSS;
        document.head.appendChild(st);

        panel = document.createElement("div");
        panel.id = "nick";
        panel.innerHTML =
            '<div class="nk-title">ENTER NICKNAME</div>' +
            '<input type="text" maxlength="' + leaderboard.NAME_LEN + '" spellcheck="false" autocomplete="off" placeholder="PLAYER">' +
            '<div class="nk-btns"><button type="button" class="nk-back">BACK</button>' +
            '<button type="button" class="nk-go">START</button></div>' +
            '<div class="nk-hint"><span>ENTER</span> START &nbsp; <span>ESC</span> BACK</div>';
        document.body.appendChild(panel);
        input = panel.querySelector("input");

        // keep typing away from the game's own key handling
        var stop = function(e) { e.stopPropagation(); };
        input.addEventListener("keyup", stop, false);
        input.addEventListener("keypress", stop, false);
        input.addEventListener("keydown", function(e) {
            e.stopPropagation();
            if (e.keyCode == 13) { e.preventDefault(); go(); }
            else if (e.keyCode == 27) { e.preventDefault(); back(); }
        }, false);
        input.addEventListener("input", function() {
            var v = input.value.toUpperCase().replace(/[^A-Z0-9 _.\-]/g, "");
            if (v != input.value) input.value = v;
        }, false);
        // keep the focus so no key ever reaches the game while the prompt is up
        input.addEventListener("blur", function() {
            if (active) setTimeout(function() { if (active) input.focus(); }, 0);
        }, false);
        panel.querySelector(".nk-go").addEventListener("click", go, false);
        panel.querySelector(".nk-back").addEventListener("click", back, false);
        panel.querySelector(".nk-go").addEventListener("keydown", stop, false);
        panel.querySelector(".nk-back").addEventListener("keydown", stop, false);
    };

    var hide = function() {
        active = false;
        if (panel) panel.style.display = "none";
        if (input) input.blur();
    };

    var go = function() {
        if (!active) return;
        var name = leaderboard.clean(input.value) || "PLAYER";
        hide();
        leaderboard.beginGame(name);
        switchState(newGameState, 60);
    };

    var back = function() {
        if (!active) return;
        hide();
        switchState(preNewGameState);
    };

    return {
        init: function() {
            build();
            if (!panel) { // no DOM: skip the prompt
                leaderboard.beginGame(leaderboard.getSavedName() || "PLAYER");
                switchState(newGameState, 60);
                return;
            }
            input.value = leaderboard.getSavedName();
            panel.style.display = "block";
            active = true;
            input.focus();
            input.select();
        },
        draw: function() {
            renderer.clearMapFrame();
        },
        update: function() {},
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Leaderboard state (list of the best scores on this browser)

var leaderboardState = (function() {

    var exitTo = function(s, fade) {
        menu.disable();
        switchState(s, fade);
    };

    var menu = new Menu("", 2*tileSize, 0, mapWidth-4*tileSize, 3*tileSize, tileSize, tileSize+"px ArcadeR", "#EEE");
    menu.addSpacer(8);
    menu.addTextButton("BACK", function() { exitTo(homeState); });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    var COLORS = ["#ffd24a", "#d0d0d0", "#cd7f32"];
    var frames = 0;

    var drawBoard = function(ctx) {
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        ctx.font = (tileSize*1.5) + "px ArcadeR";
        ctx.fillStyle = "#ffff00";
        ctx.fillText("LEADERBOARD", mapWidth/2, 2*tileSize);

        var list = leaderboard.getEntries();
        ctx.font = tileSize + "px ArcadeR";
        if (list.length == 0) {
            ctx.fillStyle = "#c8c8c8";
            ctx.fillText("NO SCORES YET", mapWidth/2, 12*tileSize);
            ctx.fillText("BE THE FIRST!", mapWidth/2, 14*tileSize);
            return;
        }
        var i, e, y, color;
        for (i=0; i<list.length; i++) {
            e = list[i];
            y = (5 + i*2.4) * tileSize;
            color = COLORS[i] || "#ffffff";
            if (leaderboard.isLatest(e) && Math.floor(frames/20)%2 == 0) color = "#00ffff";
            ctx.fillStyle = color;
            ctx.textAlign = "right";
            ctx.fillText(String(i+1) + ".", 5*tileSize, y);
            ctx.textAlign = "left";
            ctx.fillText(e.name + (e.turbo ? " T" : ""), 6*tileSize, y);
            ctx.textAlign = "right";
            ctx.fillText(String(e.score), mapWidth - 3*tileSize, y);
        }
    };

    return {
        init: function() {
            frames = 0;
            menu.enable();
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw, menu);
            renderer.renderFunc(drawBoard);
        },
        update: function() { frames++; },
        getMenu: function() { return menu; },
    };
})();
