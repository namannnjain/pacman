//////////////////////////////////////////////////////////////////////////////////////
// Hash-map legend
//
// A pixel-art panel on the left side of the screen that explains the buffs, the
// debuffs and the other mechanics, laid out like the buckets of a hash map:
//
//     [bucket index]  [icon]  "KEY"  ->  value
//
// It is plain DOM (not part of the game canvas), styled with the arcade font, a
// maze-green double border and pixel-art icons.  Durations are read from the
// powerups module so the text can never disagree with the game.

var legend = (function() {

    var PANEL_WIDTH = 292;    // css pixels, before any shrinking to fit a short window
    var MIN_WINDOW_WIDTH = 780; // narrower windows hide the legend and give the maze all the room

    var panel = null;
    var fit = 1;              // shrink factor so the panel fits in the window height
    var hidden = false;

    ////////////////////////////////////////////////////////////////////////////////
    // Pixel icons

    // draw a pixel grid ('.' = empty, other chars looked up in 'palette') into a canvas
    var gridCanvas = function(rows, palette, cssSize) {
        var h = rows.length, w = rows[0].length, x, y, c;
        var cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        cv.className = "lg-icon";
        cv.style.width = (w*cssSize) + "px";
        cv.style.height = (h*cssSize) + "px";
        var cx = cv.getContext("2d");
        for (y=0; y<h; y++) {
            for (x=0; x<w; x++) {
                c = palette[rows[y].charAt(x)];
                if (c) {
                    cx.fillStyle = c;
                    cx.fillRect(x, y, 1, 1);
                }
            }
        }
        return cv;
    };

    // 9x9 round orb with a white symbol, like the orbs on the maze
    var SYMBOLS = {
        shield: ["..XXXXX..", "..XXXXX..", "..XXXXX..", "..XXXXX..", "...XXX...", "....X...."],
        speed:  ["..X.X..", "...X.X.", "....X.X", "...X.X.", "..X.X.."],
        slow:   ["XXXXX", ".XXX.", "..X..", ".XXX.", "XXXXX"],
        fork:   ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."],
    };
    // top-left corner of each symbol inside the 9x9 orb
    var SYMBOL_POS = {
        shield: [0,1],
        speed:  [1,2],
        slow:   [2,2],
        fork:   [2,2],
    };

    var orbIcon = function(kind, color, dark) {
        var N = 9, y, x, d, row, rows = [];
        for (y=0; y<N; y++) {
            row = "";
            for (x=0; x<N; x++) {
                d = Math.sqrt((x-4)*(x-4) + (y-4)*(y-4));
                row += (d > 4.3) ? "." : (d > 3.3 ? "d" : "o");
            }
            rows.push(row.split(""));
        }
        var sym = SYMBOLS[kind], pos = SYMBOL_POS[kind], sy, sx, ch;
        for (sy=0; sy<sym.length; sy++) {
            for (sx=0; sx<sym[sy].length; sx++) {
                ch = sym[sy].charAt(sx);
                if (ch == "X") {
                    y = pos[1] + sy - (kind == "shield" ? 1 : 0);
                    x = pos[0] + sx;
                    if (y >= 0 && y < N && x >= 0 && x < N)
                        rows[y][x] = "w";
                }
            }
        }
        rows = rows.map(function(r){ return r.join(""); });
        return gridCanvas(rows, { o:color, d:dark, w:"#ffffff" }, 3);
    };

    // plain dot (pellet / energizer)
    var dotIcon = function(big) {
        var rows = big ? [
            "..WWWW..",
            ".WWWWWW.",
            "WWWWWWWW",
            "WWWWWWWW",
            "WWWWWWWW",
            "WWWWWWWW",
            ".WWWWWW.",
            "..WWWW..",
        ] : [
            "....",
            ".PP.",
            ".PP.",
            "....",
        ];
        return gridCanvas(rows, { W:"#ffffff", P:"#ffb8ae" }, big ? 3 : 4);
    };

    // downscale one of the custom sprites into a chunky pixel icon with hard edges
    var spriteIcon = function(key, size, cssSize) {
        var im = customSprites.getImage(key);
        var cv = document.createElement("canvas");
        cv.width = cv.height = size;
        cv.className = "lg-icon";
        cv.style.width = cv.style.height = (size*cssSize) + "px";
        if (!im) return cv;
        var cx = cv.getContext("2d");
        var s = size / Math.max(im.width, im.height);
        cx.imageSmoothingEnabled = true;
        if ("imageSmoothingQuality" in cx) cx.imageSmoothingQuality = "high";
        cx.drawImage(im, (size-im.width*s)/2, (size-im.height*s)/2, im.width*s, im.height*s);
        // snap every pixel to fully opaque or fully transparent (no soft edges)
        var data = cx.getImageData(0, 0, size, size);
        var i;
        for (i=0; i<data.data.length; i+=4)
            data.data[i+3] = data.data[i+3] > 110 ? 255 : 0;
        cx.putImageData(data, 0, 0);
        return cv;
    };

    ////////////////////////////////////////////////////////////////////////////////
    // Panel construction

    var CSS = [
        "#legend{position:fixed;left:10px;top:50%;width:" + PANEL_WIDTH + "px;box-sizing:border-box;",
        "  transform-origin:0 50%;z-index:5;user-select:none;-webkit-user-select:none;",
        "  font-family:ArcadeR,monospace;color:#fff;background:#000;padding:12px 12px 10px;",
        "  image-rendering:pixelated;line-height:1;",
        "  /* notched pixel corners + maze-style double line */",
        "  box-shadow:0 -3px 0 0 #00ff00,0 3px 0 0 #00ff00,-3px 0 0 0 #00ff00,3px 0 0 0 #00ff00,",
        "             inset 0 0 0 3px #000,inset 0 0 0 5px #00b300;}",
        "#legend .lg-icon{image-rendering:pixelated;image-rendering:crisp-edges;image-rendering:pixelated;display:block;}",
        "#legend .lg-title{display:flex;align-items:center;gap:10px;margin-bottom:6px;}",
        "#legend .lg-title b{display:block;color:#ffff00;font-weight:normal;font-size:13px;letter-spacing:1px;}",
        "#legend .lg-title i{display:block;font-style:normal;color:#00ffff;font-size:8px;margin-top:5px;}",
        "#legend .lg-dots{height:4px;margin:7px 0 8px;opacity:.9;",
        "  background:repeating-linear-gradient(90deg,#ffb8ae 0 4px,transparent 4px 12px);}",
        "#legend .lg-sec{font-size:8px;margin:9px 0 6px;letter-spacing:1px;}",
        "#legend .lg-row{display:flex;align-items:center;gap:8px;margin:0 0 6px;}",
        "#legend .lg-idx{flex:0 0 auto;width:18px;height:18px;box-sizing:border-box;border:2px solid #2121ff;",
        "  color:#2121ff;font-size:8px;display:flex;align-items:center;justify-content:center;}",
        "#legend .lg-ico{flex:0 0 28px;display:flex;align-items:center;justify-content:center;}",
        "#legend .lg-txt{flex:1;min-width:0;}",
        "#legend .lg-key{font-size:9px;margin-bottom:4px;white-space:nowrap;}",
        "#legend .lg-val{font-size:7px;color:#c8c8c8;line-height:1.5;}",
        "#legend .lg-val em{font-style:normal;color:#ffff00;}",
        "#legend .lg-foot{font-size:7px;color:#c8c8c8;line-height:1.7;}",
        "#legend .lg-foot span{color:#ffb8ae;}",
    ].join("\n");

    var el = function(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != undefined) e.innerHTML = html;
        return e;
    };

    var row = function(idx, icon, keyText, keyColor, valueHtml) {
        var r = el("div", "lg-row");
        r.appendChild(el("div", "lg-idx", idx));
        var ico = el("div", "lg-ico");
        ico.appendChild(icon);
        r.appendChild(ico);
        var t = el("div", "lg-txt");
        var k = el("div", "lg-key", '"' + keyText + '"');
        k.style.color = keyColor;
        t.appendChild(k);
        t.appendChild(el("div", "lg-val", valueHtml));
        r.appendChild(t);
        return r;
    };

    var section = function(text, color) {
        var s = el("div", "lg-sec", "// " + text);
        s.style.color = color;
        return s;
    };

    var build = function() {
        var info = powerups.getLegendInfo();
        var c = info.colors;

        var style = el("style", null, CSS);
        document.head.appendChild(style);

        panel = el("div");
        panel.id = "legend";

        // title
        var title = el("div", "lg-title");
        title.appendChild(spriteIcon("pac1", 17, 2));
        var tt = el("div");
        tt.appendChild(el("b", null, "HASH MAP"));
        tt.appendChild(el("i", null, "MAP&lt;KEY, EFFECT&gt;"));
        title.appendChild(tt);
        panel.appendChild(title);
        panel.appendChild(el("div", "lg-dots"));

        // buffs
        panel.appendChild(section("BUFFS", "#00ff66"));
        panel.appendChild(row("0", orbIcon("speed", c.speed, "#00805a"), "O(N)", c.speed,
            "SPEED UP <em>" + info.speedSec + "s</em>"));
        panel.appendChild(row("1", orbIcon("shield", c.shield, "#1b4fa8"), "STACK SHIELD", c.shield,
            "BLOCKS 1 HIT, <em>" + info.shieldSec + "s</em>"));

        // debuffs
        panel.appendChild(section("DEBUFFS", "#ff3d3d"));
        panel.appendChild(row("2", orbIcon("slow", c.slow, "#8f1240"), "O(N^2)", c.slow,
            "SLOWED DOWN <em>" + info.slowSec + "s</em>"));
        panel.appendChild(row("3", orbIcon("fork", c.fork, "#5a1f8f"), "FORK BOMB", c.fork,
            "+2 VIRUSES CHASE YOU <em>" + info.virusSec + "s</em>"));

        // mechanics
        panel.appendChild(section("MECHANICS", "#00ffff"));
        panel.appendChild(row("4", dotIcon(false), "PELLET", "#ffb8ae",
            "<em>+10</em> EAT THEM ALL TO CLEAR THE LEVEL"));
        panel.appendChild(row("5", dotIcon(true), "ENERGIZER", "#ffffff",
            "BUGS TURN BLUE: EAT THEM FOR <em>PTS</em>"));
        panel.appendChild(row("6", spriteIcon("blinky", 14, 2), "BUG", "#ff6b6b",
            "TOUCH ONE AND YOU LOSE A LIFE"));
        panel.appendChild(row("7", spriteIcon("virus", 14, 2), "VIRUS", "#7cfc00",
            "CAN'T BE EATEN. RUN OR SHIELD"));
        panel.appendChild(row("8", orbIcon("fork", "#888", "#444"), "ORB", "#ffffff",
            "HIDES ON A PELLET, VANISHES IN <em>" + info.orbSec + "s</em>"));

        panel.appendChild(el("div", "lg-dots"));
        panel.appendChild(el("div", "lg-foot",
            "<span>ARROWS</span> MOVE &nbsp; <span>ESC</span> MENU<br><span>END</span> PAUSE"));

        document.body.appendChild(panel);
    };

    ////////////////////////////////////////////////////////////////////////////////
    // Layout

    var isShown = function() {
        return panel && !hidden && window.innerWidth >= MIN_WINDOW_WIDTH;
    };

    // shrink the panel if the window is too short for it
    var layout = function() {
        if (!panel) return;
        panel.style.display = isShown() ? "block" : "none";
        if (!isShown()) return;
        panel.style.transform = "translateY(-50%)";
        var h = panel.offsetHeight;
        fit = Math.min(1, (window.innerHeight - 24) / h);
        panel.style.transform = "translateY(-50%) scale(" + fit + ")";
    };

    return {
        // build the panel (call once the custom sprites have loaded)
        init: function() {
            if (typeof document == "undefined") return;
            build();
            layout();
            window.addEventListener("resize", layout, false);
            // the arcade font changes the panel height once it has loaded
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(function() {
                    layout();
                    window.dispatchEvent(new Event("resize"));
                });
            }
        },

        // horizontal space (css pixels) the game should leave free on the left
        getReservedWidth: function() {
            return isShown() ? Math.ceil(PANEL_WIDTH*fit) + 24 : 0;
        },
    };
})();
