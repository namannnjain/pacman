
// Copyright 2012 Shaun Williams
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License Version 3 as 
//  published by the Free Software Foundation.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.

// ==========================================================================
// PAC-MAN
// an accurate remake of the original arcade game

// Based on original works by Namco, GCC, and Midway.
// Research by Jamey Pittman and Bart Grantham
// Developed by Shaun Williams, Mason Borda

// ==========================================================================

(function(){

//@line 1 "src/inherit.js"
//  Apparently, the mutable, non-standard __proto__ property creates a lot of complexity for JS optimizers,
//   so it may be phased out in future JS versions.  It's not even supported in Internet Explorer.
//
//  Object.create does everything that I would use a mutable __proto__ for, but this isn't implemented everywhere yet.
// 
//  So instead of the following:
//
//      var obj = {
//          __proto__: parentObj,
//          hello: function() { return "world"; },
//      };
//
//  You can use this:
//
//      var obj = newChildObject(parentObj, {
//          hello: function() { return "world"; },
//      };

var newChildObject = function(parentObj, newObj) {

    // equivalent to: var resultObj = { __proto__: parentObj };
    var x = function(){};
    x.prototype = parentObj;
    var resultObj = new x();

    // store new members in resultObj
    if (newObj) {
        var hasProp = {}.hasOwnProperty;
        for (var name in newObj) {
            if (hasProp.call(newObj, name)) {
                resultObj[name] = newObj[name];
            }
        }
    }

    return resultObj;
};

var DEBUG = false;
//@line 1 "src/sound.js"
/* Sound handlers added by Dr James Freeman who was sad such a great reverse was a silent movie  */

var audio = new preloadAudio();

function audioTrack(url, volume) {
    var audio = new Audio(url);
    if (volume) audio.volume = volume;
    audio.load();
    var looping = false;
    this.play = function(noResetTime) {
        playSound(noResetTime);
    };
    this.startLoop = function(noResetTime) {
        if (looping) return;
        audio.addEventListener('ended', audioLoop);
        audioLoop(noResetTime);
        looping = true;
    };
    this.stopLoop = function(noResetTime) {
        try{ audio.removeEventListener('ended', audioLoop) } catch (e) {};
        audio.pause();
        if (!noResetTime) audio.currentTime = 0;
        looping = false;
    };
    this.isPlaying = function() {
        return !audio.paused;
    };
    this.isPaused = function() {
        return audio.paused;
    }; 
    this.stop = this.stopLoop;

    function audioLoop(noResetTime) {
        playSound(noResetTime);
    }
    function playSound(noResetTime) {
        // for really rapid sound repeat set noResetTime
        if(!audio.paused) {
            audio.pause();
            if (!noResetTime ) audio.currentTime = 0;
        }
        try{
            var playPromise = audio.play();
            if(playPromise) {
                playPromise.then(function(){}).catch(function(err){});
            }
        } 
        catch(err){ console.error(err) }
    }
}


function preloadAudio() {

    this.credit            = new audioTrack('sounds/credit.mp3');
    this.coffeeBreakMusic  = new audioTrack('sounds/coffee-break-music.mp3');
    this.die               = new audioTrack('sounds/miss.mp3');
    this.ghostReturnToHome = new audioTrack('sounds/ghost-return-to-home.mp3');
    this.eatingGhost       = new audioTrack('sounds/eating-ghost.mp3');
    this.ghostTurnToBlue   = new audioTrack('sounds/ghost-turn-to-blue.mp3', 0.5);
    this.eatingFruit       = new audioTrack('sounds/eating-fruit.mp3');
    this.ghostSpurtMove1   = new audioTrack('sounds/ghost-spurt-move-1.mp3');
    this.ghostSpurtMove2   = new audioTrack('sounds/ghost-spurt-move-2.mp3');
    this.ghostSpurtMove3   = new audioTrack('sounds/ghost-spurt-move-3.mp3');
    this.ghostSpurtMove4   = new audioTrack('sounds/ghost-spurt-move-4.mp3');
    this.ghostNormalMove   = new audioTrack('sounds/ghost-normal-move.mp3');
    this.extend            = new audioTrack('sounds/extend.mp3');
    this.eating            = new audioTrack('sounds/eating.mp3', 0.5);
    this.startMusic        = new audioTrack('sounds/start-music.mp3');

    this.ghostReset = function(noResetTime) {
        for (var s in this) {
            if (s == 'silence' || s == 'ghostReset' ) return;
            if (s.match(/^ghost/)) this[s].stopLoop(noResetTime);
        }
    };

    this.silence = function(noResetTime) {
        for (var s in this) {
            if (s == 'silence' || s == 'ghostReset' ) return;
            this[s].stopLoop(noResetTime);
        }
    }
}
//@line 1 "src/random.js"

var getRandomColor = function() {
    return '#'+('00000'+(Math.random()*(1<<24)|0).toString(16)).slice(-6);
};

var getRandomInt = function(min,max) {
    return Math.floor(Math.random() * (max-min+1)) + min;
};

//@line 1 "src/game.js"
//////////////////////////////////////////////////////////////////////////////////////
// Game

// game modes
var GAME_PACMAN = 0;
var GAME_MSPACMAN = 1;
var GAME_COOKIE = 2;
var GAME_OTTO = 3;

var practiceMode = false;
var turboMode = false;

// current game mode
var gameMode = GAME_PACMAN;
var getGameName = (function(){

    var names = ["PAC-MAN", "MS PAC-MAN", "COOKIE-MAN","CRAZY OTTO"];
    
    return function(mode) {
        if (mode == undefined) {
            mode = gameMode;
        }
        return names[mode];
    };
})();

var getGameDescription = (function(){

    var desc = [
        [
            "ORIGINAL ARCADE:",
            "NAMCO (C) 1980",
            "",
            "REVERSE-ENGINEERING:",
            "JAMEY PITTMAN",
            "",
            "REMAKE:",
            "SHAUN WILLIAMS",
        ],
        [
            "ORIGINAL ARCADE ADDON:",
            "MIDWAY/GCC (C) 1981",
            "",
            "REVERSE-ENGINEERING:",
            "BART GRANTHAM",
            "",
            "REMAKE:",
            "SHAUN WILLIAMS",
        ],
        [
            "A NEW PAC-MAN GAME",
            "WITH RANDOM MAZES:",
            "SHAUN WILLIAMS (C) 2012",
            "",
            "COOKIE MONSTER DESIGN:",
            "JIM HENSON",
            "",
            "PAC-MAN CROSSOVER CONCEPT:",
            "TANG YONGFA",
        ],
        [
            "THE UNRELEASED",
            "MS. PAC-MAN PROTOTYPE:",
            "GCC (C) 1981",
            "",
            "SPRITES REFERENCED FROM",
            "STEVE GOLSON'S",
            "CAX 2012 PRESENTATION",
            "",
            "REMAKE:",
            "SHAUN WILLIAMS",
        ],
    ];
    
    return function(mode) {
        if (mode == undefined) {
            mode = gameMode;
        }
        return desc[mode];
    };
})();

var getGhostNames = function(mode) {
    if (mode == undefined) {
        mode = gameMode;
    }
    if (mode == GAME_OTTO) {
        return ["plato","darwin","freud","newton"];
    }
    else if (mode == GAME_MSPACMAN) {
        return ["blinky","pinky","inky","sue"];
    }
    else if (mode == GAME_PACMAN) {
        return ["blinky","pinky","inky","clyde"];
    }
    else if (mode == GAME_COOKIE) {
        return ["elmo","piggy","rosita","zoe"];
    }
};

var getGhostDrawFunc = function(mode) {
    if (mode == undefined) {
        mode = gameMode;
    }
    if (mode == GAME_OTTO) {
        return atlas.drawMonsterSprite;
    }
    else if (mode == GAME_COOKIE) {
        return atlas.drawMuppetSprite;
    }
    else {
        return atlas.drawGhostSprite;
    }
};

var getPlayerDrawFunc = function(mode) {
    if (mode == undefined) {
        mode = gameMode;
    }
    if (mode == GAME_OTTO) {
        return atlas.drawOttoSprite;
    }
    else if (mode == GAME_PACMAN) {
        return atlas.drawPacmanSprite;
    }
    else if (mode == GAME_MSPACMAN) {
        return atlas.drawMsPacmanSprite;
    }
    else if (mode == GAME_COOKIE) {
        //return atlas.drawCookiemanSprite;
        return drawCookiemanSprite;
    }
};


// for clearing, backing up, and restoring cheat states (before and after cutscenes presently)
var clearCheats, backupCheats, restoreCheats;
(function(){
    clearCheats = function() {
        pacman.invincible = false;
        pacman.ai = false;
        for (i=0; i<5; i++) {
            actors[i].isDrawPath = false;
            actors[i].isDrawTarget = false;
        }
        executive.setUpdatesPerSecond(60);
    };

    var i, invincible, ai, isDrawPath, isDrawTarget;
    isDrawPath = {};
    isDrawTarget = {};
    backupCheats = function() {
        invincible = pacman.invincible;
        ai = pacman.ai;
        for (i=0; i<5; i++) {
            isDrawPath[i] = actors[i].isDrawPath;
            isDrawTarget[i] = actors[i].isDrawTarget;
        }
    };
    restoreCheats = function() {
        pacman.invincible = invincible;
        pacman.ai = ai;
        for (i=0; i<5; i++) {
            actors[i].isDrawPath = isDrawPath[i];
            actors[i].isDrawTarget = isDrawTarget[i];
        }
    };
})();

// current level, lives, and score
var level = 1;
var extraLives = 0;

// VCR functions

var savedLevel = {};
var savedExtraLives = {};
var savedHighScore = {};
var savedScore = {};
var savedState = {};

var saveGame = function(t) {
    savedLevel[t] = level;
    savedExtraLives[t] = extraLives;
    savedHighScore[t] = getHighScore();
    savedScore[t] = getScore();
    savedState[t] = state;
};
var loadGame = function(t) {
    level = savedLevel[t];
    if (extraLives != savedExtraLives[t]) {
        extraLives = savedExtraLives[t];
        renderer.drawMap();
    }
    setHighScore(savedHighScore[t]);
    setScore(savedScore[t]);
    state = savedState[t];
};

/// SCORING
// (manages scores and high scores for each game type)

var scores = [
    0,0, // pacman
    0,0, // mspac
    0,0, // cookie
    0,0, // otto
    0 ];
var highScores = [
    10000,10000, // pacman
    10000,10000, // mspac
    10000,10000, // cookie
    10000,10000, // otto
    ];

var getScoreIndex = function() {
    if (practiceMode) {
        return 8;
    }
    return gameMode*2 + (turboMode ? 1 : 0);
};

// handle a score increment
var addScore = function(p) {

    // get current scores
    var score = getScore();

    // handle extra life at 10000 points
    if (score < 10000 && score+p >= 10000) {
        extraLives++;
        renderer.drawMap();
    }

    score += p;
    setScore(score);

    if (!practiceMode) {
        if (score > getHighScore()) {
            setHighScore(score);
        }
    }
};

var getScore = function() {
    return scores[getScoreIndex()];
};
var setScore = function(score) {
    scores[getScoreIndex()] = score;
};

var getHighScore = function() {
    return highScores[getScoreIndex()];
};
var setHighScore = function(highScore) {
    highScores[getScoreIndex()] = highScore;
    saveHighScores();
};
// High Score Persistence

var loadHighScores = function() {
    var hs;
    var hslen;
    var i;
    if (localStorage && localStorage.highScores) {
        hs = JSON.parse(localStorage.highScores);
        hslen = hs.length;
        for (i=0; i<hslen; i++) {
            highScores[i] = Math.max(highScores[i],hs[i]);
        }
    }
};
var saveHighScores = function() {
    if (localStorage) {
        localStorage.highScores = JSON.stringify(highScores);
    }
};
//@line 1 "src/direction.js"
//////////////////////////////////////////////////////////////////////////////////////
// Directions
// (variables and utility functions for representing actor heading direction)

// direction enums (in counter-clockwise order)
// NOTE: changing the order of these enums may effect the enums.
//       I've tried abstracting away the uses by creating functions to rotate them.
// NOTE: This order determines tie-breakers in the shortest distance turn logic.
//       (i.e. higher priority turns have lower enum values)
var DIR_UP = 0;
var DIR_LEFT = 1;
var DIR_DOWN = 2;
var DIR_RIGHT = 3;

var getClockwiseAngleFromTop = function(dirEnum) {
    return -dirEnum*Math.PI/2;
};

var rotateLeft = function(dirEnum) {
    return (dirEnum+1)%4;
};

var rotateRight = function(dirEnum) {
    return (dirEnum+3)%4;
};

var rotateAboutFace = function(dirEnum) {
    return (dirEnum+2)%4;
};

// get direction enum from a direction vector
var getEnumFromDir = function(dir) {
    if (dir.x==-1) return DIR_LEFT;
    if (dir.x==1) return DIR_RIGHT;
    if (dir.y==-1) return DIR_UP;
    if (dir.y==1) return DIR_DOWN;
};

// set direction vector from a direction enum
var setDirFromEnum = function(dir,dirEnum) {
    if (dirEnum == DIR_UP)         { dir.x = 0; dir.y =-1; }
    else if (dirEnum == DIR_RIGHT)  { dir.x =1; dir.y = 0; }
    else if (dirEnum == DIR_DOWN)  { dir.x = 0; dir.y = 1; }
    else if (dirEnum == DIR_LEFT) { dir.x = -1; dir.y = 0; }
};

// return the direction of the open, surrounding tile closest to our target
var getTurnClosestToTarget = function(tile,targetTile,openTiles) {

    var dx,dy,dist;                      // variables used for euclidean distance
    var minDist = Infinity;              // variable used for finding minimum distance path
    var dir = {};
    var dirEnum = 0;
    var i;
    for (i=0; i<4; i++) {
        if (openTiles[i]) {
            setDirFromEnum(dir,i);
            dx = dir.x + tile.x - targetTile.x;
            dy = dir.y + tile.y - targetTile.y;
            dist = dx*dx+dy*dy;
            if (dist < minDist) {
                minDist = dist;
                dirEnum = i;
            }
        }
    }
    return dirEnum;
};

// retrieve four surrounding tiles and indicate whether they are open
var getOpenTiles = function(tile,dirEnum) {

    // get open passages
    var openTiles = {};
    openTiles[DIR_UP] =    map.isFloorTile(tile.x, tile.y-1);
    openTiles[DIR_RIGHT] = map.isFloorTile(tile.x+1, tile.y);
    openTiles[DIR_DOWN] =  map.isFloorTile(tile.x, tile.y+1);
    openTiles[DIR_LEFT] =  map.isFloorTile(tile.x-1, tile.y);

    var numOpenTiles = 0;
    var i;
    if (dirEnum != undefined) {

        // count number of open tiles
        for (i=0; i<4; i++)
            if (openTiles[i])
                numOpenTiles++;

        // By design, no mazes should have dead ends,
        // but allow player to turn around if and only if it's necessary.
        // Only close the passage behind the player if there are other openings.
        var oppDirEnum = rotateAboutFace(dirEnum); // current opposite direction enum
        if (numOpenTiles > 1)
            openTiles[oppDirEnum] = false;
    }

    return openTiles;
};

// returns if the given tile coordinate plus the given direction vector has a walkable floor tile
var isNextTileFloor = function(tile,dir) {
    return map.isFloorTile(tile.x+dir.x,tile.y+dir.y);
};

//@line 1 "src/Map.js"
//////////////////////////////////////////////////////////////////////////////////////
// Map
// (an ascii map of tiles representing a level maze)

// size of a square tile in pixels
var tileSize = 8;

// the center pixel of a tile
var midTile = {x:3, y:4};

// constructor
var Map = function(numCols, numRows, tiles) {

    // sizes
    this.numCols = numCols;
    this.numRows = numRows;
    this.numTiles = numCols*numRows;
    this.widthPixels = numCols*tileSize;
    this.heightPixels = numRows*tileSize;

    // ascii map
    this.tiles = tiles;

    // ghost home location
    this.doorTile = {x:13, y:14};
    this.doorPixel = {
        x:(this.doorTile.x+1)*tileSize-1, 
        y:this.doorTile.y*tileSize + midTile.y
    };
    this.homeTopPixel = 17*tileSize;
    this.homeBottomPixel = 18*tileSize;

    this.timeEaten = {};

    this.resetCurrent();
    this.parseDots();
    this.parseTunnels();
    this.parseWalls();
};

Map.prototype.save = function(t) {
};

Map.prototype.eraseFuture = function(t) {
    // current state at t.
    // erase all states after t.
    var i;
    for (i=0; i<this.numTiles; i++) {
        if (t <= this.timeEaten[i]) {
            delete this.timeEaten[i];
        }
    }
};

Map.prototype.load = function(t,abs_t) {
    var firstTile,curTile;
    var refresh = function(i) {
        var x,y;
        x = i%this.numCols;
        y = Math.floor(i/this.numCols);
        renderer.refreshPellet(x,y);
    };
    var i;
    for (i=0; i<this.numTiles; i++) {
        firstTile = this.startTiles[i];
        if (firstTile == '.' || firstTile == 'o') {
            if (abs_t <= this.timeEaten[i]) { // dot should be present
                if (this.currentTiles[i] != firstTile) {
                    this.dotsEaten--;
                    this.currentTiles[i] = firstTile;
                    refresh.call(this,i);
                }
            }
            else if (abs_t > this.timeEaten[i]) { // dot should be missing
                if (this.currentTiles[i] != ' ') {
                    this.dotsEaten++;
                    this.currentTiles[i] = ' ';
                    refresh.call(this,i);
                }
            }
        }
    }
};

Map.prototype.resetTimeEaten = function()
{
    this.startTiles = this.currentTiles.slice(0);
    this.timeEaten = {};
};

// reset current tiles
Map.prototype.resetCurrent = function() {
    this.currentTiles = this.tiles.split(""); // create a mutable list copy of an immutable string
    this.dotsEaten = 0;
};

// This is a procedural way to generate original-looking maps from a simple ascii tile
// map without a spritesheet.
Map.prototype.parseWalls = function() {

    var that = this;

    // creates a list of drawable canvas paths to render the map walls
    this.paths = [];

    // a map of wall tiles that already belong to a built path
    var visited = {};

    // we extend the x range to suggest the continuation of the tunnels
    var toIndex = function(x,y) {
        if (x>=-2 && x<that.numCols+2 && y>=0 && y<that.numRows)
            return (x+2)+y*(that.numCols+4);
    };

    // a map of which wall tiles that are not completely surrounded by other wall tiles
    var edges = {};
    var i=0,x,y;
    for (y=0;y<this.numRows;y++) {
        for (x=-2;x<this.numCols+2;x++,i++) {
            if (this.getTile(x,y) == '|' &&
                (this.getTile(x-1,y) != '|' ||
                this.getTile(x+1,y) != '|' ||
                this.getTile(x,y-1) != '|' ||
                this.getTile(x,y+1) != '|' ||
                this.getTile(x-1,y-1) != '|' ||
                this.getTile(x-1,y+1) != '|' ||
                this.getTile(x+1,y-1) != '|' ||
                this.getTile(x+1,y+1) != '|')) {
                edges[i] = true;
            }
        }
    }

    // walks along edge wall tiles starting at the given index to build a canvas path
    var makePath = function(tx,ty) {

        // get initial direction
        var dir = {};
        var dirEnum;
        if (toIndex(tx+1,ty) in edges)
            dirEnum = DIR_RIGHT;
        else if (toIndex(tx, ty+1) in edges)
            dirEnum = DIR_DOWN;
        else
            throw "tile shouldn't be 1x1 at "+tx+","+ty;
        setDirFromEnum(dir,dirEnum);

        // increment to next tile
        tx += dir.x;
        ty += dir.y;

        // backup initial location and direction
        var init_tx = tx;
        var init_ty = ty;
        var init_dirEnum = dirEnum;

        var path = [];
        var pad; // (persists for each call to getStartPoint)
        var point;
        var lastPoint;

        var turn,turnAround;

        /*

           We employ the 'right-hand rule' by keeping our right hand in contact
           with the wall to outline an individual wall piece.

           Since we parse the tiles in row major order, we will always start
           walking along the wall at the leftmost tile of its topmost row.  We
           then proceed walking to the right.  

           When facing the direction of the walk at each tile, the outline will
           hug the left side of the tile unless there is a walkable tile to the
           left.  In that case, there will be a padding distance applied.
           
        */
        var getStartPoint = function(tx,ty,dirEnum) {
            var dir = {};
            setDirFromEnum(dir, dirEnum);
            if (!(toIndex(tx+dir.y,ty-dir.x) in edges))
                pad = that.isFloorTile(tx+dir.y,ty-dir.x) ? 5 : 0;
            var px = -tileSize/2+pad;
            var py = tileSize/2;
            var a = getClockwiseAngleFromTop(dirEnum);
            var c = Math.cos(a);
            var s = Math.sin(a);
            return {
                // the first expression is the rotated point centered at origin
                // the second expression is to translate it to the tile
                x:(px*c - py*s) + (tx+0.5)*tileSize,
                y:(px*s + py*c) + (ty+0.5)*tileSize,
            };
        };
        while (true) {
            
            visited[toIndex(tx,ty)] = true;

            // determine start point
            point = getStartPoint(tx,ty,dirEnum);

            if (turn) {
                // if we're turning into this tile, create a control point for the curve
                //
                // >---+  <- control point
                //     |
                //     V
                lastPoint = path[path.length-1];
                if (dir.x == 0) {
                    point.cx = point.x;
                    point.cy = lastPoint.y;
                }
                else {
                    point.cx = lastPoint.x;
                    point.cy = point.y;
                }
            }

            // update direction
            turn = false;
            turnAround = false;
            if (toIndex(tx+dir.y, ty-dir.x) in edges) { // turn left
                dirEnum = rotateLeft(dirEnum);
                turn = true;
            }
            else if (toIndex(tx+dir.x, ty+dir.y) in edges) { // continue straight
            }
            else if (toIndex(tx-dir.y, ty+dir.x) in edges) { // turn right
                dirEnum = rotateRight(dirEnum);
                turn = true;
            }
            else { // turn around
                dirEnum = rotateAboutFace(dirEnum);
                turnAround = true;
            }
            setDirFromEnum(dir,dirEnum);

            // commit path point
            path.push(point);

            // special case for turning around (have to connect more dots manually)
            if (turnAround) {
                path.push(getStartPoint(tx-dir.x, ty-dir.y, rotateAboutFace(dirEnum)));
                path.push(getStartPoint(tx, ty, dirEnum));
            }

            // advance to the next wall
            tx += dir.x;
            ty += dir.y;

            // exit at full cycle
            if (tx==init_tx && ty==init_ty && dirEnum == init_dirEnum) {
                that.paths.push(path);
                break;
            }
        }
    };

    // iterate through all edges, making a new path after hitting an unvisited wall edge
    i=0;
    for (y=0;y<this.numRows;y++)
        for (x=-2;x<this.numCols+2;x++,i++)
            if (i in edges && !(i in visited)) {
                visited[i] = true;
                makePath(x,y);
            }
};

// count pellets and store energizer locations
Map.prototype.parseDots = function() {

    this.numDots = 0;
    this.numEnergizers = 0;
    this.energizers = [];

    var x,y;
    var i = 0;
    var tile;
    for (y=0; y<this.numRows; y++) for (x=0; x<this.numCols; x++) {
        tile = this.tiles[i];
        if (tile == '.') {
            this.numDots++;
        }
        else if (tile == 'o') {
            this.numDots++;
            this.numEnergizers++;
            this.energizers.push({'x':x,'y':y});
        }
        i++;
    }
};

// get remaining dots left
Map.prototype.dotsLeft = function() {
    return this.numDots - this.dotsEaten;
};

// determine if all dots have been eaten
Map.prototype.allDotsEaten = function() {
    return this.dotsLeft() == 0;
};

// create a record of tunnel locations
Map.prototype.parseTunnels = (function(){
    
    // starting from x,y and increment x by dx...
    // determine where the tunnel entrance begins
    var getTunnelEntrance = function(x,y,dx) {
        while (!this.isFloorTile(x,y-1) && !this.isFloorTile(x,y+1) && this.isFloorTile(x,y))
            x += dx;
        return x;
    };

    // the number of margin tiles outside of the map on one side of a tunnel
    // There are (2*marginTiles) tiles outside of the map per tunnel.
    var marginTiles = 2;

    return function() {
        this.tunnelRows = {};
        var y;
        var i;
        var left,right;
        for (y=0;y<this.numRows;y++)
            // a map row is a tunnel if opposite ends are both walkable tiles
            if (this.isFloorTile(0,y) && this.isFloorTile(this.numCols-1,y))
                this.tunnelRows[y] = {
                    'leftEntrance': getTunnelEntrance.call(this,0,y,1),
                    'rightEntrance':getTunnelEntrance.call(this,this.numCols-1,y,-1),
                    'leftExit': -marginTiles*tileSize,
                    'rightExit': (this.numCols+marginTiles)*tileSize-1,
                };
    };
})();

// teleport actor to other side of tunnel if necessary
Map.prototype.teleport = function(actor){
    var i;
    var t = this.tunnelRows[actor.tile.y];
    if (t) {
        if (actor.pixel.x < t.leftExit)       actor.pixel.x = t.rightExit;
        else if (actor.pixel.x > t.rightExit) actor.pixel.x = t.leftExit;
    }
};

Map.prototype.posToIndex = function(x,y) {
    if (x>=0 && x<this.numCols && y>=0 && y<this.numRows) 
        return x+y*this.numCols;
};

// define which tiles are inside the tunnel
Map.prototype.isTunnelTile = function(x,y) {
    var tunnel = this.tunnelRows[y];
    return tunnel && (x < tunnel.leftEntrance || x > tunnel.rightEntrance);
};

// retrieves tile character at given coordinate
// extended to include offscreen tunnel space
Map.prototype.getTile = function(x,y) {
    if (x>=0 && x<this.numCols && y>=0 && y<this.numRows) 
        return this.currentTiles[this.posToIndex(x,y)];
    if ((x<0 || x>=this.numCols) && (this.isTunnelTile(x,y-1) || this.isTunnelTile(x,y+1)))
        return '|';
    if (this.isTunnelTile(x,y))
        return ' ';
};

// determines if the given character is a walkable floor tile
Map.prototype.isFloorTileChar = function(tile) {
    return tile==' ' || tile=='.' || tile=='o';
};

// determines if the given tile coordinate has a walkable floor tile
Map.prototype.isFloorTile = function(x,y) {
    return this.isFloorTileChar(this.getTile(x,y));
};

// mark the dot at the given coordinate eaten
Map.prototype.onDotEat = function(x,y) {
    this.dotsEaten++;
    var i = this.posToIndex(x,y);
    this.currentTiles[i] = ' ';
    this.timeEaten[i] = vcr.getTime();
    renderer.erasePellet(x,y);
};
//@line 1 "src/colors.js"
// source: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
 */
function rgbToHsl(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  l       The lightness
 * @return  Array           The RGB representation
 */
function hslToRgb(h, s, l){
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    r *= 255;
    g *= 255;
    b *= 255;

    return [r,g,b];
}

/**
 * Converts an RGB color value to HSV. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and v in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSV representation
 */
function rgbToHsv(r, g, b){
    r = r/255, g = g/255, b = b/255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max == 0 ? 0 : d / max;

    if(max == min){
        h = 0; // achromatic
    }else{
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, v];
}

/**
 * Converts an HSV color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes h, s, and v are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  v       The value
 * @return  Array           The RGB representation
 */
function hsvToRgb(h, s, v){
    var r, g, b;

    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);

    switch(i % 6){
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    r *= 255;
    g *= 255;
    b *= 255;

    return [r,g,b];
}

function rgbString(rgb) {
    var r = Math.floor(rgb[0]);
    var g = Math.floor(rgb[1]);
    var b = Math.floor(rgb[2]);
    return 'rgb('+r+','+g+','+b+')';
}
//@line 1 "src/mapgen.js"
var mapgen = (function(){

    var shuffle = function(list) {
        var len = list.length;
        var i,j;
        var temp;
        for (i=0; i<len; i++) {
            j = getRandomInt(0,len-1);
            temp = list[i];
            list[i] = list[j];
            list[j] = temp;
        }
    };

    var randomElement = function(list) {
        var len = list.length;
        if (len > 0) {
            return list[getRandomInt(0,len-1)];
        }
    };

    var UP = 0;
    var RIGHT = 1;
    var DOWN = 2;
    var LEFT = 3;

    var cells = [];
    var tallRows = [];
    var narrowCols = [];

    var rows = 9;
    var cols = 5;

    var reset = function() {
        var i;
        var c;

        // initialize cells
        for (i=0; i<rows*cols; i++) {
            cells[i] = {
                x: i%cols,
                y: Math.floor(i/cols),
                filled: false,
                connect: [false, false, false, false],
                next: [],
                no: undefined,
                group: undefined,
            };
        }

        // allow each cell to refer to surround cells by direction
        for (i=0; i<rows*cols; i++) {
            var c = cells[i];
            if (c.x > 0)
                c.next[LEFT] = cells[i-1];
            if (c.x < cols - 1)
                c.next[RIGHT] = cells[i+1];
            if (c.y > 0)
                c.next[UP] = cells[i-cols];
            if (c.y < rows - 1)
                c.next[DOWN] = cells[i+cols];
        }

        // define the ghost home square

        i = 3*cols;
        c = cells[i];
        c.filled=true;
        c.connect[LEFT] = c.connect[RIGHT] = c.connect[DOWN] = true;

        i++;
        c = cells[i];
        c.filled=true;
        c.connect[LEFT] = c.connect[DOWN] = true;

        i+=cols-1;
        c = cells[i];
        c.filled=true;
        c.connect[LEFT] = c.connect[UP] = c.connect[RIGHT] = true;

        i++;
        c = cells[i];
        c.filled=true;
        c.connect[UP] = c.connect[LEFT] = true;
    };

    var genRandom = function() {

        var getLeftMostEmptyCells = function() {
            var x;
            var leftCells = [];
            for (x=0; x<cols; x++) {
                for (y=0; y<rows; y++) {
                    var c = cells[x+y*cols];
                    if (!c.filled) {
                        leftCells.push(c);
                    }
                }

                if (leftCells.length > 0) {
                    break;
                }
            }
            return leftCells;
        };
        var isOpenCell = function(cell,i,prevDir,size) {

            // prevent wall from going through starting position
            if (cell.y == 6 && cell.x == 0 && i == DOWN ||
                cell.y == 7 && cell.x == 0 && i == UP) {
                return false;
            }

            // prevent long straight pieces of length 3
            if (size == 2 && (i==prevDir || rotateAboutFace(i)==prevDir)) {
                return false;
            }

            // examine an adjacent empty cell
            if (cell.next[i] && !cell.next[i].filled) {
                
                // only open if the cell to the left of it is filled
                if (cell.next[i].next[LEFT] && !cell.next[i].next[LEFT].filled) {
                }
                else {
                    return true;
                }
            }

            return false;
        };
        var getOpenCells = function(cell,prevDir,size) {
            var openCells = [];
            var numOpenCells = 0;
            for (i=0; i<4; i++) {
                if (isOpenCell(cell,i,prevDir,size)) {
                    openCells.push(i);
                    numOpenCells++;
                }
            }
            return { openCells: openCells, numOpenCells: numOpenCells };
        };
        var connectCell = function(cell,dir) {
            cell.connect[dir] = true;
            cell.next[dir].connect[rotateAboutFace(dir)] = true;
            if (cell.x == 0 && dir == RIGHT) {
                cell.connect[LEFT] = true;
            }
        };

        var gen = function() {
        
            var cell;      // cell at the center of growth (open cells are chosen around this cell)
            var newCell;   // most recent cell filled
            var firstCell; // the starting cell of the current group

            var openCells;    // list of open cells around the center cell
            var numOpenCells; // size of openCells

            var dir; // the most recent direction of growth relative to the center cell
            var i;   // loop control variable used for iterating directions

            var numFilled = 0;  // current count of total cells filled
            var numGroups;      // current count of cell groups created
            var size;           // current number of cells in the current group
            var probStopGrowingAtSize = [ // probability of stopping growth at sizes...
                    0,     // size 0
                    0,     // size 1
                    0.10,  // size 2
                    0.5,   // size 3
                    0.75,  // size 4
                    1];    // size 5

            // A single cell group of size 1 is allowed at each row at y=0 and y=rows-1,
            // so keep count of those created.
            var singleCount = {};
            singleCount[0] = singleCount[rows-1] = 0;
            var probTopAndBotSingleCellJoin = 0.35;

            // A count and limit of the number long pieces (i.e. an "L" of size 4 or "T" of size 5)
            var longPieces = 0;
            var maxLongPieces = 1;
            var probExtendAtSize2 = 1;
            var probExtendAtSize3or4 = 0.5;

            var fillCell = function(cell) {
                cell.filled = true;
                cell.no = numFilled++;
                cell.group = numGroups;
            };

            for (numGroups=0; ; numGroups++) {

                // find all the leftmost empty cells
                openCells = getLeftMostEmptyCells();

                // stop add pieces if there are no more empty cells.
                numOpenCells = openCells.length;
                if (numOpenCells == 0) {
                    break;
                }

                // choose the center cell to be a random open cell, and fill it.
                firstCell = cell = openCells[getRandomInt(0,numOpenCells-1)];
                fillCell(cell);

                // randomly allow one single-cell piece on the top or bottom of the map.
                if (cell.x < cols-1 && (cell.y in singleCount) && Math.random() <= probTopAndBotSingleCellJoin) {
                    if (singleCount[cell.y] == 0) {
                        cell.connect[cell.y == 0 ? UP : DOWN] = true;
                        singleCount[cell.y]++;
                        continue;
                    }
                }

                // number of cells in this contiguous group
                size = 1;

                if (cell.x == cols-1) {
                    // if the first cell is at the right edge, then don't grow it.
                    cell.connect[RIGHT] = true;
                    cell.isRaiseHeightCandidate = true;
                }
                else {
                    // only allow the piece to grow to 5 cells at most.
                    while (size < 5) {

                        var stop = false;

                        if (size == 2) {
                            // With a horizontal 2-cell group, try to turn it into a 4-cell "L" group.
                            // This is done here because this case cannot be reached when a piece has already grown to size 3.
                            var c = firstCell;
                            if (c.x > 0 && c.connect[RIGHT] && c.next[RIGHT] && c.next[RIGHT].next[RIGHT]) {
                                if (longPieces < maxLongPieces && Math.random() <= probExtendAtSize2) {

                                    c = c.next[RIGHT].next[RIGHT];
                                    var dirs = {};
                                    if (isOpenCell(c,UP)) {
                                        dirs[UP] = true;
                                    }
                                    if (isOpenCell(c,DOWN)) {
                                        dirs[DOWN] = true;
                                    }

                                    if (dirs[UP] && dirs[DOWN]) {
                                        i = [UP,DOWN][getRandomInt(0,1)];
                                    }
                                    else if (dirs[UP]) {
                                        i = UP;
                                    }
                                    else if (dirs[DOWN]) {
                                        i = DOWN;
                                    }
                                    else {
                                        i = undefined;
                                    }

                                    if (i != undefined) {
                                        connectCell(c,LEFT);
                                        fillCell(c);
                                        connectCell(c,i);
                                        fillCell(c.next[i]);
                                        longPieces++;
                                        size+=2;
                                        stop = true;
                                    }
                                }
                            }
                        }

                        if (!stop) {
                            // find available open adjacent cells.
                            var result = getOpenCells(cell,dir,size);
                            openCells = result['openCells'];
                            numOpenCells = result['numOpenCells'];

                            // if no open cells found from center point, then use the last cell as the new center
                            // but only do this if we are of length 2 to prevent numerous short pieces.
                            // then recalculate the open adjacent cells.
                            if (numOpenCells == 0 && size == 2) {
                                cell = newCell;
                                result = getOpenCells(cell,dir,size);
                                openCells = result['openCells'];
                                numOpenCells = result['numOpenCells'];
                            }

                            // no more adjacent cells, so stop growing this piece.
                            if (numOpenCells == 0) {
                                stop = true;
                            }
                            else {
                                // choose a random valid direction to grow.
                                dir = openCells[getRandomInt(0,numOpenCells-1)];
                                newCell = cell.next[dir];

                                // connect the cell to the new cell.
                                connectCell(cell,dir);

                                // fill the cell
                                fillCell(newCell);

                                // increase the size count of this piece.
                                size++;

                                // don't let center pieces grow past 3 cells
                                if (firstCell.x == 0 && size == 3) {
                                    stop = true;
                                }

                                // Use a probability to determine when to stop growing the piece.
                                if (Math.random() <= probStopGrowingAtSize[size]) {
                                    stop = true;
                                }
                            }
                        }

                        // Close the piece.
                        if (stop) {

                            if (size == 1) {
                                // This is provably impossible because this loop is never entered with size==1.
                            }
                            else if (size == 2) {

                                // With a vertical 2-cell group, attach to the right wall if adjacent.
                                var c = firstCell;
                                if (c.x == cols-1) {

                                    // select the top cell
                                    if (c.connect[UP]) {
                                        c = c.next[UP];
                                    }
                                    c.connect[RIGHT] = c.next[DOWN].connect[RIGHT] = true;
                                }
                                
                            }
                            else if (size == 3 || size == 4) {

                                // Try to extend group to have a long leg
                                if (longPieces < maxLongPieces && firstCell.x > 0 && Math.random() <= probExtendAtSize3or4) {
                                    var dirs = [];
                                    var dirsLength = 0;
                                    for (i=0; i<4; i++) {
                                        if (cell.connect[i] && isOpenCell(cell.next[i],i)) {
                                            dirs.push(i);
                                            dirsLength++;
                                        }
                                    }
                                    if (dirsLength > 0) {
                                        i = dirs[getRandomInt(0,dirsLength-1)];
                                        c = cell.next[i];
                                        connectCell(c,i);
                                        fillCell(c.next[i]);
                                        longPieces++;
                                    }
                                }
                            }

                            break;
                        }
                    }
                }
            }
            setResizeCandidates();
        };


        var setResizeCandidates = function() {
            var i;
            var c,q,c2,q2;
            var x,y;
            for (i=0; i<rows*cols; i++) {
                c = cells[i];
                x = i % cols;
                y = Math.floor(i/cols);

                // determine if it has flexible height

                //
                // |_|
                //
                // or
                //  _
                // | |
                //
                q = c.connect;
                if ((c.x == 0 || !q[LEFT]) &&
                    (c.x == cols-1 || !q[RIGHT]) &&
                    q[UP] != q[DOWN]) {
                    c.isRaiseHeightCandidate = true;
                }

                //  _ _
                // |_ _|
                //
                c2 = c.next[RIGHT];
                if (c2 != undefined) {
                    q2 = c2.connect;
                    if (((c.x == 0 || !q[LEFT]) && !q[UP] && !q[DOWN]) &&
                        ((c2.x == cols-1 || !q2[RIGHT]) && !q2[UP] && !q2[DOWN])
                        ) {
                        c.isRaiseHeightCandidate = c2.isRaiseHeightCandidate = true;
                    }
                }

                // determine if it has flexible width

                // if cell is on the right edge with an opening to the right
                if (c.x == cols-1 && q[RIGHT]) {
                    c.isShrinkWidthCandidate = true;
                }

                //  _
                // |_
                // 
                // or
                //  _
                //  _|
                //
                if ((c.y == 0 || !q[UP]) &&
                    (c.y == rows-1 || !q[DOWN]) &&
                    q[LEFT] != q[RIGHT]) {
                    c.isShrinkWidthCandidate = true;
                }

            }
        };

        // Identify if a cell is the center of a cross.
        var cellIsCrossCenter = function(c) {
            return c.connect[UP] && c.connect[RIGHT] && c.connect[DOWN] && c.connect[LEFT];
        };

        var chooseNarrowCols = function() {

            var canShrinkWidth = function(x,y) {

                // Can cause no more tight turns.
                if (y==rows-1) {
                    return true;
                }

                // get the right-hand-side bound
                var x0;
                var c,c2;
                for (x0=x; x0<cols; x0++) {
                    c = cells[x0+y*cols];
                    c2 = c.next[DOWN]
                    if ((!c.connect[RIGHT] || cellIsCrossCenter(c)) &&
                        (!c2.connect[RIGHT] || cellIsCrossCenter(c2))) {
                        break;
                    }
                }

                // build candidate list
                var candidates = [];
                var numCandidates = 0;
                for (; c2; c2=c2.next[LEFT]) {
                    if (c2.isShrinkWidthCandidate) {
                        candidates.push(c2);
                        numCandidates++;
                    }

                    // cannot proceed further without causing irreconcilable tight turns
                    if ((!c2.connect[LEFT] || cellIsCrossCenter(c2)) &&
                        (!c2.next[UP].connect[LEFT] || cellIsCrossCenter(c2.next[UP]))) {
                        break;
                    }
                }
                shuffle(candidates);

                var i;
                for (i=0; i<numCandidates; i++) {
                    c2 = candidates[i];
                    if (canShrinkWidth(c2.x,c2.y)) {
                        c2.shrinkWidth = true;
                        narrowCols[c2.y] = c2.x;
                        return true;
                    }
                }

                return false;
            };

            var x;
            var c;
            for (x=cols-1; x>=0; x--) {
                c = cells[x];
                if (c.isShrinkWidthCandidate && canShrinkWidth(x,0)) {
                    c.shrinkWidth = true;
                    narrowCols[c.y] = c.x;
                    return true;
                }
            }

            return false;
        };

        var chooseTallRows = function() {

            var canRaiseHeight = function(x,y) {

                // Can cause no more tight turns.
                if (x==cols-1) {
                    return true;
                }

                // find the first cell below that will create too tight a turn on the right
                var y0;
                var c;
                var c2;
                for (y0=y; y0>=0; y0--) {
                    c = cells[x+y0*cols];
                    c2 = c.next[RIGHT]
                    if ((!c.connect[UP] || cellIsCrossCenter(c)) && 
                        (!c2.connect[UP] || cellIsCrossCenter(c2))) {
                        break;
                    }
                }

                // Proceed from the right cell upwards, looking for a cell that can be raised.
                var candidates = [];
                var numCandidates = 0;
                for (; c2; c2=c2.next[DOWN]) {
                    if (c2.isRaiseHeightCandidate) {
                        candidates.push(c2);
                        numCandidates++;
                    }

                    // cannot proceed further without causing irreconcilable tight turns
                    if ((!c2.connect[DOWN] || cellIsCrossCenter(c2)) &&
                        (!c2.next[LEFT].connect[DOWN] || cellIsCrossCenter(c2.next[LEFT]))) {
                        break;
                    }
                }
                shuffle(candidates);

                var i;
                for (i=0; i<numCandidates; i++) {
                    c2 = candidates[i];
                    if (canRaiseHeight(c2.x,c2.y)) {
                        c2.raiseHeight = true;
                        tallRows[c2.x] = c2.y;
                        return true;
                    }
                }

                return false;
            };

            // From the top left, examine cells below until hitting top of ghost house.
            // A raisable cell must be found before the ghost house.
            var y;
            var c;
            for (y=0; y<3; y++) {
                c = cells[y*cols];
                if (c.isRaiseHeightCandidate && canRaiseHeight(0,y)) {
                    c.raiseHeight = true;
                    tallRows[c.x] = c.y;
                    return true;
                }
            }

            return false;
        };

        // This is a function to detect impurities in the map that have no heuristic implemented to avoid it yet in gen().
        var isDesirable = function() {

            // ensure a solid top right corner
            var c = cells[4];
            if (c.connect[UP] || c.connect[RIGHT]) {
                return false;
            }

            // ensure a solid bottom right corner
            c = cells[rows*cols-1];
            if (c.connect[DOWN] || c.connect[RIGHT]) {
                return false;
            }

            // ensure there are no two stacked/side-by-side 2-cell pieces.
            var isHori = function(x,y) {
                var q1 = cells[x+y*cols].connect;
                var q2 = cells[x+1+y*cols].connect;
                return !q1[UP] && !q1[DOWN] && (x==0 || !q1[LEFT]) && q1[RIGHT] && 
                       !q2[UP] && !q2[DOWN] && q2[LEFT] && !q2[RIGHT];
            };
            var isVert = function(x,y) {
                var q1 = cells[x+y*cols].connect;
                var q2 = cells[x+(y+1)*cols].connect;
                if (x==cols-1) {
                    // special case (we can consider two single cells as vertical at the right edge)
                    return !q1[LEFT] && !q1[UP] && !q1[DOWN] &&
                           !q2[LEFT] && !q2[UP] && !q2[DOWN];
                }
                return !q1[LEFT] && !q1[RIGHT] && !q1[UP] && q1[DOWN] && 
                       !q2[LEFT] && !q2[RIGHT] && q2[UP] && !q2[DOWN];
            };
            var x,y;
            var g;
            for (y=0; y<rows-1; y++) {
                for (x=0; x<cols-1; x++) {
                    if (isHori(x,y) && isHori(x,y+1) ||
                        isVert(x,y) && isVert(x+1,y)) {

                        // don't allow them in the middle because they'll be two large when reflected.
                        if (x==0) {
                            return false;
                        }

                        // Join the four cells to create a square.
                        cells[x+y*cols].connect[DOWN] = true;
                        cells[x+y*cols].connect[RIGHT] = true;
                        g = cells[x+y*cols].group;

                        cells[x+1+y*cols].connect[DOWN] = true;
                        cells[x+1+y*cols].connect[LEFT] = true;
                        cells[x+1+y*cols].group = g;

                        cells[x+(y+1)*cols].connect[UP] = true;
                        cells[x+(y+1)*cols].connect[RIGHT] = true;
                        cells[x+(y+1)*cols].group = g;

                        cells[x+1+(y+1)*cols].connect[UP] = true;
                        cells[x+1+(y+1)*cols].connect[LEFT] = true;
                        cells[x+1+(y+1)*cols].group = g;
                    }
                }
            }

            if (!chooseTallRows()) {
                return false;
            }

            if (!chooseNarrowCols()) {
                return false;
            }

            return true;
        };

        // set the final position and size of each cell when upscaling the simple model to actual size
        var setUpScaleCoords = function() {
            var i,c;
            for (i=0; i<rows*cols; i++) {
                c = cells[i];
                c.final_x = c.x*3;
                if (narrowCols[c.y] < c.x) {
                    c.final_x--;
                }
                c.final_y = c.y*3;
                if (tallRows[c.x] < c.y) {
                    c.final_y++;
                }
                c.final_w = c.shrinkWidth ? 2 : 3;
                c.final_h = c.raiseHeight ? 4 : 3;
            }
        };

        var reassignGroup = function(oldg,newg) {
            var i;
            var c;
            for (i=0; i<rows*cols; i++) {
                c = cells[i];
                if (c.group == oldg) {
                    c.group = newg;
                }
            }
        };

        var createTunnels = function() {

            // declare candidates
            var singleDeadEndCells = [];
            var topSingleDeadEndCells = [];
            var botSingleDeadEndCells = [];

            var voidTunnelCells = [];
            var topVoidTunnelCells = [];
            var botVoidTunnelCells = [];

            var edgeTunnelCells = [];
            var topEdgeTunnelCells = [];
            var botEdgeTunnelCells = [];

            var doubleDeadEndCells = [];

            var numTunnelsCreated = 0;

            // prepare candidates
            var y;
            var c;
            var upDead;
            var downDead;
            for (y=0; y<rows; y++) {
                c = cells[cols-1+y*cols];
                if (c.connect[UP]) {
                    continue;
                }
                if (c.y > 1 && c.y < rows-2) {
                    c.isEdgeTunnelCandidate = true;
                    edgeTunnelCells.push(c);
                    if (c.y <= 2) {
                        topEdgeTunnelCells.push(c);
                    }
                    else if (c.y >= 5) {
                        botEdgeTunnelCells.push(c);
                    }
                }
                upDead = (!c.next[UP] || c.next[UP].connect[RIGHT]);
                downDead = (!c.next[DOWN] || c.next[DOWN].connect[RIGHT]);
                if (c.connect[RIGHT]) {
                    if (upDead) {
                        c.isVoidTunnelCandidate = true;
                        voidTunnelCells.push(c);
                        if (c.y <= 2) {
                            topVoidTunnelCells.push(c);
                        }
                        else if (c.y >= 6) {
                            botVoidTunnelCells.push(c);
                        }
                    }
                }
                else {
                    if (c.connect[DOWN]) {
                        continue;
                    }
                    if (upDead != downDead) {
                        if (!c.raiseHeight && y < rows-1 && !c.next[LEFT].connect[LEFT]) {
                            singleDeadEndCells.push(c);
                            c.isSingleDeadEndCandidate = true;
                            c.singleDeadEndDir = upDead ? UP : DOWN;
                            var offset = upDead ? 1 : 0;
                            if (c.y <= 1+offset) {
                                topSingleDeadEndCells.push(c);
                            }
                            else if (c.y >= 5+offset) {
                                botSingleDeadEndCells.push(c);
                            }
                        }
                    }
                    else if (upDead && downDead) {
                        if (y > 0 && y < rows-1) {
                            if (c.next[LEFT].connect[UP] && c.next[LEFT].connect[DOWN]) {
                                c.isDoubleDeadEndCandidate = true;
                                if (c.y >= 2 && c.y <= 5) {
                                    doubleDeadEndCells.push(c);
                                }
                            }
                        }
                    }
                }
            }

            // choose tunnels from candidates
            var numTunnelsDesired = Math.random() <= 0.45 ? 2 : 1;
            var c;
            var selectSingleDeadEnd = function(c) {
                c.connect[RIGHT] = true;
                if (c.singleDeadEndDir == UP) {
                    c.topTunnel = true;
                }
                else {
                    c.next[DOWN].topTunnel = true;
                }
            };
            if (numTunnelsDesired == 1) {
                if (c = randomElement(voidTunnelCells)) {
                    c.topTunnel = true;
                }
                else if (c = randomElement(singleDeadEndCells)) {
                    selectSingleDeadEnd(c);
                }
                else if (c = randomElement(edgeTunnelCells)) {
                    c.topTunnel = true;
                }
                else {
                    return false;
                }
            }
            else if (numTunnelsDesired == 2) {
                if (c = randomElement(doubleDeadEndCells)) {
                    c.connect[RIGHT] = true;
                    c.topTunnel = true;
                    c.next[DOWN].topTunnel = true;
                }
                else {
                    numTunnelsCreated = 1;
                    if (c = randomElement(topVoidTunnelCells)) {
                        c.topTunnel = true;
                    }
                    else if (c = randomElement(topSingleDeadEndCells)) {
                        selectSingleDeadEnd(c);
                    }
                    else if (c = randomElement(topEdgeTunnelCells)) {
                        c.topTunnel = true;
                    }
                    else {
                        // could not find a top tunnel opening
                        numTunnelsCreated = 0;
                    }

                    if (c = randomElement(botVoidTunnelCells)) {
                        c.topTunnel = true;
                    }
                    else if (c = randomElement(botSingleDeadEndCells)) {
                        selectSingleDeadEnd(c);
                    }
                    else if (c = randomElement(botEdgeTunnelCells)) {
                        c.topTunnel = true;
                    }
                    else {
                        // could not find a bottom tunnel opening
                        if (numTunnelsCreated == 0) {
                            return false;
                        }
                    }
                }
            }

            // don't allow a horizontal path to cut straight through a map (through tunnels)
            var exit,topy;
            for (y=0; y<rows; y++) {
                c = cells[cols-1+y*cols];
                if (c.topTunnel) {
                    exit = true;
                    topy = c.final_y;
                    while (c.next[LEFT]) {
                        c = c.next[LEFT];
                        if (!c.connect[UP] && c.final_y == topy) {
                            continue;
                        }
                        else {
                            exit = false;
                            break;
                        }
                    }
                    if (exit) {
                        return false;
                    }
                }
            }

            // clear unused void tunnels (dead ends)
            var len = voidTunnelCells.length;
            var i;

            var replaceGroup = function(oldg,newg) {
                var i,c;
                for (i=0; i<rows*cols; i++) {
                    c = cells[i];
                    if (c.group == oldg) {
                        c.group = newg;
                    }
                }
            };
            for (i=0; i<len; i++) {
                c = voidTunnelCells[i];
                if (!c.topTunnel) {
                    replaceGroup(c.group, c.next[UP].group);
                    c.connect[UP] = true;
                    c.next[UP].connect[DOWN] = true;
                }
            }

            return true;
        };

        var joinWalls = function() {

            // randomly join wall pieces to the boundary to increase difficulty

            var x,y;
            var c;

            // join cells to the top boundary
            for (x=0; x<cols; x++) {
                c = cells[x];
                if (!c.connect[LEFT] && !c.connect[RIGHT] && !c.connect[UP] &&
                    (!c.connect[DOWN] || !c.next[DOWN].connect[DOWN])) {

                    // ensure it will not create a dead-end
                    if ((!c.next[LEFT] || !c.next[LEFT].connect[UP]) &&
                        (c.next[RIGHT] && !c.next[RIGHT].connect[UP])) {

                        // prevent connecting very large piece
                        if (!(c.next[DOWN] && c.next[DOWN].connect[RIGHT] && c.next[DOWN].next[RIGHT].connect[RIGHT])) {
                            c.isJoinCandidate = true;
                            if (Math.random() <= 0.25) {
                                c.connect[UP] = true;
                            }
                        }
                    }
                }
            }

            // join cells to the bottom boundary
            for (x=0; x<cols; x++) {
                c = cells[x+(rows-1)*cols];
                if (!c.connect[LEFT] && !c.connect[RIGHT] && !c.connect[DOWN] &&
                    (!c.connect[UP] || !c.next[UP].connect[UP])) {

                    // ensure it will not creat a dead-end
                    if ((!c.next[LEFT] || !c.next[LEFT].connect[DOWN]) &&
                        (c.next[RIGHT] && !c.next[RIGHT].connect[DOWN])) {

                        // prevent connecting very large piece
                        if (!(c.next[UP] && c.next[UP].connect[RIGHT] && c.next[UP].next[RIGHT].connect[RIGHT])) {
                            c.isJoinCandidate = true;
                            if (Math.random() <= 0.25) {
                                c.connect[DOWN] = true;
                            }
                        }
                    }
                }
            }

            // join cells to the right boundary
            var c2;
            for (y=1; y<rows-1; y++) {
                c = cells[cols-1+y*cols];
                if (c.raiseHeight) {
                    continue;
                }
                if (!c.connect[RIGHT] && !c.connect[UP] && !c.connect[DOWN] &&
                    !c.next[UP].connect[RIGHT] && !c.next[DOWN].connect[RIGHT]) {
                    if (c.connect[LEFT]) {
                        c2 = c.next[LEFT];
                        if (!c2.connect[UP] && !c2.connect[DOWN] && !c2.connect[LEFT]) {
                            c.isJoinCandidate = true;
                            if (Math.random() <= 0.5) {
                                c.connect[RIGHT] = true;
                            }
                        }
                    }
                }
            }
        };

        // try to generate a valid map, and keep count of tries.
        var genCount = 0;
        while (true) {
            reset();
            gen();
            genCount++;
            if (!isDesirable()) {
                continue;
            }

            setUpScaleCoords();
            joinWalls();
            if (!createTunnels()) {
                continue;
            }

            break;
        }

    };

    // Transform the simple cells to a tile array used for creating the map.
    var getTiles = function() {

        var tiles = []; // each is a character indicating a wall(|), path(.), or blank(_).
        var tileCells = []; // maps each tile to a specific cell of our simple map
        var subrows = rows*3+1+3;
        var subcols = cols*3-1+2;

        var midcols = subcols-2;
        var fullcols = (subcols-2)*2;

        // getter and setter for tiles (ensures vertical symmetry axis)
        var setTile = function(x,y,v) {
            if (x<0 || x>subcols-1 || y<0 || y>subrows-1) {
                return;
            }
            x -= 2;
            tiles[midcols+x+y*fullcols] = v;
            tiles[midcols-1-x+y*fullcols] = v;
        };
        var getTile = function(x,y) {
            if (x<0 || x>subcols-1 || y<0 || y>subrows-1) {
                return undefined;
            }
            x -= 2;
            return tiles[midcols+x+y*fullcols];
        };

        // getter and setter for tile cells
        var setTileCell = function(x,y,cell) {
            if (x<0 || x>subcols-1 || y<0 || y>subrows-1) {
                return;
            }
            x -= 2;
            tileCells[x+y*subcols] = cell;
        };
        var getTileCell = function(x,y) {
            if (x<0 || x>subcols-1 || y<0 || y>subrows-1) {
                return undefined;
            }
            x -= 2;
            return tileCells[x+y*subcols];
        };

        // initialize tiles
        var i;
        for (i=0; i<subrows*fullcols; i++) {
            tiles.push('_');
        }
        for (i=0; i<subrows*subcols; i++) {
            tileCells.push(undefined);
        }

        // set tile cells
        var c;
        var x,y,w,h;
        var x0,y0;
        for (i=0; i<rows*cols; i++) {
            c = cells[i];
            for (x0=0; x0<c.final_w; x0++) {
                for (y0=0; y0<c.final_h; y0++) {
                    setTileCell(c.final_x+x0,c.final_y+1+y0,c);
                }
            }
        }

        // set path tiles
        var cl, cu;
        for (y=0; y<subrows; y++) {
            for (x=0; x<subcols; x++) {
                c = getTileCell(x,y); // cell
                cl = getTileCell(x-1,y); // left cell
                cu = getTileCell(x,y-1); // up cell

                if (c) {
                    // inside map
                    if (cl && c.group != cl.group || // at vertical boundary
                        cu && c.group != cu.group || // at horizontal boundary
                        !cu && !c.connect[UP]) { // at top boundary
                        setTile(x,y,'.');
                    }
                }
                else {
                    // outside map
                    if (cl && (!cl.connect[RIGHT] || getTile(x-1,y) == '.') || // at right boundary
                        cu && (!cu.connect[DOWN] || getTile(x,y-1) == '.')) { // at bottom boundary
                        setTile(x,y,'.');
                    }
                }

                // at corner connecting two paths
                if (getTile(x-1,y) == '.' && getTile(x,y-1) == '.' && getTile(x-1,y-1) == '_') {
                    setTile(x,y,'.');
                }
            }
        }

        // extend tunnels
        var y;
        for (c=cells[cols-1]; c; c = c.next[DOWN]) {
            if (c.topTunnel) {
                y = c.final_y+1;
                setTile(subcols-1, y,'.');
                setTile(subcols-2, y,'.');
            }
        }

        // fill in walls
        for (y=0; y<subrows; y++) {
            for (x=0; x<subcols; x++) {
                // any blank tile that shares a vertex with a path tile should be a wall tile
                if (getTile(x,y) != '.' && (getTile(x-1,y) == '.' || getTile(x,y-1) == '.' || getTile(x+1,y) == '.' || getTile(x,y+1) == '.' ||
                    getTile(x-1,y-1) == '.' || getTile(x+1,y-1) == '.' || getTile(x+1,y+1) == '.' || getTile(x-1,y+1) == '.')) {
                    setTile(x,y,'|');
                }
            }
        }

        // create the ghost door
        setTile(2,12,'-');

        // set energizers
        var getTopEnergizerRange = function() {
            var miny;
            var maxy = subrows/2;
            var x = subcols-2;
            var y;
            for (y=2; y<maxy; y++) {
                if (getTile(x,y) == '.' && getTile(x,y+1) == '.') {
                    miny = y+1;
                    break;
                }
            }
            maxy = Math.min(maxy,miny+7);
            for (y=miny+1; y<maxy; y++) {
                if (getTile(x-1,y) == '.') {
                    maxy = y-1;
                    break;
                }
            }
            return {miny:miny, maxy:maxy};
        };
        var getBotEnergizerRange = function() {
            var miny = subrows/2;
            var maxy;
            var x = subcols-2;
            var y;
            for (y=subrows-3; y>=miny; y--) {
                if (getTile(x,y) == '.' && getTile(x,y+1) == '.') {
                    maxy = y;
                    break;
                }
            }
            miny = Math.max(miny,maxy-7);
            for (y=maxy-1; y>miny; y--) {
                if (getTile(x-1,y) == '.') {
                    miny = y+1;
                    break;
                }
            }
            return {miny:miny, maxy:maxy};
        };
        var x = subcols-2;
        var y;
        var range;
        if (range = getTopEnergizerRange()) {
            y = getRandomInt(range.miny, range.maxy);
            setTile(x,y,'o');
        }
        if (range = getBotEnergizerRange()) {
            y = getRandomInt(range.miny, range.maxy);
            setTile(x,y,'o');
        }

        // erase pellets in the tunnels
        var eraseUntilIntersection = function(x,y) {
            var adj;
            while (true) {
                adj = [];
                if (getTile(x-1,y) == '.') {
                    adj.push({x:x-1,y:y});
                }
                if (getTile(x+1,y) == '.') {
                    adj.push({x:x+1,y:y});
                }
                if (getTile(x,y-1) == '.') {
                    adj.push({x:x,y:y-1});
                }
                if (getTile(x,y+1) == '.') {
                    adj.push({x:x,y:y+1});
                }
                if (adj.length == 1) {
                    setTile(x,y,' ');
                    x = adj[0].x;
                    y = adj[0].y;
                }
                else {
                    break;
                }
            }
        };
        x = subcols-1;
        for (y=0; y<subrows; y++) {
            if (getTile(x,y) == '.') {
                eraseUntilIntersection(x,y);
            }
        }

        // erase pellets on starting position
        setTile(1,subrows-8,' ');

        // erase pellets around the ghost house
        var i,j;
        var y;
        for (i=0; i<7; i++) {

            // erase pellets from bottom of the ghost house proceeding down until
            // reaching a pellet tile that isn't surround by walls
            // on the left and right
            y = subrows-14;
            setTile(i, y, ' ');
            j = 1;
            while (getTile(i,y+j) == '.' &&
                    getTile(i-1,y+j) == '|' &&
                    getTile(i+1,y+j) == '|') {
                setTile(i,y+j,' ');
                j++;
            }

            // erase pellets from top of the ghost house proceeding up until
            // reaching a pellet tile that isn't surround by walls
            // on the left and right
            y = subrows-20;
            setTile(i, y, ' ');
            j = 1;
            while (getTile(i,y-j) == '.' &&
                    getTile(i-1,y-j) == '|' &&
                    getTile(i+1,y-j) == '|') {
                setTile(i,y-j,' ');
                j++;
            }
        }
        // erase pellets on the side of the ghost house
        for (i=0; i<7; i++) {

            // erase pellets from side of the ghost house proceeding right until
            // reaching a pellet tile that isn't surround by walls
            // on the top and bottom.
            x = 6;
            y = subrows-14-i;
            setTile(x, y, ' ');
            j = 1;
            while (getTile(x+j,y) == '.' &&
                    getTile(x+j,y-1) == '|' &&
                    getTile(x+j,y+1) == '|') {
                setTile(x+j,y,' ');
                j++;
            }
        }

        // return a tile string (3 empty lines on top and 2 on bottom)
        return (
            "____________________________" +
            "____________________________" +
            "____________________________" +
            tiles.join("") +
            "____________________________" +
            "____________________________");
    };

    var randomColor = function() {
        return '#'+('00000'+(Math.random()*(1<<24)|0).toString(16)).slice(-6);
    };

    // dijkstra's algorithm to find shortest path to all tiles from (x0,y0)
    // we also remove (destroyX,destroyY) from the map to try to constrain the path
    // from going a certain way from the start.
    // (We created this because the ghost's minimum distance direction is not always sufficient in procedural maps)
    var getShortestDistGraph = function(map,x0,y0,isNodeTile) {

        // build graph
        var graph = {};
        var x,y,i,j;
        for (y=0; y<36; y++) {
            for (x=0; x<28; x++) {
                if (isNodeTile(x,y)) {
                    i = x+y*28;
                    graph[i] = {'x':x, 'y':y, 'dist':Infinity, 'penult':undefined, 'neighbors':[], 'completed':false};
                    if (isNodeTile(x-1,y)) {
                        j = i-1;
                        graph[i].neighbors.push(graph[j]);
                        graph[j].neighbors.push(graph[i]);
                    }
                    if (isNodeTile(x,y-1)) {
                        j = i-28;
                        graph[i].neighbors.push(graph[j]);
                        graph[j].neighbors.push(graph[i]);
                    }
                }
            }
        }

        var node = graph[x0+y0*28];
        node.completed = true;
        node.dist = 0;
        var d;
        var next_node,min_dist,dist;
        while (true) {

            // update distances of current node's neighbors
            for (i=0; i<4; i++) {
                d = node.neighbors[i];
                if (d && !d.completed) {
                    dist = node.dist+1;
                    if (dist == d.dist) {
                        if (Math.random() < 0.5) {
                            d.penult = node;
                        }
                    }
                    else if (dist < d.dist) {
                        d.dist = dist;
                        d.penult = node;
                    }
                }
            }

            // find next node to process (closest fringe node)
            next_node = undefined;
            min_dist = Infinity;
            for (i=0; i<28*36; i++) {
                d = graph[i];
                if (d && !d.completed) {
                    if (d.dist < min_dist) { 
                        next_node = d;
                        min_dist = d.dist;
                    }
                }
            }

            if (!next_node) {
                break;
            }

            node = next_node;
            node.completed = true;
        }

        return graph;
    };

    // retrieves the direction enum from a node's penultimate node to itself.
    var getDirFromPenult = function(node) {
        if (!node.penult) {
            return undefined;
        }
        var dx = node.x - node.penult.x;
        var dy = node.y - node.penult.y;
        if (dy == -1) {
            return DIR_UP;
        }
        else if (dy == 1) {
            return DIR_DOWN;
        }
        else if (dx == -1) {
            return DIR_LEFT;
        }
        else if (dx == 1) {
            return DIR_RIGHT;
        }
    };

    // sometimes the ghosts can get stuck in loops when trying to return home
    // so we build a path from all tiles to the ghost door tile
    var makeExitPaths = function(map) {
        var isNodeTile = function(x,y) {
            if (x<0 || x>=28 || y<0 || y>=36) {
                return false;
            }
            return map.isFloorTile(x,y);
        };
        var graph = getShortestDistGraph(map,map.doorTile.x,map.doorTile.y,isNodeTile);

        // give the map a function that tells the ghost which direction to go to return home
        map.getExitDir = function(x,y) {
            if (x<0 || x>=28 || y<0 || y>=36) {
                return undefined;
            }
            var node = graph[x+y*28];
            var dirEnum = getDirFromPenult(node);
            if (dirEnum != undefined) {
                return rotateAboutFace(dirEnum); // reverse direction (door->ghost to door<-ghost)
            }
        };
    };

    // add fruit paths to a map
    var makeFruitPaths = (function(){
        var reversed = {
            'v':'^',
            '^':'v',
            '<':'>',
            '>':'<',
        };
        var reversePath = function(path) {
            var rpath = "";
            var i;
            for (i=path.length-1; i>=0; i--) {
                rpath += reversed[path[i]];
            }
            return rpath;
        };

        var dirChars = {};
        dirChars[DIR_UP] = '^';
        dirChars[DIR_DOWN] = 'v';
        dirChars[DIR_LEFT] = '<';
        dirChars[DIR_RIGHT] = '>';

        var getPathFromGraph = function(graph,x0,y0,x1,y1,reverse) {
            // from (x0,y0) to (x1,y1)
            var start_node = graph[x0+y0*28];
            var dx,dy;
            var path = "";
            var node;
            for (node=graph[x1+y1*28]; node!=start_node; node=node.penult) {
                path = dirChars[getDirFromPenult(node)] + path;
            }
            return reverse ? reversePath(path) : path;
        }

        return function(map) {

            paths = {entrances:[], exits:[]};

            var isFloorTile = function(x,y) {
                if (x<0 || x>=28 || y<0 || y>=36) {
                    return false
                }
                return map.isFloorTile(x,y);
            };

            enter_graph = getShortestDistGraph(map,15,20, function(x,y) { return (x==14 && y==20) ? false : isFloorTile(x,y); });
            exit_graph =  getShortestDistGraph(map,16,20, function(x,y) { return (x==17 && y==20) ? false : isFloorTile(x,y); });

            // start at (15,20)
            for (y=0; y<36; y++) {
                if (map.isFloorTile(-1,y)) {

                    // left entrance
                    paths.entrances.push({
                        'start': {'y':y*8+4, 'x': -4},
                        'path': '>'+getPathFromGraph(enter_graph, 15,20, 0,y, true)});

                    // right entrance
                    paths.entrances.push({
                        'start': {'y':y*8+4, 'x': 28*8+4},
                        'path': '<'+getPathFromGraph(enter_graph, 15,20, 27,y, true)});

                    // left exit
                    paths.exits.push({
                        'start': {'y':y*8+4, 'x': -4},
                        'path': getPathFromGraph(exit_graph, 16,20, 0,y, false)+'<'});

                    // right exit
                    paths.exits.push({
                        'start': {'y':y*8+4, 'x': 28*8+4},
                        'path': getPathFromGraph(exit_graph, 16,20, 27,y, false)+'>'});
                }
            }

            map.fruitPaths = paths;
        };
    })();

    return function() {
        genRandom();
        var map = new Map(28,36,getTiles());

        makeFruitPaths(map);
        makeExitPaths(map);

        map.name = "Random Map";
        map.wallFillColor = randomColor();
        map.wallStrokeColor = rgbString(hslToRgb(Math.random(), Math.random(), Math.random() * 0.4 + 0.6));
        map.pelletColor = "#ffb8ae";

        return map;
    };
})();
//@line 1 "src/atlas.js"

var atlas = (function(){

    var canvas,ctx;
    var size = 22;
    var cols = 14; // has to be ONE MORE than intended to fix some sort of CHROME BUG (last cell always blank?)
    var rows = 22;

    var creates = 0;

    var drawGrid = function() {
        // draw grid overlay
        var canvas = document.getElementById('gridcanvas');
        if (!canvas) {
            return;
        }
        var w = size*cols*renderScale;
        var h = size*rows*renderScale;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,w,h);
        var x,y;
        var step = size*renderScale;
        ctx.beginPath();
        for (x=0; x<=w; x+=step) {
            ctx.moveTo(x,0);
            ctx.lineTo(x,h);
        }
        for (y=0; y<=h; y+=step) {
            ctx.moveTo(0,y);
            ctx.lineTo(w,y);
        }
        ctx.lineWidth = "1px";
        ctx.lineCap = "square";
        ctx.strokeStyle="rgba(255,255,255,0.5)";
        ctx.stroke();
    };

    var create = function() {
        drawGrid();
        canvas = document.getElementById('atlas');
        ctx = canvas.getContext("2d");
        /*
        canvas.style.left = 0;
        canvas.style.top = 0;
        canvas.style.position = "absolute";
        */

        var w = size*cols*renderScale;
        var h = size*rows*renderScale;
        canvas.width = w;
        canvas.height = h;

        if (creates > 0) {
            ctx.restore();
        }
        creates++;

        ctx.save();
        ctx.clearRect(0,0,w,h);
        ctx.scale(renderScale,renderScale);

        var drawAtCell = function(f,row,col) {
            var x = col*size + size/2;
            var y = row*size + size/2;
            f(x,y);
        };

        var row = 0;
        drawAtCell(function(x,y) { drawCherry(ctx,x,y); },      row,0);
        drawAtCell(function(x,y) { drawStrawberry(ctx,x,y); },  row,1);
        drawAtCell(function(x,y) { drawOrange(ctx,x,y); },      row,2);
        drawAtCell(function(x,y) { drawApple(ctx,x,y); },       row,3);
        drawAtCell(function(x,y) { drawMelon(ctx,x,y); },       row,4);
        drawAtCell(function(x,y) { drawGalaxian(ctx,x,y); },    row,5);
        drawAtCell(function(x,y) { drawBell(ctx,x,y); },        row,6);
        drawAtCell(function(x,y) { drawKey(ctx,x,y); },         row,7);
        drawAtCell(function(x,y) { drawPretzel(ctx,x,y); },     row,8);
        drawAtCell(function(x,y) { drawPear(ctx,x,y); },        row,9);
        drawAtCell(function(x,y) { drawBanana(ctx,x,y); },      row,10);
        drawAtCell(function(x,y) { drawCookie(ctx,x,y); },      row,11);
        drawAtCell(function(x,y) { drawCookieFlash(ctx,x,y); },      row,12);

        var drawGhostCells = function(row,color) {
            var i,f;
            var col = 0;
            for (i=0; i<4; i++) { // dirEnum
                for (f=0; f<2; f++) { // frame
                    drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, f, i, false, false, false, color); },   row,col);
                    col++;
                }
            }
        };

        row++;
        drawGhostCells(row, "#FF0000");
        row++;
        drawGhostCells(row, "#FFB8FF");
        row++;
        drawGhostCells(row, "#00FFFF");
        row++;
        drawGhostCells(row, "#FFB851");

        row++;
        // draw disembodied eyes
        (function(){
            var i;
            var col = 0;
            for (i=0; i<4; i++) { // dirEnum
                drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, 0, i, false, false, true, "#fff"); },     row,col);
                col++;
            }
        })();

        // draw ghosts scared
        drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, 0, DIR_UP, true, false, false, "#fff"); }, row,4);
        drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, 1, DIR_UP, true, false, false, "#fff"); }, row,5);
        drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, 0, DIR_UP, true, true, false, "#fff"); },  row,6);
        drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, 1, DIR_UP, true, true, false, "#fff"); },  row,7);

        var drawPacCells = function(row,col,dir) {
            drawAtCell(function(x,y) { drawPacmanSprite(ctx, x,y, dir, Math.PI/6); }, row, col);
            drawAtCell(function(x,y) { drawPacmanSprite(ctx, x,y, dir, Math.PI/3); }, row, col+1);
        };
        row++;

        // draw pacman mouth closed
        drawAtCell(function(x,y) { drawPacmanSprite(ctx, x,y, DIR_RIGHT, 0); }, row, 0);

        // draw pacman directions
        (function(){
            var i;
            var col=1;
            for (i=0; i<4; i++) {
                drawPacCells(row,col,i);
                col+=2;
            }
        })();

        var drawMsPacCells = function(row,col,dir) {
            drawAtCell(function(x,y) { drawMsPacmanSprite(ctx, x,y, dir, 0); }, row, col);
            drawAtCell(function(x,y) { drawMsPacmanSprite(ctx, x,y, dir, 1); }, row, col+1);
            drawAtCell(function(x,y) { drawMsPacmanSprite(ctx, x,y, dir, 2); }, row, col+2);
        };
        row++;
        (function(){
            var i;
            var col=0;
            for (i=0; i<4; i++) {
                drawMsPacCells(row,col,i);
                col+=3;
            }
        })();

        var drawCookieCells = function(row,col,dir) {
            drawAtCell(function(x,y) { drawCookiemanSprite(ctx, x,y, dir, 0, true); }, row, col);
            drawAtCell(function(x,y) { drawCookiemanSprite(ctx, x,y, dir, 1, true); }, row, col+1);
            drawAtCell(function(x,y) { drawCookiemanSprite(ctx, x,y, dir, 2, true); }, row, col+2);
        };
        row++;
        (function(){
            var i;
            var col=0;
            for (i=0; i<4; i++) {
                drawCookieCells(row,col,i);
                col+=3;
            }
        })();

        var drawMonsterCells = function(row,color) {
            var i,f;
            var col=0;
            for (i=0; i<4; i++) { // dirEnum
                for (f=0; f<2; f++) { // frame
                    drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, f, i, false, false, false, color); },   row,col);
                    col++;
                }
            }
        };

        row++;
        drawMonsterCells(row, "#FF0000");
        row++;
        drawMonsterCells(row, "#FFB8FF");
        row++;
        drawMonsterCells(row, "#00FFFF");
        row++;
        drawMonsterCells(row, "#FFB851");

        row++;
        (function(){
            var i;
            var col = 0;
            for (i=0; i<4; i++) { // dirEnum
                drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, 0, i, false, false, true, "#fff"); },     row,col);
                col++;
            }
        })();
        drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, 0, DIR_UP, true, false, false, "#fff"); }, row,4);
        drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, 1, DIR_UP, true, false, false, "#fff"); }, row,5);
        drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, 0, DIR_UP, true, true, false, "#fff"); },  row,6);
        drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, 1, DIR_UP, true, true, false, "#fff"); },  row,7);

        var drawOttoCells = function(row,col,dir) {
            var i;
            for (i=0; i<4; i++) { // frame
                drawAtCell(function(x,y) { drawOttoSprite(ctx, x,y, dir, i); }, row, col);
                col++;
            }
        };
        row++;
        drawOttoCells(row,0, DIR_UP);
        drawOttoCells(row,4, DIR_RIGHT);
        row++;
        drawOttoCells(row,0, DIR_DOWN);
        drawOttoCells(row,4, DIR_LEFT);

        row++;
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 200, "#33ffff"); }, row, 0);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 400, "#33ffff"); }, row, 1);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 800, "#33ffff"); }, row, 2);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 1600, "#33ffff");}, row, 3);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 100, "#ffb8ff"); }, row, 4);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 300, "#ffb8ff"); }, row, 5);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 500, "#ffb8ff"); }, row, 6);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 700, "#ffb8ff"); }, row, 7);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 1000, "#ffb8ff"); }, row, 8);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 2000, "#ffb8ff"); }, row, 9);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 3000, "#ffb8ff"); }, row, 10);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 5000, "#ffb8ff"); }, row, 11);
        row++;
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 100, "#fff"); }, row, 0);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 200, "#fff"); }, row, 1);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 500, "#fff"); }, row, 2);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 700, "#fff"); }, row, 3);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 1000, "#fff"); }, row, 4);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 2000, "#fff"); }, row, 5);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 5000, "#fff"); }, row, 6);

        row++;
        drawAtCell(function(x,y) {
            drawSnail(ctx,x,y, "#0ff");
        }, row, 0);
        drawAtCell(function(x,y) {
            drawSnail(ctx,x,y, "#FFF");
        }, row, 1);

        var drawMsOttoCells = function(row,col,dir) {
            var i;
            for (i=0; i<4; i++) { // frame
                drawAtCell(function(x,y) { drawMsOttoSprite(ctx, x,y, dir, i); }, row, col);
                col++;
            }
        };
        row++;
        drawMsOttoCells(row,0, DIR_UP);
        drawMsOttoCells(row,4, DIR_RIGHT);
        row++;
        drawMsOttoCells(row,0, DIR_DOWN);
        drawMsOttoCells(row,4, DIR_LEFT);

    };

    var copyCellTo = function(row, col, destCtx, x, y,display) {
        var sx = col*size*renderScale;
        var sy = row*size*renderScale;
        var sw = renderScale*size;
        var sh = renderScale*size;

        var dx = x - size/2;
        var dy = y - size/2;
        var dw = size;
        var dh = size;

        if (display) {
            console.log(sx,sy,sw,sh,dw,dy,dw,dh);
        }

        destCtx.drawImage(canvas,sx,sy,sw,sh,dx,dy,dw,dh);
    };

    var copyGhostPoints = function(destCtx,x,y,points) {
        var row = 16;
        var col = {
            200: 0,
            400: 1,
            800: 2,
            1600: 3,
        }[points];
        if (col != undefined) {
            copyCellTo(row, col, destCtx, x, y);
        }
    };

    var copyPacFruitPoints = function(destCtx,x,y,points) {
        var row = 16;
        var col = {
            100: 4,
            300: 5,
            500: 6,
            700: 7,
            1000: 8,
            2000: 9,
            3000: 10,
            5000: 11,
        }[points];
        if (col != undefined) {
            copyCellTo(row, col, destCtx, x, y);
        }
    };

    var copyMsPacFruitPoints = function(destCtx,x,y,points) {
        var row = 17;
        var col = {
            100: 0,
            200: 1,
            500: 2,
            700: 3,
            1000: 4,
            2000: 5,
            5000: 6,
        }[points];
        if (col != undefined) {
            copyCellTo(row, col, destCtx, x, y);
        }
    };

    var copyGhostSprite = function(destCtx,x,y,frame,dirEnum,scared,flash,eyes_only,color) {
        var row,col;
        if (eyes_only) {
            row = 5;
            col = dirEnum;
        }
        else if (scared) {
            row = 5;
            col = flash ? 6 : 4;
            col += frame;
        }
        else {
            col = dirEnum*2 + frame;
            if (color == blinky.color) {
                row = 1;
            }
            else if (color == pinky.color) {
                row = 2;
            }
            else if (color == inky.color) {
                row = 3;
            }
            else if (color == clyde.color) {
                row = 4;
            }
            else {
                row = 5;
            }
        }

        copyCellTo(row, col, destCtx, x, y);
    };

    var copyMuppetSprite = function(destCtx,x,y,frame,dirEnum,scared,flash,eyes_only,color) {
        if (scared) {
            if (flash) {
                copyFruitSprite(destCtx,x,y,"cookieface");
            }
            else {
                copyFruitSprite(destCtx,x,y,"cookie");
            }
        }
        else {
            copyGhostSprite(destCtx,x,y,frame,dirEnum,scared,flash,eyes_only,color);
        }
    };

    var copyMonsterSprite = function(destCtx,x,y,frame,dirEnum,scared,flash,eyes_only,color) {
        var row,col;
        if (eyes_only) {
            row = 13;
            col = dirEnum;
        }
        else if (scared) {
            row = 13;
            col = flash ? 6 : 4;
            col += frame;
        }
        else {
            col = dirEnum*2 + frame;
            if (color == blinky.color) {
                row = 9;
            }
            else if (color == pinky.color) {
                row = 10;
            }
            else if (color == inky.color) {
                row = 11;
            }
            else if (color == clyde.color) {
                row = 12;
            }
            else {
                row = 13;
            }
        }

        copyCellTo(row, col, destCtx, x, y);
    };

    var copyOttoSprite = function(destCtx,x,y,dirEnum,frame) {
        var col,row;
        if (dirEnum == DIR_UP) {
            col = frame;
            row = 14;
        }
        else if (dirEnum == DIR_RIGHT) {
            col = frame+4;
            row = 14;
        }
        else if (dirEnum == DIR_DOWN) {
            col = frame;
            row = 15;
        }
        else if (dirEnum == DIR_LEFT) {
            col = frame+4;
            row = 15;
        }
        copyCellTo(row,col,destCtx,x,y);
    };

    var copyMsOttoSprite = function(destCtx,x,y,dirEnum,frame) {
        var col,row;
        if (dirEnum == DIR_UP) {
            col = frame;
            row = 19;
        }
        else if (dirEnum == DIR_RIGHT) {
            col = frame+4;
            row = 19;
        }
        else if (dirEnum == DIR_DOWN) {
            col = frame;
            row = 20;
        }
        else if (dirEnum == DIR_LEFT) {
            col = frame+4;
            row = 20;
        }
        copyCellTo(row,col,destCtx,x,y);
    };

    var copySnail = function(destCtx,x,y,frame) {
        var row = 18;
        var col = frame;
        copyCellTo(row,col,destCtx,x,y);
    };

    var copyPacmanSprite = function(destCtx,x,y,dirEnum,frame) {
        var row = 6;
        var col;
        if (frame == 0) {
            col = 0;
        }
        else {
           col = dirEnum*2+1+(frame-1);
        }
        copyCellTo(row,col,destCtx,x,y);
    };

    var copyMsPacmanSprite = function(destCtx,x,y,dirEnum,frame) {
        // TODO: determine row, col
        //copyCellTo(row,col,destCtx,x,y);
        var row = 7;
        var col = dirEnum*3+frame;
        copyCellTo(row,col,destCtx,x,y);
    };

    var copyCookiemanSprite = function(destCtx,x,y,dirEnum,frame) {
        var row = 8;
        var col = dirEnum*3+frame;
        copyCellTo(row,col,destCtx,x,y);
    };

    var copyFruitSprite = function(destCtx,x,y,name) {
        var row = 0;
        var col = {
            "cherry": 0,
            "strawberry": 1,
            "orange": 2,
            "apple": 3,
            "melon": 4,
            "galaxian": 5,
            "bell": 6,
            "key": 7,
            "pretzel": 8,
            "pear": 9,
            "banana": 10,
            "cookie": 11,
            "cookieface": 12,
        }[name];

        copyCellTo(row,col,destCtx,x,y);
    };

    return {
        create: create,
        getCanvas: function() { return canvas; },
        drawGhostSprite: copyGhostSprite,
        drawMonsterSprite: copyMonsterSprite,
        drawMuppetSprite: copyMuppetSprite,
        drawOttoSprite: copyOttoSprite,
        drawMsOttoSprite: copyMsOttoSprite,
        drawPacmanSprite: copyPacmanSprite,
        drawMsPacmanSprite: copyMsPacmanSprite,
        drawCookiemanSprite: copyCookiemanSprite,
        drawFruitSprite: copyFruitSprite,
        drawGhostPoints: copyGhostPoints,
        drawPacFruitPoints: copyPacFruitPoints,
        drawMsPacFruitPoints: copyMsPacFruitPoints,
        drawSnail: copySnail,
    };
})();
//@line 1 "src/renderers.js"
//////////////////////////////////////////////////////////////
// Renderers

// Draws everything in the game using swappable renderers
// to enable to different front-end displays for Pac-Man.

// list of available renderers
var renderer_list;

// current renderer
var renderer;

var renderScale;

// color of the maze wall outlines (applies to every map / level)
var WALL_OUTLINE_COLOR = "#00ff00";

var mapMargin = 4*tileSize; // margin between the map and the screen
var mapPad = tileSize/8; // padding between the map and its clipping

var mapWidth = 28*tileSize+mapPad*2;
var mapHeight = 36*tileSize+mapPad*2;

var screenWidth = mapWidth+mapMargin*2;
var screenHeight = mapHeight+mapMargin*2;

// all rendering will be shown on this canvas
var canvas;

// switch to the given renderer index
var switchRenderer = function(i) {
    renderer = renderer_list[i];
    renderer.drawMap();
};

// horizontal space reserved for the hash-map legend on the left (0 if it is hidden)
var getLegendWidth = function() {
    return (typeof legend != "undefined") ? legend.getReservedWidth() : 0;
};

var getDevicePixelRatio = function() {
    // Only consider the device pixel ratio for devices that are <= 320 pixels in width.
    // This is necessary for the iPhone4's retina display; otherwise the game would be blurry.
    // The iPad3's retina display @ 2048x1536 starts slowing the game down.
    return 1;
    if (window.innerWidth <= 320) {
        return window.devicePixelRatio || 1;
    }
    return 1;
};

var initRenderer = function(){

    var bgCanvas;
    var ctx, bgCtx;

    // drawing scale
    var scale = 2;        // scale everything by this amount

    // (temporary global version of scale just to get things quickly working)
    renderScale = scale; 

    var resets = 0;

    // rescale the canvases
    var resetCanvasSizes = function() {

        // set the size of the canvas in actual pixels
        canvas.width = screenWidth * scale;
        canvas.height = screenHeight * scale;

        // set the size of the canvas in browser pixels
        var ratio = getDevicePixelRatio();
        canvas.style.width = canvas.width / ratio;
        canvas.style.height = canvas.height / ratio;

        if (resets > 0) {
            ctx.restore();
        }
        ctx.save();
        ctx.scale(scale,scale);

        bgCanvas.width = mapWidth * scale;
        bgCanvas.height = mapHeight * scale;
        if (resets > 0) {
            bgCtx.restore();
        }
        bgCtx.save();
        bgCtx.scale(scale,scale);

        resets++;
    };

    // get the target scale that will cause the canvas to fit the window
    var getTargetScale = function() {
        var sx = (window.innerWidth - 10 - getLegendWidth()) / screenWidth;
        var sy = (window.innerHeight - 10) / screenHeight;
        var s = Math.min(sx,sy);
        s *= getDevicePixelRatio();
        return s;
    };

    // maximize the scale to fit the window
    var fullscreen = function() {
        // NOTE: css-scaling alternative at https://gist.github.com/1184900
        renderScale = scale = getTargetScale();
        resetCanvasSizes();
        atlas.create();
        if (renderer) {
            renderer.drawMap();
        }
        center();
    };

    // center the canvas in the window
    var center = function() {
        var s = getTargetScale()/getDevicePixelRatio();
        var w = screenWidth*s;
        var x = Math.max(0,(window.innerWidth-10)/2 - w/2);
        var y = 0;
        /*
        canvas.style.position = "absolute";
        canvas.style.left = x;
        canvas.style.top = y;
        console.log(canvas.style.left);
        */
        // center the maze in the space to the right of the legend panel
        var lw = getLegendWidth();
        document.body.style.marginLeft = (lw + (window.innerWidth - lw - w)/2) + "px";
    };

    // create foreground and background canvases
    canvas = document.getElementById('canvas');
    bgCanvas = document.createElement('canvas');
    ctx = canvas.getContext("2d");
    bgCtx = bgCanvas.getContext("2d");

    // initialize placement and size
    fullscreen();

    // adapt placement and size to window resizes
    var resizeTimeout;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(fullscreen, 100);
    }, false);

    //////////////////////

    var beginMapFrame = function() {
        bgCtx.fillStyle = "#000";
        bgCtx.fillRect(0,0,mapWidth,mapHeight);
        bgCtx.translate(mapPad, mapPad);
    };

    var endMapFrame = function() {
        bgCtx.translate(-mapPad, -mapPad);
    };

    //////////////////////////////////////////////////////////////
    // Common Renderer
    // (attributes and functionality that are currently common to all renderers)

    // constructor
    var CommonRenderer = function() {
        this.actorSize = (tileSize-1)*2;
        this.energizerSize = tileSize+2;
        this.pointsEarnedTextSize = tileSize;

        this.energizerColor = "#FFF";
        this.pelletColor = "#888";

        this.flashLevel = false;
    };

    CommonRenderer.prototype = {

        setOverlayColor: function(color) {
            this.overlayColor = color;
        },

        // power-up orbs, effect rings, and effect labels
        drawPowerupOrbs: function() {
            powerups.drawOrbs(ctx);
        },
        drawPowerupViruses: function() {
            powerups.drawViruses(ctx);
        },
        drawPowerupAuras: function() {
            powerups.drawAuras(ctx);
        },
        drawPowerupHud: function() {
            powerups.drawHud(ctx);
        },

        beginMapClip: function() {
            ctx.save();
            ctx.beginPath();

            // subtract one from size due to shift done for sprite realignment?
            // (this fixes a bug that leaves unerased artifacts after actors use right-side tunnel
            ctx.rect(-mapPad,-mapPad,mapWidth-1,mapHeight-1); 

            ctx.clip();
        },

        endMapClip: function() {
            ctx.restore();
        },

        beginFrame: function() {
            this.setOverlayColor(undefined);
            ctx.save();

            // clear margin area
            ctx.fillStyle = "#000";
            (function(w,h,p){
                ctx.fillRect(0,0,w,p+1);
                ctx.fillRect(0,p,p,h-2*p);
                ctx.fillRect(w-p-2,p,p+2,h-2*p);
                ctx.fillRect(0,h-p-2,w,p+2);
            })(screenWidth, screenHeight, mapMargin);

            // draw fps
            if (DEBUG) {
                ctx.font = (tileSize-2) + "px ArcadeR";
                ctx.textBaseline = "bottom";
                ctx.textAlign = "right";
                ctx.fillStyle = "#333";
                ctx.fillText(Math.floor(executive.getFps())+" FPS", screenWidth, screenHeight);
            }

            // translate to map space
            ctx.translate(mapMargin+mapPad, mapMargin+mapPad);
        },

        endFrame: function() {
            ctx.restore();
            if (this.overlayColor != undefined) {
                ctx.fillStyle = this.overlayColor;
                ctx.fillRect(0,0,screenWidth,screenHeight);
            }
        },

        clearMapFrame: function() {
            ctx.fillStyle = "#000";
            ctx.fillRect(-1,-1,mapWidth+1,mapHeight+1);
        },

        renderFunc: function(f,that) {
            if (that) {
                f.call(that,ctx);
            }
            else {
                f(ctx);
            }
        },

        // scaling the canvas can incur floating point roundoff errors
        // which manifest as "grout" between tiles that are otherwise adjacent in integer-space
        // This function extends the width and height of the tile if it is adjacent to equivalent tiles
        // that are to the bottom or right of the given tile
        drawNoGroutTile: function(ctx,x,y,w) {
            var tileChar = map.getTile(x,y);
            this.drawCenterTileSq(ctx,x,y,tileSize,
                    map.getTile(x+1,y) == tileChar,
                    map.getTile(x,y+1) == tileChar,
                    map.getTile(x+1,y+1) == tileChar);
        },

        // draw square centered at the given tile with optional "floating point grout" filling
        drawCenterTileSq: function (ctx,tx,ty,w, rightGrout, downGrout, downRightGrout) {
            this.drawCenterPixelSq(ctx, tx*tileSize+midTile.x, ty*tileSize+midTile.y,w,
                    rightGrout, downGrout, downRightGrout);
        },

        // draw square centered at the given pixel
        drawCenterPixelSq: function (ctx,px,py,w,rightGrout, downGrout, downRightGrout) {
            ctx.fillRect(px-w/2, py-w/2,w,w);

            // fill "floating point grout" gaps between tiles
            var gap = 1;
            if (rightGrout) ctx.fillRect(px-w/2, py-w/2,w+gap,w);
            if (downGrout) ctx.fillRect(px-w/2, py-w/2,w,w+gap);
            //if (rightGrout && downGrout && downRightGrout) ctx.fillRect(px-w/2, py-w/2,w+gap,w+gap);
        },

        // this flag is used to flash the level upon its successful completion
        toggleLevelFlash: function () {
            this.flashLevel = !this.flashLevel;
        },

        setLevelFlash: function(on) {
            if (on != this.flashLevel) {
                this.flashLevel = on;
                this.drawMap();
            }
        },

        // draw the target visualizers for each actor
        drawTargets: function() {
            var i;
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineWidth = "1.5";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            for (i=0;i<5;i++)
                if (actors[i].isDrawTarget)
                    actors[i].drawTarget(ctx);
        },

        drawPaths: function() {
            var backupAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.7;
            var i;
            for (i=0;i<5;i++)
                if (actors[i].isDrawPath)
                    this.drawPath(actors[i]);
            ctx.globalAlpha = backupAlpha;
        },

        // draw a predicted path for the actor if it continues pursuing current target
        drawPath: function(actor) {
            if (!actor.targetting) return;

            // current state of the predicted path
            var tile = { x: actor.tile.x, y: actor.tile.y};
            var target = actor.targetTile;
            var dir = { x: actor.dir.x, y: actor.dir.y };
            var dirEnum = actor.dirEnum;
            var openTiles;

            // exit if we're already on the target
            if (tile.x == target.x && tile.y == target.y) {
                return;
            }

            // if we are past the center of the tile, we cannot turn here anymore, so jump to next tile
            if ((dirEnum == DIR_UP && actor.tilePixel.y <= midTile.y) ||
                (dirEnum == DIR_DOWN && actor.tilePixel.y >= midTile.y) ||
                (dirEnum == DIR_LEFT && actor.tilePixel.x <= midTile.x) ||
                (dirEnum == DIR_RIGHT & actor.tilePixel.x >= midTile.x)) {
                tile.x += dir.x;
                tile.y += dir.y;
            }
            var pixel = { x:tile.x*tileSize+midTile.x, y:tile.y*tileSize+midTile.y };
            
            // dist keeps track of how far we're going along this path, stopping at maxDist
            // distLeft determines how long the last line should be
            var dist = Math.abs(tile.x*tileSize+midTile.x - actor.pixel.x + tile.y*tileSize+midTile.y - actor.pixel.y);
            var maxDist = actorPathLength*tileSize;
            var distLeft;
            
            // add the first line
            ctx.strokeStyle = actor.pathColor;
            ctx.lineWidth = "2.0";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(
                    actor.pixel.x+actor.pathCenter.x,
                    actor.pixel.y+actor.pathCenter.y);
            ctx.lineTo(
                    pixel.x+actor.pathCenter.x,
                    pixel.y+actor.pathCenter.y);

            if (tile.x == target.x && tile.y == target.y) {
                // adjust the distance left to create a smoothly interpolated path end
                distLeft = actor.getPathDistLeft(pixel, dirEnum);
            }
            else while (true) {

                // predict next turn from current tile
                openTiles = getOpenTiles(tile, dirEnum);
                if (actor != pacman && map.constrainGhostTurns)
                    map.constrainGhostTurns(tile, openTiles, dirEnum);
                dirEnum = getTurnClosestToTarget(tile, target, openTiles);
                setDirFromEnum(dir,dirEnum);
                
                // if the next tile is our target, determine how mush distance is left and break loop
                if (tile.x+dir.x == target.x && tile.y+dir.y == target.y) {
                
                    // adjust the distance left to create a smoothly interpolated path end
                    distLeft = actor.getPathDistLeft(pixel, dirEnum);

                    // cap distance left
                    distLeft = Math.min(maxDist-dist, distLeft);

                    break;
                }
                
                // exit if we're going past the max distance
                if (dist + tileSize > maxDist) {
                    distLeft = maxDist - dist;
                    break;
                }

                // move to next tile and add a line to its center
                tile.x += dir.x;
                tile.y += dir.y;
                pixel.x += tileSize*dir.x;
                pixel.y += tileSize*dir.y;
                dist += tileSize;
                ctx.lineTo(
                        tile.x*tileSize+midTile.x+actor.pathCenter.x,
                        tile.y*tileSize+midTile.y+actor.pathCenter.y);
            }

            // calculate final endpoint
            var px = pixel.x+actor.pathCenter.x+distLeft*dir.x;
            var py = pixel.y+actor.pathCenter.y+distLeft*dir.y;

            // add an arrow head
            ctx.lineTo(px,py);
            var s = 3;
            if (dirEnum == DIR_LEFT || dirEnum == DIR_RIGHT) {
                ctx.lineTo(px-s*dir.x,py+s*dir.x);
                ctx.moveTo(px,py);
                ctx.lineTo(px-s*dir.x,py-s*dir.x);
            }
            else {
                ctx.lineTo(px+s*dir.y,py-s*dir.y);
                ctx.moveTo(px,py);
                ctx.lineTo(px-s*dir.y,py-s*dir.y);
            }

            // draw path    
            ctx.stroke();
        },

        // erase pellet from background
        erasePellet: function(x,y) {
            bgCtx.translate(mapPad,mapPad);
            bgCtx.fillStyle = this.floorColor;
            this.drawNoGroutTile(bgCtx,x,y,tileSize);

            // fill in adjacent floor tiles
            if (map.getTile(x+1,y)==' ') this.drawNoGroutTile(bgCtx,x+1,y,tileSize);
            if (map.getTile(x-1,y)==' ') this.drawNoGroutTile(bgCtx,x-1,y,tileSize);
            if (map.getTile(x,y+1)==' ') this.drawNoGroutTile(bgCtx,x,y+1,tileSize);
            if (map.getTile(x,y-1)==' ') this.drawNoGroutTile(bgCtx,x,y-1,tileSize);

            // TODO: fill in adjacent wall tiles?

            bgCtx.translate(-mapPad,-mapPad);
        },

        // draw a center screen message (e.g. "start", "ready", "game over")
        drawMessage: function(text, color, x,y) {
            ctx.font = tileSize + "px ArcadeR";
            ctx.textBaseline = "top";
            ctx.textAlign = "right";
            ctx.fillStyle = color;
            x += text.length;
            ctx.fillText(text, x*tileSize, y*tileSize);
        },

        drawReadyMessage: function() {
            this.drawMessage("READY ","#FF0",11,20);
            drawExclamationPoint(ctx,16*tileSize+3, 20*tileSize+3);
        },

        // draw the points earned from the most recently eaten ghost
        drawEatenPoints: function() {
            atlas.drawGhostPoints(ctx, pacman.pixel.x, pacman.pixel.y, energizer.getPoints());
        },

        // draw each actor (ghosts and pacman)
        drawActors: function() {
            var i;
            // draw such that pacman appears on top
            if (energizer.isActive()) {
                for (i=0; i<4; i++) {
                    this.drawGhost(ghosts[i]);
                }
                if (!energizer.showingPoints())
                    this.drawPlayer();
                else
                    this.drawEatenPoints();
            }
            // draw such that pacman appears on bottom
            else {
                this.drawPlayer();
                for (i=3; i>=0; i--) {
                    if (ghosts[i].isVisible) {
                        this.drawGhost(ghosts[i]);
                    }
                }
                if (inky.isVisible && !blinky.isVisible) {
                    this.drawGhost(blinky,0.5);
                }
            }
        },

    };

    //////////////////////////////////////////////////////////////
    // Simple Renderer
    // (render a minimal Pac-Man display using nothing but squares)

    // constructor
    var SimpleRenderer = function() {

        // inherit attributes from Common Renderer
        CommonRenderer.call(this,ctx,bgCtx);

        this.messageRow = 21.7;
        this.pointsEarnedTextSize = 1.5*tileSize;

        this.backColor = "#222";
        this.floorColor = "#444";
        this.flashFloorColor = "#999";

        this.name = "Minimal";
    };

    SimpleRenderer.prototype = newChildObject(CommonRenderer.prototype, {

        drawMap: function() {

            beginMapFrame();

            var x,y;
            var i;
            var tile;

            // draw floor tiles
            bgCtx.fillStyle = (this.flashLevel ? this.flashFloorColor : this.floorColor);
            i=0;
            for (y=0; y<map.numRows; y++)
            for (x=0; x<map.numCols; x++) {
                tile = map.currentTiles[i++];
                if (tile == ' ')
                    this.drawNoGroutTile(bgCtx,x,y,tileSize);
            }

            // draw pellet tiles
            bgCtx.fillStyle = this.pelletColor;
            i=0;
            for (y=0; y<map.numRows; y++)
            for (x=0; x<map.numCols; x++) {
                tile = map.currentTiles[i++];
                if (tile == '.')
                    this.drawNoGroutTile(bgCtx,x,y,tileSize);
            }

            endMapFrame();
        },

        refreshPellet: function(x,y) {
            var i = map.posToIndex(x,y);
            var tile = map.currentTiles[i];
            if (tile == ' ') {
                this.erasePellet(x,y);
            }
            else if (tile == '.') {
                bgCtx.fillStyle = this.pelletColor;
                this.drawNoGroutTile(bgCtx,x,y,tileSize);
            }
        },


        // draw the current score and high score
        drawScore: function() {
            ctx.font = 1.5*tileSize + "px sans-serif";
            ctx.textBaseline = "top";
            ctx.textAlign = "left";
            ctx.fillStyle = "#FFF";
            ctx.fillText(getScore(), tileSize, tileSize*2);

            ctx.font = "bold " + 1.5*tileSize + "px sans-serif";
            ctx.textBaseline = "top";
            ctx.textAlign = "center";
            ctx.fillText("high score", tileSize*map.numCols/2, 3);
            ctx.fillText(getHighScore(), tileSize*map.numCols/2, tileSize*2);
        },

        // draw the extra lives indicator
        drawExtraLives: function() {
            var i;
            ctx.fillStyle = "rgba(255,255,0,0.6)";
            var lives = extraLives == Infinity ? 1 : extraLives;
            for (i=0; i<extraLives; i++)
                this.drawCenterPixelSq(ctx, (2*i+3)*tileSize, (map.numRows-2)*tileSize+midTile.y,this.actorSize);
        },

        // draw the current level indicator
        drawLevelIcons: function() {
            var i;
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            var w = 2;
            var h = this.actorSize;
            for (i=0; i<level; i++)
                ctx.fillRect((map.numCols-2)*tileSize - i*2*w, (map.numRows-2)*tileSize+midTile.y-h/2, w, h);
        },

        // draw energizer items on foreground
        drawEnergizers: function() {
            ctx.fillStyle = this.energizerColor;
            var e;
            var i;
            for (i=0; i<map.numEnergizers; i++) {
                e = map.energizers[i];
                if (map.currentTiles[e.x+e.y*map.numCols] == 'o')
                    this.drawCenterTileSq(ctx,e.x,e.y,this.energizerSize);
            }
        },

        // draw pacman
        drawPlayer: function(scale, opacity) {
            if (scale == undefined) scale = 1;
            if (opacity == undefined) opacity = 1;
            ctx.fillStyle = "rgba(255,255,0,"+opacity+")";
            this.drawCenterPixelSq(ctx, pacman.pixel.x, pacman.pixel.y, this.actorSize*scale);
        },

        // draw dying pacman animation (with 0<=t<=1)
        drawDyingPlayer: function(t) {
            var f = t*85;
            if (f <= 60) {
                t = f/60;
                this.drawPlayer(1-t);
            }
            else {
                f -= 60;
                t = f/15;
                this.drawPlayer(t,1-t);
            }
        },

        // draw ghost
        drawGhost: function(g) {
            if (g.mode == GHOST_EATEN)
                return;
            var color = g.color;
            if (g.scared)
                color = energizer.isFlash() ? "#FFF" : "#2121ff";
            else if (g.mode == GHOST_GOING_HOME || g.mode == GHOST_ENTERING_HOME)
                color = "rgba(255,255,255,0.3)";
            ctx.fillStyle = color;
            this.drawCenterPixelSq(ctx, g.pixel.x, g.pixel.y, this.actorSize);
        },

        drawFruit: function() {
            if (fruit.isPresent()) {
                ctx.fillStyle = "#0F0";
                this.drawCenterPixelSq(ctx, fruit.pixel.x, fruit.pixel.y, tileSize+2);
            }
            else if (fruit.isScorePresent()) {
                ctx.font = this.pointsEarnedTextSize + "px sans-serif";
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
                ctx.fillStyle = "#FFF";
                ctx.fillText(fruit.getPoints(), fruit.pixel.x, fruit.pixel.y);
            }
        },

    });


    //////////////////////////////////////////////////////////////
    // Arcade Renderer
    // (render a display close to the original arcade)

    // constructor
    var ArcadeRenderer = function(ctx,bgCtx) {

        // inherit attributes from Common Renderer
        CommonRenderer.call(this,ctx,bgCtx);

        this.messageRow = 20;
        this.pelletSize = 2;
        this.energizerSize = tileSize;

        this.backColor = "#000";
        this.floorColor = "#000";
        this.flashWallColor = "#FFF";

        this.name = "Arcade";
    };

    ArcadeRenderer.prototype = newChildObject(CommonRenderer.prototype, {

        // copy background canvas to the foreground canvas
        blitMap: function() {
            ctx.scale(1/scale,1/scale);
            ctx.drawImage(bgCanvas,-1-mapPad*scale,-1-mapPad*scale); // offset map to compenstate for misalignment
            ctx.scale(scale,scale);
            //ctx.clearRect(-mapPad,-mapPad,mapWidth,mapHeight);
        },

        drawMap: function(isCutscene) {

            // fill background
            beginMapFrame();

            if (map) {

                // Sometimes pressing escape during a flash can cause flash to be permanently enabled on maps.
                // so just turn it off when not in the finish state.
                if (state != finishState) {
                    this.flashLevel = false;
                }

                var x,y;
                var i,j;
                var tile;

                // ghost house door
                i=0;
                for (y=0; y<map.numRows; y++)
                for (x=0; x<map.numCols; x++) {
                    if (map.currentTiles[i] == '-' && map.currentTiles[i+1] == '-') {
                        bgCtx.fillStyle = "#ffb8de";
                        bgCtx.fillRect(x*tileSize,y*tileSize+tileSize-2,tileSize*2,2);
                    }
                    i++;
                }

                if (this.flashLevel) {
                    bgCtx.fillStyle = "#000";
                    bgCtx.strokeStyle = "#fff";
                }
                else {
                    bgCtx.fillStyle = map.wallFillColor;
                    bgCtx.strokeStyle = WALL_OUTLINE_COLOR;
                }
                for (i=0; i<map.paths.length; i++) {
                    var path = map.paths[i];
                    bgCtx.beginPath();
                    bgCtx.moveTo(path[0].x, path[0].y);
                    for (j=1; j<path.length; j++) {
                        if (path[j].cx != undefined)
                            bgCtx.quadraticCurveTo(path[j].cx, path[j].cy, path[j].x, path[j].y);
                        else
                            bgCtx.lineTo(path[j].x, path[j].y);
                    }
                    bgCtx.quadraticCurveTo(path[j-1].x, path[0].y, path[0].x, path[0].y);
                    bgCtx.fill();
                    bgCtx.stroke();
                }

                // draw pellet tiles
                bgCtx.fillStyle = map.pelletColor;
                i=0;
                for (y=0; y<map.numRows; y++)
                for (x=0; x<map.numCols; x++) {
                    this.refreshPellet(x,y,true);
                }

                if (map.onDraw) {
                    map.onDraw(bgCtx);
                }

                if (map.shouldDrawMapOnly) {
                    endMapFrame();
                    return;
                }
            }
            if (level > 0) {

                var numRows = 36;
                var numCols = 28;

                if (!isCutscene) {
                    // draw extra lives
                    var i;
                    bgCtx.fillStyle = pacman.color;

                    bgCtx.save();
                    bgCtx.translate(3*tileSize, (numRows-1)*tileSize);
                    bgCtx.scale(0.85, 0.85);
                    var lives = extraLives == Infinity ? 1 : extraLives;
                    if (gameMode == GAME_PACMAN) {
                        for (i=0; i<lives; i++) {
                            drawPacmanSprite(bgCtx, 0,0, DIR_LEFT, Math.PI/6);
                            bgCtx.translate(2*tileSize,0);
                        }
                    }
                    else if (gameMode == GAME_MSPACMAN) {
                        for (i=0; i<lives; i++) {
                            drawMsPacmanSprite(bgCtx, 0,0, DIR_RIGHT, 1);
                            bgCtx.translate(2*tileSize,0);
                        }
                    }
                    else if (gameMode == GAME_COOKIE) {
                        for (i=0; i<lives; i++) {
                            drawCookiemanSprite(bgCtx, 0,0, DIR_RIGHT, 1, false);
                            bgCtx.translate(2*tileSize,0);
                        }
                    }
                    else if (gameMode == GAME_OTTO) {
                        for (i=0; i<lives; i++) {
                            drawOttoSprite(bgCtx, 0,0,DIR_RIGHT, 0);
                            bgCtx.translate(2*tileSize,0);
                        }
                    }
                    if (extraLives == Infinity) {
                        bgCtx.translate(-4*tileSize,0);

                        // draw X
                        /*
                        bgCtx.translate(-s*2,0);
                        var s = 2; // radius of each stroke
                        bgCtx.beginPath();
                        bgCtx.moveTo(-s,-s);
                        bgCtx.lineTo(s,s);
                        bgCtx.moveTo(-s,s);
                        bgCtx.lineTo(s,-s);
                        bgCtx.lineWidth = 1;
                        bgCtx.strokeStyle = "#777";
                        bgCtx.stroke();
                        */

                        // draw Infinity symbol
                        var r = 2; // radius of each half-circle
                        var d = 3; // distance between the two focal points
                        bgCtx.beginPath();
                        bgCtx.moveTo(-d-r,0);
                        bgCtx.quadraticCurveTo(-d-r,-r,-d,-r);
                        bgCtx.bezierCurveTo(-(d-r),-r,d-r,r,d,r);
                        bgCtx.quadraticCurveTo(d+r,r,d+r,0);
                        bgCtx.quadraticCurveTo(d+r,-r,d,-r);
                        bgCtx.bezierCurveTo(d-r,-r,-(d-r),r,-d,r);
                        bgCtx.quadraticCurveTo(-d-r,r,-d-r,0);
                        bgCtx.lineWidth = 1;
                        bgCtx.strokeStyle = "#FFF";
                        bgCtx.stroke();
                    }
                    bgCtx.restore();
                }

                // draw level fruit
                var fruits = fruit.fruitHistory;
                var i,j;
                var f,drawFunc;
                var numFruit = 7;
                var startLevel = Math.max(numFruit,level);
                if (gameMode != GAME_PACMAN) {
                    // for the Pac-Man game, display the last 7 fruit
                    // for the Ms Pac-Man game, display stop after the 7th fruit
                    startLevel = Math.min(numFruit,startLevel);
                }
                var scale = 0.85;
                for (i=0, j=startLevel-numFruit+1; i<numFruit && j<=level; j++, i++) {
                    f = fruits[j];
                    if (f) {
                        drawFunc = getSpriteFuncFromFruitName(f.name);
                        if (drawFunc) {
                            bgCtx.save();
                            bgCtx.translate((numCols-3)*tileSize - i*16*scale, (numRows-1)*tileSize);
                            bgCtx.scale(scale,scale);
                            drawFunc(bgCtx,0,0);
                            bgCtx.restore();
                        }
                    }
                }
                if (!isCutscene) {
                    if (level >= 100) {
                        bgCtx.font = (tileSize-3) + "px ArcadeR";
                    }
                    else {
                        bgCtx.font = (tileSize-1) + "px ArcadeR";
                    }
                    bgCtx.textBaseline = "middle";
                    bgCtx.fillStyle = "#777";
                    bgCtx.textAlign = "left";
                    bgCtx.fillText(level,(numCols-2)*tileSize, (numRows-1)*tileSize);
                }
            }
            endMapFrame();
        },

        erasePellet: function(x,y,isTranslated) {
            if (!isTranslated) {
                bgCtx.translate(mapPad,mapPad);
            }
            bgCtx.fillStyle = "#000";
            var i = map.posToIndex(x,y);
            var size = map.tiles[i] == 'o' ? this.energizerSize : this.pelletSize;
            this.drawCenterTileSq(bgCtx,x,y,size+2);
            if (!isTranslated) {
                bgCtx.translate(-mapPad,-mapPad);
            }
        },

        refreshPellet: function(x,y,isTranslated) {
            if (!isTranslated) {
                bgCtx.translate(mapPad,mapPad);
            }
            var i = map.posToIndex(x,y);
            var tile = map.currentTiles[i];
            if (tile == ' ') {
                this.erasePellet(x,y,isTranslated);
            }
            else if (tile == '.') {
                bgCtx.fillStyle = map.pelletColor;
                bgCtx.translate(0.5, 0.5);
                this.drawCenterTileSq(bgCtx,x,y,this.pelletSize);
                bgCtx.translate(-0.5, -0.5);
            }
            else if (tile == 'o') {
                bgCtx.fillStyle = map.pelletColor;
                bgCtx.beginPath();
                bgCtx.arc(x*tileSize+midTile.x+0.5,y*tileSize+midTile.y,this.energizerSize/2,0,Math.PI*2);
                bgCtx.fill();
            }
            if (!isTranslated) {
                bgCtx.translate(-mapPad,-mapPad);
            }
        },

        // draw the current score and high score
        drawScore: function() {
            ctx.font = tileSize + "px ArcadeR";
            ctx.textBaseline = "top";
            ctx.fillStyle = "#FFF";

            ctx.textAlign = "right";
            ctx.fillText("1UP", 6*tileSize, 0);
            ctx.fillText(practiceMode ? "PRACTICE" : "HIGH SCORE", 19*tileSize, 0);
            //ctx.fillText("2UP", 25*tileSize, 0);

            // TODO: player two score
            var score = getScore();
            if (score == 0) {
                score = "00";
            }
            var y = tileSize+1;
            ctx.fillText(score, 7*tileSize, y);

            if (!practiceMode) {
                var highScore = getHighScore();
                if (highScore == 0) {
                    highScore = "00";
                }
                ctx.fillText(highScore, 17*tileSize, y);
            }
        },

        // draw ghost
        drawGhost: function(g,alpha) {
            var backupAlpha;
            if (alpha) {
                backupAlpha = ctx.globalAlpha;
                ctx.globalAlpha = alpha;
            }

            var draw = function(mode, pixel, frames, faceDirEnum, scared, isFlash,color, dirEnum) {
                if (mode == GHOST_EATEN)
                    return;
                var frame = g.getAnimFrame(frames);
                var eyes = (mode == GHOST_GOING_HOME || mode == GHOST_ENTERING_HOME);
                var func = getGhostDrawFunc();
                var y = g.getBounceY(pixel.x, pixel.y, dirEnum);
                var x = (g == blinky && scared) ? pixel.x+1 : pixel.x; // blinky's sprite is shifted right when scared

                func(ctx,x,y,frame,faceDirEnum,scared,isFlash,eyes,color);
            };
            vcr.drawHistory(ctx, function(t) {
                draw(
                    g.savedMode[t],
                    g.savedPixel[t],
                    g.savedFrames[t],
                    g.savedFaceDirEnum[t],
                    g.savedScared[t],
                    energizer.isFlash(),
                    g.color,
                    g.savedDirEnum[t]);
            });
            draw(g.mode, g.pixel, g.frames, g.faceDirEnum, g.scared, energizer.isFlash(), g.color, g.dirEnum);
            if (alpha) {
                ctx.globalAlpha = backupAlpha;
            }
        },

        // draw pacman
        drawPlayer: function() {
            var frame = pacman.getAnimFrame();
            if (pacman.invincible) {
                ctx.globalAlpha = 0.6;
            }

            var draw = function(pixel, dirEnum, steps) {
                var frame = pacman.getAnimFrame(pacman.getStepFrame(steps));
                var func = getPlayerDrawFunc();
                func(ctx, pixel.x, pixel.y, dirEnum, frame, true);
            };

            vcr.drawHistory(ctx, function(t) {
                draw(
                    pacman.savedPixel[t],
                    pacman.savedDirEnum[t],
                    pacman.savedSteps[t]);
            });
            draw(pacman.pixel, pacman.dirEnum, pacman.steps);
            if (pacman.invincible) {
                ctx.globalAlpha = 1;
            }
        },

        // draw dying pacman animation (with 0<=t<=1)
        drawDyingPlayer: function(t) {
            var frame = pacman.getAnimFrame();

            if (gameMode == GAME_PACMAN) {
                // 60 frames dying
                // 15 frames exploding
                var f = t*75;
                if (f <= 60) {
                    // open mouth all the way while shifting corner of mouth forward
                    t = f/60;
                    var a = frame*Math.PI/6;
                    drawPacmanSprite(ctx, pacman.pixel.x, pacman.pixel.y, pacman.dirEnum, a + t*(Math.PI-a),4*t);
                }
                else {
                    // explode
                    f -= 60;
                    this.drawExplodingPlayer(f/15);
                }
            }
            else if (gameMode == GAME_OTTO) {
                // TODO: spin around
                if (t < 0.8) {
                    var dirEnum = Math.floor((pacman.dirEnum - t*16))%4;
                    if (dirEnum < 0) {
                        dirEnum += 4;
                    }
                    drawOttoSprite(ctx, pacman.pixel.x, pacman.pixel.y, dirEnum, 0);
                }
                else if (t < 0.95) {
                    var dirEnum = Math.floor((pacman.dirEnum - 0.8*16))%4;
                    if (dirEnum < 0) {
                        dirEnum += 4;
                    }
                    drawOttoSprite(ctx, pacman.pixel.x, pacman.pixel.y, dirEnum, 0);
                }
                else {
                    drawDeadOttoSprite(ctx,pacman.pixel.x, pacman.pixel.y);
                }
            }
            else if (gameMode == GAME_MSPACMAN) {
                // spin 540 degrees
                var maxAngle = Math.PI*5;
                var step = (Math.PI/4) / maxAngle; // 45 degree steps
                var angle = Math.floor(t/step)*step*maxAngle;
                drawMsPacmanSprite(ctx, pacman.pixel.x, pacman.pixel.y, pacman.dirEnum, frame, angle);
            }
            else if (gameMode == GAME_COOKIE) {
                // spin 540 degrees
                var maxAngle = Math.PI*5;
                var step = (Math.PI/4) / maxAngle; // 45 degree steps
                var angle = Math.floor(t/step)*step*maxAngle;
                drawCookiemanSprite(ctx, pacman.pixel.x, pacman.pixel.y, pacman.dirEnum, frame, false, angle);
            }
        },

        // draw exploding pacman animation (with 0<=t<=1)
        drawExplodingPlayer: function(t) {
            var frame = pacman.getAnimFrame();
            drawPacmanSprite(ctx, pacman.pixel.x, pacman.pixel.y, pacman.dirEnum, 0, 0, t,-3,1-t);
        },

        // draw fruit
        drawFruit: function() {

            if (fruit.getCurrentFruit()) {
                var name = fruit.getCurrentFruit().name;

                // draw history trails of the fruit if applicable
                if (fruit.savedPixel) {
                    vcr.drawHistory(ctx, function(t) {
                        var pixel = fruit.savedPixel[t];
                        if (pixel) {
                            atlas.drawFruitSprite(ctx, pixel.x, pixel.y, name);
                        }
                    });
                }

                if (fruit.isPresent()) {
                    atlas.drawFruitSprite(ctx, fruit.pixel.x, fruit.pixel.y, name);
                }
                else if (fruit.isScorePresent()) {
                    if (gameMode == GAME_PACMAN) {
                        atlas.drawPacFruitPoints(ctx, fruit.pixel.x, fruit.pixel.y, fruit.getPoints());
                    }
                    else {
                        atlas.drawMsPacFruitPoints(ctx, fruit.pixel.x, fruit.pixel.y, fruit.getPoints());
                    }
                }
            }
        },

    });

    //
    // Create list of available renderers
    //
    renderer_list = [
        new SimpleRenderer(),
        new ArcadeRenderer(),
    ];
    renderer = renderer_list[1];
};
//@line 1 "src/hud.js"

var hud = (function(){

    var on = false;

    return {

        update: function() {
            var valid = this.isValidState();
            if (valid != on) {
                on = valid;
                if (on) {
                    inGameMenu.onHudEnable();
                    vcr.onHudEnable();
                }
                else {
                    inGameMenu.onHudDisable();
                    vcr.onHudDisable();
                }
            }
        },
        draw: function(ctx) {
            inGameMenu.draw(ctx);
            vcr.draw(ctx);
        },
        isValidState: function() {
            return (
                state == playState ||
                state == newGameState ||
                state == readyNewState ||
                state == readyRestartState ||
                state == finishState ||
                state == deadState ||
                state == overState);
        },
    };

})();
//@line 1 "src/galagaStars.js"

var galagaStars = (function() {

    var stars = {};
    var numStars = 200;

    var width = mapWidth;
    var height = Math.floor(mapHeight*1.5);

    var ypos;
    var yspeed=-0.5;

    var t;
    var flickerPeriod = 120;
    var flickerSteps = 4;
    var flickerGap = flickerPeriod / flickerSteps;

    var init = function() {
        t = 0;
        ypos = 0;
        var i;
        for (i=0; i<numStars; i++) {
            stars[i] = {
                x: getRandomInt(0,width-1),
                y: getRandomInt(0,height-1),
                color: getRandomColor(),
                phase: getRandomInt(0,flickerPeriod-1),
            };
        }
    };

    var update = function() {
        t++;
        t %= flickerPeriod;

        ypos += yspeed;
        ypos %= height;
        if (ypos < 0) {
            ypos += height;
        }
    };

    var draw = function(ctx) {
        var i;
        var star;
        var time;
        var y;
        ctx.fillStyle = "#FFF";
        for (i=0; i<numStars; i++) {
            star = stars[i];
            time = (t + star.phase) % flickerPeriod;
            if (time >= flickerGap) {
                y = star.y - ypos;
                if (y < 0) {
                    y += height;
                }
                ctx.fillStyle = star.color;
                ctx.fillRect(star.x, y, 1,1);
            }
        }
    };

    return {
        init: init,
        draw: draw,
        update: update,
    };

})();
//@line 1 "src/Button.js"
var getPointerPos = function(evt) {
    var obj = canvas;
    var top = 0;
    var left = 0;
    while (obj.tagName != 'BODY') {
        top += obj.offsetTop;
        left += obj.offsetLeft;
        obj = obj.offsetParent;
    }

    // calculate relative mouse position
    var mouseX = evt.pageX - left;
    var mouseY = evt.pageY - top;

    // make independent of scale
    var ratio = getDevicePixelRatio();
    mouseX /= (renderScale / ratio);
    mouseY /= (renderScale / ratio);

    // offset
    mouseX -= mapMargin;
    mouseY -= mapMargin;

    return { x: mouseX, y: mouseY };
};

var Button = function(x,y,w,h,onclick) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.onclick = onclick;

    // text and icon padding
    this.pad = tileSize;



    // icon attributes
    this.frame = 0;

    this.borderBlurColor = "#333";
    this.borderFocusColor = "#EEE";

    this.isSelected = false;

    // touch events
    this.startedInside = false;
    var that = this;
    var touchstart = function(evt) {
        evt.preventDefault();
        var fingerCount = evt.touches.length;
        if (fingerCount == 1) {
            var pos = getPointerPos(evt.touches[0]);
            (that.startedInside=that.contains(pos.x,pos.y)) ? that.focus() : that.blur();
        }
        else {
            touchcancel(evt);
        }
    };
    var touchmove = function(evt) {
        evt.preventDefault();
        var fingerCount = evt.touches.length;
        if (fingerCount == 1) {
            if (that.startedInside) {
                var pos = getPointerPos(evt.touches[0]);
                that.contains(pos.x, pos.y) ? that.focus() : that.blur();
            }
        }
        else {
            touchcancel(evt);
        }
    };
    var touchend = function(evt) {
        evt.preventDefault();
        var registerClick = (that.startedInside && that.isSelected);
        if (registerClick) {
            that.click();
        }
        touchcancel(evt);
        if (registerClick) {
            // focus the button to keep it highlighted after successful click
            that.focus();
        }
    };
    var touchcancel = function(evt) {
        evt.preventDefault();
        this.startedInside = false;
        that.blur();
    };


    // mouse events
    var click = function(evt) {
        var pos = getPointerPos(evt);
        if (that.contains(pos.x, pos.y)) {
            that.click();
        }
    };
    var mousemove = function(evt) {
        var pos = getPointerPos(evt);
        that.contains(pos.x, pos.y) ? that.focus() : that.blur();
    };
    var mouseleave = function(evt) {
        that.blur();
    };

    this.isEnabled = false;
    this.onEnable = function() {
        canvas.addEventListener('click', click);
        canvas.addEventListener('mousemove', mousemove);
        canvas.addEventListener('mouseleave', mouseleave);
        canvas.addEventListener('touchstart', touchstart);
        canvas.addEventListener('touchmove', touchmove);
        canvas.addEventListener('touchend', touchend);
        canvas.addEventListener('touchcancel', touchcancel);
        this.isEnabled = true;
    };

    this.onDisable = function() {
        canvas.removeEventListener('click', click);
        canvas.removeEventListener('mousemove', mousemove);
        canvas.removeEventListener('mouseleave', mouseleave);
        canvas.removeEventListener('touchstart', touchstart);
        canvas.removeEventListener('touchmove', touchmove);
        canvas.removeEventListener('touchend', touchend);
        canvas.removeEventListener('touchcancel', touchcancel);
        that.blur();
        this.isEnabled = false;
    };
};

Button.prototype = {

    contains: function(x,y) {
        return x >= this.x && x <= this.x+this.w &&
               y >= this.y && y <= this.y+this.h;
    },

    click: function() {
        // disable current click timeout (to prevent double clicks on some devices)
        clearTimeout(this.clickTimeout);

        // set a click delay
        var that = this;
        if (that.onclick) {
            this.clickTimeout = setTimeout(function() { that.onclick(); }, 200);
        }
    },

    enable: function() {
        this.frame = 0;
        this.onEnable();
    },

    disable: function() {
        this.onDisable();
    },

    focus: function() {
        this.isSelected = true;
        this.onfocus && this.onfocus();
    },

    blur: function() {
        this.isSelected = false;
        this.onblur && this.onblur();
    },

    setText: function(msg) {
        this.msg = msg;
    },

    setFont: function(font,fontcolor) {
        this.font = font;
        this.fontcolor = fontcolor;
    },

    setIcon: function(drawIcon) {
        this.drawIcon = drawIcon;
    },

    draw: function(ctx) {

        // draw border
        ctx.lineWidth = 2;
        ctx.beginPath();
        var x=this.x, y=this.y, w=this.w, h=this.h;
        var r=h/4;
        ctx.moveTo(x,y+r);
        ctx.quadraticCurveTo(x,y,x+r,y);
        ctx.lineTo(x+w-r,y);
        ctx.quadraticCurveTo(x+w,y,x+w,y+r);
        ctx.lineTo(x+w,y+h-r);
        ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        ctx.lineTo(x+r,y+h);
        ctx.quadraticCurveTo(x,y+h,x,y+h-r);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fill();
        ctx.strokeStyle = this.isSelected && this.onclick ? this.borderFocusColor : this.borderBlurColor;
        ctx.stroke();

        // draw icon
        if (this.drawIcon) {
            if (!this.msg) {
                this.drawIcon(ctx,this.x+this.w/2,this.y+this.h/2,this.frame);
            }
            else {
                this.drawIcon(ctx,this.x+this.pad+tileSize,this.y+this.h/2,this.frame);
            }
        }

        // draw text
        if (this.msg) {
            ctx.font = this.font;
            ctx.fillStyle = this.isSelected && this.onclick ? this.fontcolor : "#777";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            //ctx.fillText(this.msg, 2*tileSize+2*this.pad+this.x, this.y + this.h/2 + 1);
            ctx.fillText(this.msg, this.x + this.w/2, this.y + this.h/2 + 1);
        }
    },

    update: function() {
        if (this.drawIcon) {
            this.frame = this.isSelected ? this.frame+1 : 0;
        }
    },
};

var ToggleButton = function(x,y,w,h,isOn,setOn) {
    var that = this;
    var onclick = function() {
        setOn(!isOn());
        that.refreshMsg();
    };
    this.isOn = isOn;
    this.setOn = setOn;
    Button.call(this,x,y,w,h,onclick);
};

ToggleButton.prototype = newChildObject(Button.prototype, {

    enable: function() {
        Button.prototype.enable.call(this);
        this.refreshMsg();
    },
    setToggleLabel: function(label) {
        this.label = label;
    },
    refreshMsg: function() {
        if (this.label) {
            this.msg = this.label + ": " + (this.isOn() ? "ON" : "OFF");
        }
    },
    refreshOnState: function() {
        this.setOn(this.isOn());
    },

});
//@line 1 "src/Menu.js"
var Menu = function(title,x,y,w,h,pad,font,fontcolor) {
    this.title = title;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.pad = pad;
    this.buttons = [];
    this.buttonCount = 0;
    this.currentY = this.y+this.pad;

    if (title) {
        this.currentY += 1*(this.h + this.pad);
    }

    this.font = font;
    this.fontcolor = fontcolor;
    this.enabled = false;

    this.backButton = undefined;
};

Menu.prototype = {

    clickCurrentOption: function() {
        var i;
        for (i=0; i<this.buttonCount; i++) {
            if (this.buttons[i].isSelected) {
                this.buttons[i].onclick();
                break;
            }
        }
    },

    selectNextOption: function() {
        var i;
        var nextBtn;
        for (i=0; i<this.buttonCount; i++) {
            if (this.buttons[i].isSelected) {
                this.buttons[i].blur();
                nextBtn = this.buttons[(i+1)%this.buttonCount];
                break;
            }
        }
        nextBtn = nextBtn || this.buttons[0];
        nextBtn.focus();
    },

    selectPrevOption: function() {
        var i;
        var nextBtn;
        for (i=0; i<this.buttonCount; i++) {
            if (this.buttons[i].isSelected) {
                this.buttons[i].blur();
                nextBtn = this.buttons[i==0?this.buttonCount-1:i-1];
                break;
            }
        }
        nextBtn = nextBtn || this.buttons[this.buttonCount-1];
        nextBtn.focus();
    },

    addToggleButton: function(isOn,setOn) {
        var b = new ToggleButton(this.x+this.pad,this.currentY,this.w-this.pad*2,this.h,isOn,setOn);
        this.buttons.push(b);
        this.buttonCount++;
        this.currentY += this.pad + this.h;
    },

    addToggleTextButton: function(label,isOn,setOn) {
        var b = new ToggleButton(this.x+this.pad,this.currentY,this.w-this.pad*2,this.h,isOn,setOn);
        b.setFont(this.font,this.fontcolor);
        b.setToggleLabel(label);
        this.buttons.push(b);
        this.buttonCount++;
        this.currentY += this.pad + this.h;
    },

    addTextButton: function(msg,onclick) {
        var b = new Button(this.x+this.pad,this.currentY,this.w-this.pad*2,this.h,onclick);
        b.setFont(this.font,this.fontcolor);
        b.setText(msg);
        this.buttons.push(b);
        this.buttonCount++;
        this.currentY += this.pad + this.h;
    },

    addTextIconButton: function(msg,onclick,drawIcon) {
        var b = new Button(this.x+this.pad,this.currentY,this.w-this.pad*2,this.h,onclick);
        b.setFont(this.font,this.fontcolor);
        b.setText(msg);
        b.setIcon(drawIcon);
        this.buttons.push(b);
        this.buttonCount++;
        this.currentY += this.pad + this.h;
    },

    addIconButton: function(drawIcon,onclick) {
        var b = new Button(this.x+this.pad,this.currentY,this.w-this.pad*2,this.h,onclick);
        b.setIcon(drawIcon);
        this.buttons.push(b);
        this.buttonCount++;
        this.currentY += this.pad + this.h;
    },

    addSpacer: function(count) {
        if (count == undefined) {
            count = 1;
        }
        this.currentY += count*(this.pad + this.h);
    },

    enable: function() {
        var i;
        for (i=0; i<this.buttonCount; i++) {
            this.buttons[i].enable();
        }
        this.enabled = true;
    },

    disable: function() {
        var i;
        for (i=0; i<this.buttonCount; i++) {
            this.buttons[i].disable();
        }
        this.enabled = false;
    },

    isEnabled: function() {
        return this.enabled;
    },

    draw: function(ctx) {
        if (this.title) {
            ctx.font = tileSize+"px ArcadeR";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillStyle = "#FFF";
            ctx.fillText(this.title,this.x + this.w/2, this.y+this.pad + this.h/2);
        }
        var i;
        for (i=0; i<this.buttonCount; i++) {
            this.buttons[i].draw(ctx);
        }
    },

    update: function() {
        var i;
        for (i=0; i<this.buttonCount; i++) {
            this.buttons[i].update();
        }
    },
};
//@line 1 "src/inGameMenu.js"
////////////////////////////////////////////////////
// In-Game Menu
var inGameMenu = (function() {

    var w=tileSize*6,h=tileSize*3;

    var getMainMenu = function() {
        return practiceMode ? practiceMenu : menu;
    };
    var showMainMenu = function() {
        getMainMenu().enable();
    };
    var hideMainMenu = function() {
        getMainMenu().disable();
    };

    // button to enable in-game menu
    var btn = new Button(mapWidth/2 - w/2,mapHeight,w,h, function() {
        showMainMenu();
        vcr.onHudDisable();
    });
    btn.setText("MENU");
    btn.setFont(tileSize+"px ArcadeR","#FFF");

    // confirms a menu action
    var confirmMenu = new Menu("QUESTION?",2*tileSize,5*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    confirmMenu.addTextButton("YES", function() {
        confirmMenu.disable();
        confirmMenu.onConfirm();
    });
    confirmMenu.addTextButton("NO", function() {
        confirmMenu.disable();
        showMainMenu();
    });
    confirmMenu.addTextButton("CANCEL", function() {
        confirmMenu.disable();
        showMainMenu();
    });
    confirmMenu.backButton = confirmMenu.buttons[confirmMenu.buttonCount-1];

    var showConfirm = function(title,onConfirm) {
        hideMainMenu();
        confirmMenu.title = title;
        confirmMenu.onConfirm = onConfirm;
        confirmMenu.enable();
    };

    // regular menu
    var menu = new Menu("PAUSED",2*tileSize,5*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    menu.addTextButton("RESUME", function() {
        menu.disable();
    });
    menu.addTextButton("QUIT", function() {
        showConfirm("QUIT GAME?", function() {
            switchState(homeState, 60);
        });
    });
    menu.backButton = menu.buttons[0];

    // practice menu
    var practiceMenu = new Menu("PAUSED",2*tileSize,5*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    practiceMenu.addTextButton("RESUME", function() {
        hideMainMenu();
        vcr.onHudEnable();
    });
    practiceMenu.addTextButton("RESTART LEVEL", function() {
        showConfirm("RESTART LEVEL?", function() {
            level--;
            switchState(readyNewState, 60);
        });
    });
    practiceMenu.addTextButton("SKIP LEVEL", function() {
        showConfirm("SKIP LEVEL?", function() {
            switchState(readyNewState, 60);
        });
    });
    practiceMenu.addTextButton("CHEATS", function() {
        practiceMenu.disable();
        cheatsMenu.enable();
    });
    practiceMenu.addTextButton("QUIT", function() {
        showConfirm("QUIT GAME?", function() {
            switchState(homeState, 60);
            clearCheats();
            vcr.reset();
        });
    });
    practiceMenu.backButton = practiceMenu.buttons[0];

    // cheats menu
    var cheatsMenu = new Menu("CHEATS",2*tileSize,5*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    cheatsMenu.addToggleTextButton("INVINCIBLE",
        function() {
            return pacman.invincible;
        },
        function(on) {
            pacman.invincible = on;
        });
    cheatsMenu.addToggleTextButton("TURBO",
        function() {
            return turboMode;
        },
        function(on) {
            turboMode = on;
        });
    cheatsMenu.addToggleTextButton("SHOW TARGETS",
        function() {
            return blinky.isDrawTarget;
        },
        function(on) {
            for (var i=0; i<4; i++) {
                ghosts[i].isDrawTarget = on;
            }
        });
    cheatsMenu.addToggleTextButton("SHOW PATHS",
        function() {
            return blinky.isDrawPath;
        },
        function(on) {
            for (var i=0; i<4; i++) {
                ghosts[i].isDrawPath = on;
            }
        });
    cheatsMenu.addSpacer(1);
    cheatsMenu.addTextButton("BACK", function() {
        cheatsMenu.disable();
        practiceMenu.enable();
    });
    cheatsMenu.backButton = cheatsMenu.buttons[cheatsMenu.buttons.length-1];

    var menus = [menu, practiceMenu, confirmMenu, cheatsMenu];
    var getVisibleMenu = function() {
        var len = menus.length;
        var i;
        var m;
        for (i=0; i<len; i++) {
            m = menus[i];
            if (m.isEnabled()) {
                return m;
            }
        }
    };

    return {
        onHudEnable: function() {
            btn.enable();
        },
        onHudDisable: function() {
            btn.disable();
        },
        update: function() {
            if (btn.isEnabled) {
                btn.update();
            }
        },
        draw: function(ctx) {
            var m = getVisibleMenu();
            if (m) {
                ctx.fillStyle = "rgba(0,0,0,0.8)";
                ctx.fillRect(-mapPad-1,-mapPad-1,mapWidth+1,mapHeight+1);
                m.draw(ctx);
            }
            else {
                btn.draw(ctx);
            }
        },
        isOpen: function() {
            return getVisibleMenu() != undefined;
        },
        getMenu: function() {
            return getVisibleMenu();
        },
        getMenuButton: function() {
            return btn;
        },
    };
})();

//@line 1 "src/customSprites.js"
//////////////////////////////////////////////////////////////////////////////////////
// Custom sprites
// Image-based replacements for the vector-drawn Pac-Man and ghost bodies.
// (The PNG files are also in sprites/custom/ for reference and editing.)
// Only the *appearance* changes here; game logic is untouched.  If an image
// fails to load, 'ready' stays false and the original vector sprites are used.

var customSprites = (function(){

    var SRC = {
        virus: "data:image/png;base64,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", // computer virus (fork bomb debuff)
        pac0: "data:image/png;base64,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",
        pac1: "data:image/png;base64,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",
        pac2: "data:image/png;base64,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McKMSzMmqp2f4nkStq+C4jeX1bt27XrmTW/62bdcc801y9dee20oIfXFWrrUcwygazIo4SJrycMvyutzYTIeswN4QjU43rbHZTjWYzPeLBiDXuZtGFM58g4XbKJZDlGEqMggtQbWuBCv1WpRp9NZ1Fqvrq2tHel0OjsTrbdt9NZb5LsNC3Kin6HD5FCznGSIUnxPHssIuatYi253A7BAlihsbPQss+Jzz935nV/4hV/4pY9//OPP79+/n2+66aaB9TmanZ197NixY5cQkRUR1qVBdYOrHcVOjOUp8hJCJomDgfLsseq4xnjEV13MLTlkCqSZse12m6+88sr3vvWtb731uuuu61122WXLhw8fHn3ve9975T333H3v+vpGqU2O/d7027ZN4I2vf71PPqgYHhqdB6zkJunEqXnc9fV7onxHy67zdi38zu/sv/DGG29cCO2yQ2tySint0nbnijJjtsx/lQFcsGHvH/geqmQXRQ+DX+ygVqt18jvf+c6fhgktAHh2dnbl8ccf/8e77777WK/Xm45MCDEzWWuRpYaIFKwxKMp2Uo6doyxVxMLv2GsBpK2Wau7efd5NN95448K+ffuSAwcOnLHVgJn5WQDKWqultN3V5p4S/+4/P+w4Unlv31PCU2L7qiBQEEm8Y37OX3Sw2BaAvvDCC3tjY2P/5F/X/idba/MtvIgFxDklOJ9DkfsAdjPVIidsva9qnn/+rq9885t/90kA+v77799UH4feu3fvh4not9fW1i621k4YY6hkUweZiBBfRoXNumB9UBG1rj2gesylpaWnlFJpp9PByMiIXVxcfIKIeuedd97fEZV2RsINN9wgRCRXXXXVxwA0V1dXLRExM482Go1zVlZW0Gq3t62srTpyY661VXJgEbWsb3Sl1WzytsnJx+fm5j790Y9+9H9cf/31hJqW2WEr3M1HM6b1B3/wB50TJ05It9ulpaUlPx26/Ih3wB4fH8c4xoHx4vVBO2RPTEyU/u33cgYALC0t5Z+bmJhwxx0fx6tf/epT4WKr5aChWpPH8UCWZfSFL3xh+8MPP2weeeSRa7/97W8dWFtbV0xMAQ8piaMYOGeSJFEvu+LlN3/nO996FxF1z5alxC8Kk/qf7xGbkHjpD7ue2q1dmBlzc3MP+JCq5zXRoLojlXstGx+f6PrGGFx66aWNF8x2/1f4fNFu0L59+5L9+/fzvn37bm61WsJEdfuClZ5zc7OHRES/EAXUVdz6/8OHAMD999+f3X///XjPe97zoUaj8eixY8cuW11d3U5EezY2Nsaazea5xhgopez6+vqhqakps3Pnzo97MEyd7Zf/XxoFGBWCg6qjAAAAAElFTkSuQmCC",
        blinky: "data:image/png;base64,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",
        pinky: "data:image/png;base64,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",
        inky: "data:image/png;base64,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",
        clyde: "data:image/png;base64,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"
    };

    // ghost color -> sprite
    var ghostKeys = {
        "#ff0000": "blinky", // red ladybug
        "#ffb8ff": "pinky",  // purple invader
        "#00ffff": "inky",   // green beetle
        "#ffb851": "clyde"   // orange invader
    };

    // bugs are drawn head-up, so they get rotated to face their direction
    var rotates = { blinky: true, inky: true };

    var PAC_SIZE = 17;     // height of the moai head (logical pixels)
    var GHOST_SIZE = 15;   // longest side of a ghost sprite

    var imgs = {};
    var tints = {};
    var ready = false;

    var load = function(done) {
        var keys = Object.keys(SRC);
        var pending = keys.length;
        var ok = true;
        if (typeof Image == "undefined") {
            done();
            return;
        }
        var finish = function() {
            pending--;
            if (pending == 0) {
                ready = ok;
                done();
            }
        };
        keys.forEach(function(k) {
            var im = new Image();
            im.onload = finish;
            im.onerror = function() { ok = false; finish(); };
            im.src = SRC[k];
            imgs[k] = im;
        });
    };

    var smooth = function(ctx) {
        ctx.imageSmoothingEnabled = true;
        if ("imageSmoothingQuality" in ctx) {
            ctx.imageSmoothingQuality = "high";
        }
    };

    // draw an image (or canvas) centered at the origin, fitting its longest side to 'size'
    var drawCentered = function(ctx, im, size) {
        var w = im.width, h = im.height;
        var s = size / Math.max(w,h);
        smooth(ctx);
        ctx.drawImage(im, -w*s/2, -h*s/2, w*s, h*s);
    };

    // solid-color silhouette of a sprite (used for scared ghosts)
    var getTint = function(key, color) {
        var id = key + color;
        if (!tints[id]) {
            var im = imgs[key];
            var c = document.createElement("canvas");
            c.width = im.width;
            c.height = im.height;
            var cx = c.getContext("2d");
            cx.drawImage(im, 0, 0);
            cx.globalCompositeOperation = "source-atop";
            cx.fillStyle = color;
            cx.fillRect(0, 0, c.width, c.height);
            tints[id] = c;
        }
        return tints[id];
    };

    // 0 = closed, 1 = half open, 2 = wide open
    var pacFrame = function(angle) {
        if (angle < 0.05) return 0;
        if (angle < 0.8) return 1;
        return 2;
    };

    // same signature and meaning as drawPacmanSprite
    var drawPacman = function(ctx,x,y,dirEnum,angle,mouthShift,scale,centerShift,alpha) {
        if (mouthShift == undefined) mouthShift = 0;
        if (scale == undefined) scale = 1;
        if (alpha == undefined) alpha = 1;

        // dying animation: mouth opens while mouthShift grows 0 -> 4
        if (mouthShift > 0) {
            var t = Math.min(mouthShift/4, 1);
            scale *= (1 - 0.5*t);
            alpha *= (1 - t);
        }

        ctx.save();
        ctx.translate(x,y);
        ctx.scale(scale,scale);
        ctx.globalAlpha = ctx.globalAlpha * alpha;

        // the head faces right: mirror for left, rotate for up/down
        var d90 = Math.PI/2;
        if (dirEnum == DIR_LEFT) ctx.scale(-1,1);
        else if (dirEnum == DIR_UP) ctx.rotate(-d90);
        else if (dirEnum == DIR_DOWN) ctx.rotate(d90);

        drawCentered(ctx, imgs["pac"+pacFrame(angle)], PAC_SIZE);
        ctx.restore();
    };

    // big Pac-Man from the cutscenes (frame 0,1,2 = closed, half, wide)
    var drawGiantPacman = function(ctx,x,y,dirEnum,frame) {
        ctx.save();
        ctx.translate(x,y);
        var d90 = Math.PI/2;
        if (dirEnum == DIR_LEFT) ctx.scale(-1,1);
        else if (dirEnum == DIR_UP) ctx.rotate(-d90);
        else if (dirEnum == DIR_DOWN) ctx.rotate(d90);
        drawCentered(ctx, imgs["pac"+Math.max(0,Math.min(2,frame))], 34);
        ctx.restore();
    };

    // draws a ghost body centered at (x,y); returns false if this ghost has no custom sprite
    var drawGhostBody = function(ctx,x,y,frame,dirEnum,scared,flash,color) {
        var key, im;
        ctx.save();
        ctx.translate(x,y);

        if (scared) {
            // blue (or white when flashing) silhouette; the scared face is drawn by the caller
            im = getTint("pinky", flash ? "#FFFFFF" : "#2121ff");
            if (frame == 1) ctx.translate(0,0.7);
            drawCentered(ctx, im, GHOST_SIZE);
            ctx.restore();
            return true;
        }

        key = ghostKeys[(color || "").toLowerCase()];
        if (!key) {
            ctx.restore();
            return false;
        }

        if (rotates[key]) {
            var d90 = Math.PI/2;
            if (dirEnum == DIR_RIGHT) ctx.rotate(d90);
            else if (dirEnum == DIR_DOWN) ctx.rotate(2*d90);
            else if (dirEnum == DIR_LEFT) ctx.rotate(-d90);
            if (frame == 1) ctx.scale(-1,1); // wiggle the legs
        }
        else {
            if (frame == 1) ctx.translate(0,0.7); // little hop
        }

        drawCentered(ctx, imgs[key], GHOST_SIZE);
        ctx.restore();
        return true;
    };

    // computer-virus monster spawned by the FORK BOMB debuff
    // (alpha < 1 fades it in/out; frame toggles a little wiggle)
    var drawVirus = function(ctx,x,y,frame,alpha) {
        if (!ready) return false;
        ctx.save();
        ctx.translate(x,y);
        ctx.globalAlpha = ctx.globalAlpha * alpha;
        ctx.rotate(frame == 1 ? 0.18 : -0.18);
        drawCentered(ctx, imgs.virus, GHOST_SIZE);
        ctx.restore();
        return true;
    };

    return {
        drawVirus: drawVirus,
        getImage: function(key) { return imgs[key]; },
        load: load,
        isReady: function() { return ready; },
        drawPacman: drawPacman,
        drawGiantPacman: drawGiantPacman,
        drawGhostBody: drawGhostBody,
    };
})();

//@line 1 "src/sprites.js"
//////////////////////////////////////////////////////////////////////////////////////
// Sprites
// (sprites are created using canvas paths)

var drawGhostSprite = (function(){

    // add top of the ghost head to the current canvas path
    var addHead = (function() {

        // pixel coordinates for the top of the head
        // on the original arcade ghost sprite
        var coords = [
            0,6,
            1,3,
            2,2,
            3,1,
            4,1,
            5,0,
            8,0,
            9,1,
            10,1,
            11,2,
            12,3,
            13,6,
        ];

        return function(ctx) {
            var i;
            ctx.save();

            // translate by half a pixel to the right
            // to try to force centering
            ctx.translate(0.5,0);

            ctx.moveTo(0,6);
            ctx.quadraticCurveTo(1.5,0,6.5,0);
            ctx.quadraticCurveTo(11.5,0,13,6);

            // draw lines between pixel coordinates
            /*
            ctx.moveTo(coords[0],coords[1]);
            for (i=2; i<coords.length; i+=2)
                ctx.lineTo(coords[i],coords[i+1]);
            */

            ctx.restore();
        };
    })();

    // add first ghost animation frame feet to the current canvas path
    var addFeet1 = (function(){

        // pixel coordinates for the first feet animation
        // on the original arcade ghost sprite
        var coords = [
            13,13,
            11,11,
            9,13,
            8,13,
            8,11,
            5,11,
            5,13,
            4,13,
            2,11,
            0,13,
        ];

        return function(ctx) {
            var i;
            ctx.save();

            // translate half a pixel right and down
            // to try to force centering and proper height
            ctx.translate(0.5,0.5);

            // continue previous path (assuming ghost head)
            // by drawing lines to each of the pixel coordinates
            for (i=0; i<coords.length; i+=2)
                ctx.lineTo(coords[i],coords[i+1]);

            ctx.restore();
        };

    })();

    // add second ghost animation frame feet to the current canvas path
    var addFeet2 = (function(){

        // pixel coordinates for the second feet animation
        // on the original arcade ghost sprite
        var coords = [
            13,12,
            12,13,
            11,13,
            9,11,
            7,13,
            6,13,
            4,11,
            2,13,
            1,13,
            0,12,
        ];

        return function(ctx) {
            var i;
            ctx.save();

            // translate half a pixel right and down
            // to try to force centering and proper height
            ctx.translate(0.5,0.5);

            // continue previous path (assuming ghost head)
            // by drawing lines to each of the pixel coordinates
            for (i=0; i<coords.length; i+=2)
                ctx.lineTo(coords[i],coords[i+1]);

            ctx.restore();
        };

    })();

    // draw regular ghost eyes
    var addEyes = function(ctx,dirEnum){
        var i;

        ctx.save();
        ctx.translate(2,3);

        var coords = [
            0,1,
            1,0,
            2,0,
            3,1,
            3,3,
            2,4,
            1,4,
            0,3
        ];

        var drawEyeball = function() {
            ctx.translate(0.5,0.5);
            ctx.beginPath();
            ctx.moveTo(coords[0],coords[1]);
            for (i=2; i<coords.length; i+=2)
                ctx.lineTo(coords[i],coords[i+1]);
            ctx.closePath();
            ctx.fill();
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.translate(-0.5,-0.5);
            //ctx.fillRect(1,0,2,5); // left
            //ctx.fillRect(0,1,4,3);
        };

        // translate eye balls to correct position
        if (dirEnum == DIR_LEFT) ctx.translate(-1,0);
        else if (dirEnum == DIR_RIGHT) ctx.translate(1,0);
        else if (dirEnum == DIR_UP) ctx.translate(0,-1);
        else if (dirEnum == DIR_DOWN) ctx.translate(0,1);

        // draw eye balls
        ctx.fillStyle = "#FFF";
        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 1.0;
        ctx.lineJoin = 'round';
        drawEyeball();
        ctx.translate(6,0);
        drawEyeball();

        // translate pupils to correct position
        if (dirEnum == DIR_LEFT) ctx.translate(0,2);
        else if (dirEnum == DIR_RIGHT) ctx.translate(2,2);
        else if (dirEnum == DIR_UP) ctx.translate(1,0);
        else if (dirEnum == DIR_DOWN) ctx.translate(1,3);

        // draw pupils
        ctx.fillStyle = "#00F";
        ctx.fillRect(0,0,2,2); // right
        ctx.translate(-6,0);
        ctx.fillRect(0,0,2,2); // left

        ctx.restore();
    };

    // draw scared ghost face
    var addScaredFace = function(ctx,flash){
        ctx.strokeStyle = ctx.fillStyle = flash ? "#F00" : "#FF0";

        // eyes
        ctx.fillRect(4,5,2,2);
        ctx.fillRect(8,5,2,2);

        // mouth
        var coords = [
            1,10,
            2,9,
            3,9,
            4,10,
            5,10,
            6,9,
            7,9,
            8,10,
            9,10,
            10,9,
            11,9,
            12,10,
        ];
        ctx.translate(0.5,0.5);
        ctx.beginPath();
        ctx.moveTo(coords[0],coords[1]);
        for (i=2; i<coords.length; i+=2)
            ctx.lineTo(coords[i],coords[i+1]);
        ctx.lineWidth = 1.0;
        ctx.stroke();
        ctx.translate(-0.5,-0.5);
        /*
        ctx.fillRect(1,10,1,1);
        ctx.fillRect(12,10,1,1);
        ctx.fillRect(2,9,2,1);
        ctx.fillRect(6,9,2,1);
        ctx.fillRect(10,9,2,1);
        ctx.fillRect(4,10,2,1);
        ctx.fillRect(8,10,2,1);
        */
    };


    return function(ctx,x,y,frame,dirEnum,scared,flash,eyes_only,color) {
        ctx.save();
        ctx.translate(x-7,y-7);

        // custom image sprites (falls through to the original vector drawing if unavailable)
        if (customSprites.isReady() && !eyes_only) {
            if (customSprites.drawGhostBody(ctx, 7, 7, frame, dirEnum, scared, flash, color)) {
                if (scared) {
                    addScaredFace(ctx, flash);
                }
                ctx.restore();
                return;
            }
        }

        if (scared)
            color = flash ? "#FFF" : "#2121ff";

        if (!eyes_only) {
            // draw body
            ctx.beginPath();
            addHead(ctx);
            if (frame == 0)
                addFeet1(ctx);
            else
                addFeet2(ctx);
            ctx.closePath();
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = color;
            ctx.stroke();
            ctx.lineWidth = 1;
            ctx.fillStyle = color;
            ctx.fill();
        }

        // draw face
        if (scared)
            addScaredFace(ctx, flash);
        else
            addEyes(ctx,dirEnum);

        ctx.restore();
    };
})();

// draw points displayed when pac-man eats a ghost or a fruit
var drawPacPoints = (function(){
    var ctx;
    var color;

    var plotOutline = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var plotLine = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var draw0 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotOutline([
            1,0,
            2,0,
            3,1,
            3,5,
            2,6,
            1,6,
            0,5,
            0,1,
        ],color);
        ctx.restore();
    };

    var draw1narrow = function(x,y) {
        plotLine([x,y,x,y+6],color);
    };

    var draw1 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,1,
            1,0,
            1,6,
            0,6,
            2,6,
        ],color);
        ctx.restore();
    };

    var draw2 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,2,
            0,1,
            1,0,
            3,0,
            4,1,
            4,2,
            0,6,
            4,6,
        ],color);
        ctx.restore();
    };

    var draw3 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,0,
            4,0,
            2,2,
            4,4,
            4,5,
            3,6,
            1,6,
            0,5,
        ],color);
        ctx.restore();
    };

    var draw4 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            3,6,
            3,0,
            0,3,
            0,4,
            4,4,
        ],color);
        ctx.restore();
    };

    var draw5 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            4,0,
            0,0,
            0,2,
            3,2,
            4,3,
            4,5,
            3,6,
            1,6,
            0,5,
        ],color);
        ctx.restore();
    };

    var draw6 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            3,0,
            1,0,
            0,1,
            0,5,
            1,6,
            2,6,
            3,5,
            3,3,
            0,3,
        ],color);
        ctx.restore();
    };

    var draw7 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,1,
            0,0,
            4,0,
            4,1,
            2,4,
            2,6,
        ],color);
        ctx.restore();
    };

    var draw8 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotOutline([
            1,0,
            3,0,
            4,1,
            4,2,
            3,3,
            1,3,
            0,4,
            0,5,
            1,6,
            3,6,
            4,5,
            4,4,
            3,3,
            1,3,
            0,2,
            0,1,
        ],color);
        ctx.restore();
    };

    var draw100 = function() {
        draw1(-5,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw200 = function() {
        draw2(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw300 = function() {
        draw3(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };
    
    var draw400 = function() {
        draw4(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw500 = function() {
        draw5(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw700 = function() {
        draw7(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw800 = function() {
        draw8(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw1000 = function() {
        draw1(-8,-3);
        draw0(-4,-3);
        draw0(1,-3);
        draw0(6,-3);
    };
    
    var draw1600 = function() {
        draw1narrow(-7,-3);
        draw6(-5,-3);
        draw0(0,-3);
        draw0(5,-3);
    };

    var draw2000 = function() {
        draw2(-10,-3);
        draw0(-4,-3);
        draw0(1,-3);
        draw0(6,-3);
    };

    var draw3000 = function() {
        draw3(-10,-3);
        draw0(-4,-3);
        draw0(1,-3);
        draw0(6,-3);
    };

    var draw5000 = function() {
        draw5(-10,-3);
        draw0(-4,-3);
        draw0(1,-3);
        draw0(6,-3);
    };

    return function(_ctx,x,y,points,_color) {
        ctx = _ctx;
        color = _color;

        ctx.save();
        ctx.translate(x+0.5,y+0.5);
        ctx.translate(0,-1);

        var f = {
            100: draw100,
            200: draw200,
            300: draw300,
            400: draw400,
            500: draw500,
            700: draw700,
            800: draw800,
            1000: draw1000,
            1600: draw1600,
            2000: draw2000,
            3000: draw3000,
            5000: draw5000,
        }[points];

        if (f) {
            f();
        }

        ctx.restore();
    };
})();

// draw points displayed when ms. pac-man eats a fruit
var drawMsPacPoints = (function(){
    var ctx;
    var color = "#fff";

    var plotOutline = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var plotLine = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };


    var draw0 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotOutline([
            0,0,
            2,0,
            2,4,
            0,4,
        ],color);
        ctx.restore();
    };

    var draw1 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            1,0,
            1,4,
        ],color);
        ctx.restore();
    };

    var draw2 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,0,
            2,0,
            2,2,
            0,2,
            0,4,
            2,4,
        ],color);
        ctx.restore();
    };

    var draw5 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            2,0,
            0,0,
            0,2,
            2,2,
            2,4,
            0,4,
        ],color);
        ctx.restore();
    };

    var draw7 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,0,
            2,0,
            2,4,
        ],color);
        ctx.restore();
    };

    var draw100 = function() {
        draw1(-5,-5);
        draw0(-1,-2);
        draw0(3,1);
    };

    var draw200 = function() {
        draw2(-5,-5);
        draw0(-1,-2);
        draw0(3,1);
    };

    var draw500 = function() {
        draw5(-5,-5);
        draw0(-1,-2);
        draw0(3,1);
    };

    var draw700 = function() {
        draw7(-5,-5);
        draw0(-1,-2);
        draw0(3,1);
    };

    var draw1000 = function() {
        draw1(-7,-7);
        draw0(-3,-4);
        draw0(1,-1);
        draw0(5,2);
    };

    var draw2000 = function() {
        draw2(-7,-7);
        draw0(-3,-4);
        draw0(1,-1);
        draw0(5,2);
    };

    var draw5000 = function() {
        draw5(-7,-7);
        draw0(-3,-4);
        draw0(1,-1);
        draw0(5,2);
    };

    return function(_ctx,x,y,points) {
        ctx = _ctx;

        ctx.save();
        ctx.translate(x+0.5,y+0.5);

        var f = {
            100: draw100,
            200: draw200,
            500: draw500,
            700: draw700,
            1000: draw1000,
            2000: draw2000,
            5000: draw5000,
        }[points];

        if (f) {
            f();
        }

        ctx.restore();
    };
})();

var drawMonsterSprite = (function(){
    var ctx;
    var color;

    var plotOutline = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var plotLine = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var plotSolid = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineJoin = "round";
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.fill();
        ctx.stroke();
    };


    // draw regular ghost eyes
    var drawEye = function(dirEnum,x,y){
        var i;

        ctx.save();
        ctx.translate(x,y);

        plotSolid([
            0,1,
            1,0,
            2,0,
            3,1,
            3,3,
            2,4,
            1,4,
            0,3
        ],"#FFF");

        // translate pupil to correct position
        if (dirEnum == DIR_LEFT) ctx.translate(0,2);
        else if (dirEnum == DIR_RIGHT) ctx.translate(2,2);
        else if (dirEnum == DIR_UP) ctx.translate(1,0);
        else if (dirEnum == DIR_DOWN) ctx.translate(1,3);

        // draw pupil
        plotSolid([
            0,0,
            1,0,
            1,1,
            0,1,
        ],"#00F");

        ctx.restore();
    };

    var drawRightBody = function() {
        plotSolid([
            -7,-3,
            -3,-7,
            -1,-7,
            -2,-6,
            0,-4,
            3,-7,
            5,-7,
            4,-7,
            3,-6,
            6,-3,
            6,1,
            5,3,
            2,6,
            -4,6,
            -5,5,
            -7,1,
        ],color);
    };

    var drawRightShoe = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotSolid([
            0,0,
            3,-3,
            4,-3,
            5,-2,
            5,-1,
            4,0,
        ],"#00F");
        ctx.restore();
    };

    var drawRight0 = function() {
        // antenna tips
        plotLine([-1,-7,0,-6],"#FFF");
        plotLine([5,-7,6,-6],"#FFF");

        drawRightBody();

        drawRightShoe(1,6);
        plotLine([-4,6,-1,6],"#00F");

        drawEye(DIR_RIGHT,-4,-4);
        drawEye(DIR_RIGHT,2,-4);
    };

    var drawRight1 = function() {
        // antenna tips
        plotLine([-1,-7,0,-7],"#FFF");
        plotLine([5,-7,6,-7],"#FFF");

        drawRightBody();

        drawRightShoe(-4,6);
        plotLine([2,6,5,6],"#00F");

        drawEye(DIR_RIGHT,-4,-4);
        drawEye(DIR_RIGHT,2,-4);
    };

    var drawLeft0 = function() {
        ctx.scale(-1,1);
        ctx.translate(1,0);
        drawRight0();
    };
    
    var drawLeft1 = function() {
        ctx.scale(-1,1);
        ctx.translate(1,0);
        drawRight1();
    };

    var drawUpDownBody0 = function() {
        plotLine([-6,-7,-7,-6],"#FFF");
        plotLine([5,-7,6,-6],"#FFF");
        plotSolid([
            -7,-3,
            -4,-6,
            -5,-7,
            -6,-7,
            -4,-7,
            -3,-6,
            -2,-6,
            -1,-5,
            0,-5,
            1,-6,
            2,-6,
            3,-7,
            5,-7,
            4,-7,
            3,-6,
            6,-3,
            6,1,
            5,3,
            4,5,
            3,6,
            -4,6,
            -5,5,
            -6,3,
            -7,1,
        ],color);
    };

    var drawUpDownBody1 = function() {
        plotLine([-6,-6,-7,-5],"#FFF");
        plotLine([5,-6,6,-5],"#FFF");
        plotSolid([
            -7,-3,
            -4,-6,
            -5,-7,
            -6,-6,
            -5,-7,
            -4,-7,
            -3,-6,
            -2,-6,
            -1,-5,
            0,-5,
            1,-6,
            2,-6,
            3,-7,
            4,-7,
            5,-6,
            4,-7,
            3,-6,
            6,-3,
            6,1,
            5,3,
            4,5,
            3,6,
            -4,6,
            -5,5,
            -6,3,
            -7,1,
        ],color);
    };

    var drawUp0 = function() {
        drawUpDownBody0();
        drawEye(DIR_UP,-5,-5);
        drawEye(DIR_UP,1,-5);
        plotSolid([
            -4,6,
            -3,5,
            -2,5,
            -1,6,
        ],"#00F");
    };

    var drawUp1 = function() {
        drawUpDownBody1();
        drawEye(DIR_UP,-5,-5);
        drawEye(DIR_UP,1,-5);
        plotSolid([
            0,6,
            1,5,
            2,5,
            3,6,
        ],"#00F");
    };

    var drawDown0 = function() {
        drawUpDownBody0();
        drawEye(DIR_DOWN,-5,-4);
        drawEye(DIR_DOWN,1,-4);
        plotSolid([
            0,6,
            1,4,
            2,3,
            3,3,
            4,4,
            4,5,
            3,6,
        ],"#00F");
        plotLine([-4,6,-2,6],"#00F");
    };

    var drawDown1 = function() {
        drawUpDownBody1();
        drawEye(DIR_DOWN,-5,-4);
        drawEye(DIR_DOWN,1,-4);
        plotSolid([
            -1,6,
            -2,4,
            -3,3,
            -4,3,
            -5,4,
            -5,5,
            -4,6,
        ],"#00F");
        plotLine([1,6,3,6],"#00F");
    };

    var borderColor;
    var faceColor;

    var drawScaredBody = function() {
        plotOutline([
            -6,-2,
            -2,-5,
            -3,-6,
            -5,-6,
            -3,-6,
            -1,-4,
            1,-4,
            3,-6,
            5,-6,
            3,-6,
            2,-5,
            6,-2,
            6,4,
            5,6,
            4,7,
            -4,7,
            -5,6,
            -6,4
        ],borderColor);

        plotLine([
            -2,4,
            -1,3,
            1,3,
            2,4
        ],faceColor);
    };


    var drawScared0 = function(flash) {
        plotLine([-2,-2,-2,0],faceColor);
        plotLine([-3,-1,-1,-1],faceColor);
        plotLine([2,-2,2,0],faceColor);
        plotLine([3,-1,1,-1],faceColor);
        plotLine([-5,-6,-6,-7],"#FFF");
        plotLine([5,-6,6,-7],"#FFF");
        drawScaredBody();
    };

    var drawScared1 = function(flash) {
        plotLine([-3,-2,-1,0],faceColor);
        plotLine([-3,0,-1,-2],faceColor);
        plotLine([1,-2,3,0],faceColor);
        plotLine([1,0,3,-2],faceColor);
        plotLine([-5,-6,-6,-5],"#FFF");
        plotLine([5,-6,6,-5],"#FFF");
        drawScaredBody();
    };

    return function(_ctx,x,y,frame,dirEnum,scared,flash,eyes_only,_color) {
        if (eyes_only) {
            return; // invisible
        }

        ctx = _ctx;
        color = _color;

        ctx.save();
        ctx.translate(x+0.5,y+0.5);

        if (scared) {
            ctx.translate(0,-1); // correct alignment error from my chosen coordinates
            borderColor = flash ? "#FFF" : "#00F";
            faceColor = flash ? "#F00" : "#FF0";
            [drawScared0, drawScared1][frame]();
        }
        else if (dirEnum == DIR_RIGHT) {
            [drawRight0, drawRight1][frame]();
        }
        else if (dirEnum == DIR_LEFT) {
            [drawLeft0, drawLeft1][frame]();
        }
        else if (dirEnum == DIR_DOWN) {
            [drawDown0, drawDown1][frame]();
        }
        else if (dirEnum == DIR_UP) {
            [drawUp0, drawUp1][frame]();
        }

        ctx.restore();
    };
})();

var drawColoredOttoSprite = function(color,eyeColor) {
    var ctx;

    var plotLine = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var plotSolid = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineJoin = "round";
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.fill();
        ctx.stroke();
    };

    var drawRightEye = function() {
        plotSolid([
            -4,-5,
            -3,-6,
            -2,-6,
            -2,-5,
            -3,-4,
            -4,-4,
        ],eyeColor);
    };

    var drawRight0 = function() {
        plotSolid([
            -5,-4,
            -3,-6,
            2,-6,
            3,-5,
            -1,-3,
            3,-1,
            1,1,
            1,3,
            3,6,
            5,4,
            6,4,
            6,5,
            4,7,
            2,7,
            -1,1,
            -4,4,
            -3,6,
            -3,7,
            -4,7,
            -6,5,
            -6,4,
            -3,1,
            -5,-1,
        ],color);
        drawRightEye();
    };
    var drawRight1 = function() {
        plotSolid([
            -5,-4,
            -3,-6,
            1,-6,
            3,-4,
            3,-1,
            1,1,
            1,6,
            4,6,
            4,7,
            0,7,
            0,1,
            -2,1,
            -4,3,
            -4,4,
            -3,5,
            -3,6,
            -4,6,
            -5,4,
            -5,3,
            -3,1,
            -5,-1,
        ],color);
        drawRightEye();
    };
    var drawRight2 = function() {
        plotSolid([
            -5,-4,
            -3,-6,
            2,-6,
            3,-5,
            -1,-3,
            3,-1,
            1,1,
            1,3,
            4,3,
            4,4,
            0,4,
            0,1,
            -2,1,
            -2,6,
            1,6,
            1,7,
            -3,7,
            -3,1,
            -5,-1,
        ],color);
        drawRightEye();
    };
    var drawRight3 = function() {
        plotSolid([
            -5,-4,
            -3,-6,
            2,-6,
            -2,-3,
            2,0,
            1,1,
            3,5,
            5,3,
            6,3,
            6,4,
            4,6,
            2,6,
            -1,1,
            -3,1,
            -3,6,
            0,6,
            0,7,
            -4,7,
            -4,2,
            -3,1,
            -5,-1,
        ],color);
        drawRightEye();
    };

    var drawUpDownEyes = function() {
        plotSolid([
            -5,-5,
            -4,-6,
            -3,-6,
            -3,-5,
            -4,-4,
            -5,-4,
        ],eyeColor);
        plotSolid([
            3,-6,
            4,-6,
            5,-5,
            5,-4,
            4,-4,
            3,-5,
        ],eyeColor);
    };

    var drawUpDownHead = function() {
        plotSolid([
            -4,-4,
            -2,-6,
            2,-6,
            4,-4,
            4,-1,
            2,1,
            -2,1,
            -4,-1,
        ],color);
    };

    var drawUpDownLeg0 = function(y,xs) {
        ctx.save();
        ctx.translate(0,y);
        ctx.scale(xs,1);

        plotSolid([
            1,0,
            2,0,
            2,6,
            4,6,
            4,7,
            1,7,
        ],color);

        ctx.restore();
    };

    var drawUpDownLeg1 = function(y,xs) {
        ctx.save();
        ctx.translate(0,y);
        ctx.scale(xs,1);

        plotSolid([
            1,0,
            2,0,
            2,4,
            3,5,
            4,4,
            5,4,
            5,5,
            3,7,
            2,7,
            1,6,
        ],color);

        ctx.restore();
    };
    var drawUpDownLegs0 = function() {
        drawUpDownLeg0(0,-1);
        drawUpDownLeg1(-2,1);
    };

    var drawUpDownLegs1 = function() {
        drawUpDownLeg0(-2,-1);
        drawUpDownLeg1(-2,1);
    };

    var drawUpDownLegs2 = function() {
        drawUpDownLeg1(-2,-1);
        drawUpDownLeg0(0,1);
    };

    var drawUpDownLegs3 = function() {
        drawUpDownLeg1(0,-1);
        drawUpDownLeg0(0,1);
    };

    var drawDown0 = function() {
        drawUpDownHead();
        drawUpDownEyes();
        drawUpDownLegs0();
        plotLine([-2,-3,2,-3],"#000");
    };
    var drawDown1 = function() {
        drawUpDownHead();
        drawUpDownEyes();
        drawUpDownLegs1();
    };
    var drawDown2 = function() {
        drawUpDownHead();
        drawUpDownEyes();
        drawUpDownLegs2();
        plotLine([-2,-3,2,-3],"#000");
    };
    var drawDown3 = function() {
        drawUpDownHead();
        drawUpDownEyes();
        drawUpDownLegs3();
        plotSolid([
            -2,-3,
            0,-5,
            2,-3,
            0,-1,
        ],"#000");
    };

    var drawUp0 = function() {
        drawUpDownEyes();
        drawUpDownHead();
        drawUpDownLegs0();
    };
    var drawUp1 = function() {
        drawUpDownEyes();
        drawUpDownHead();
        drawUpDownLegs1();
    };
    var drawUp2 = function() {
        drawUpDownEyes();
        drawUpDownHead();
        drawUpDownLegs2();
    };
    var drawUp3 = function() {
        drawUpDownEyes();
        drawUpDownHead();
        drawUpDownLegs3();
    };

    return function(_ctx,x,y,dirEnum,frame,rotate) {
        ctx = _ctx;

        ctx.save();
        ctx.translate(x+0.5,y+0.5);
        if (rotate) {
            ctx.rotate(rotate);
        }

        if (dirEnum == DIR_RIGHT) {
            ctx.translate(0,-1); // correct my coordinate system
            [drawRight0, drawRight1, drawRight2, drawRight3][frame]();
        }
        else if (dirEnum == DIR_LEFT) {
            ctx.translate(0,-1); // correct my coordinate system
            ctx.scale(-1,1);
            [drawRight0, drawRight1, drawRight2, drawRight3][frame]();
        }
        else if (dirEnum == DIR_DOWN) {
            ctx.translate(0,-1); // correct my coordinate system
            [drawDown0, drawDown1, drawDown2, drawDown3][frame]();
        }
        else if (dirEnum == DIR_UP) {
            ctx.translate(0,-1); // correct my coordinate system
            [drawUp0, drawUp1, drawUp2, drawUp3][frame]();
        }

        ctx.restore();
    };
};

var drawOttoSprite = drawColoredOttoSprite("#FF0","#00F");
var drawMsOttoSprite = drawColoredOttoSprite("#F00","#FFF");

var drawDeadOttoSprite = function(ctx,x,y) {
    var plotOutline = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };
    ctx.save();
    ctx.translate(x+2,y);
    plotOutline([
        3,-5,
        -1,-5,
        -2,-6,
        -2,-7,
        -1,-8,
        3,-8,
        4,-7,
        4,-6,
    ],"#F00");
    ctx.restore();
    drawOttoSprite(ctx,x,y,DIR_LEFT,2,Math.PI/2);
};

// draw pacman body
var drawPacmanSpriteOrig = function(ctx,x,y,dirEnum,angle,mouthShift,scale,centerShift,alpha,color,rot_angle) {

    if (mouthShift == undefined) mouthShift = 0;
    if (centerShift == undefined) centerShift = 0;
    if (scale == undefined) scale = 1;
    if (alpha == undefined) alpha = 1;

    if (color == undefined) {
        color = "rgba(255,255,0," + alpha + ")";
    }

    ctx.save();
    ctx.translate(x,y);
    ctx.scale(scale,scale);
    if (rot_angle) {
        ctx.rotate(rot_angle);
    }

    // rotate to current heading direction
    var d90 = Math.PI/2;
    if (dirEnum == DIR_UP) ctx.rotate(3*d90);
    else if (dirEnum == DIR_RIGHT) ctx.rotate(0);
    else if (dirEnum == DIR_DOWN) ctx.rotate(d90);
    else if (dirEnum == DIR_LEFT) ctx.rotate(2*d90);

    // plant corner of mouth
    ctx.beginPath();
    ctx.moveTo(-3+mouthShift,0);

    // draw head outline
    ctx.arc(centerShift,0,6.5,angle,2*Math.PI-angle);
    ctx.closePath();

    //ctx.strokeStyle = color;
    //ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
};

// Pac-Man sprite: moai image when available (only for the standard yellow Pac-Man),
// otherwise the original vector drawing.  Used by Ms. Pac-Man / Cookie-Man internals via Orig.
var drawPacmanSprite = function(ctx,x,y,dirEnum,angle,mouthShift,scale,centerShift,alpha,color,rot_angle) {
    if (customSprites.isReady() && color == undefined && !rot_angle) {
        customSprites.drawPacman(ctx,x,y,dirEnum,angle,mouthShift,scale,centerShift,alpha);
    }
    else {
        drawPacmanSpriteOrig(ctx,x,y,dirEnum,angle,mouthShift,scale,centerShift,alpha,color,rot_angle);
    }
};

// draw giant pacman body
var drawGiantPacmanSprite = function(ctx,x,y,dirEnum,frame) {

    if (customSprites.isReady()) {
        customSprites.drawGiantPacman(ctx,x,y,dirEnum,frame);
        return;
    }

    var color = "#FF0";
    var mouthShift = 0;
    var angle = 0;
    if (frame == 1) {
        mouthShift = -4;
        angle = Math.atan(7/14);
    }
    else if (frame == 2) {
        mouthShift = -2;
        angle = Math.atan(13/9);
    }

    ctx.save();
    ctx.translate(x,y);

    // rotate to current heading direction
    var d90 = Math.PI/2;
    if (dirEnum == DIR_UP) ctx.rotate(3*d90);
    else if (dirEnum == DIR_RIGHT) ctx.rotate(0);
    else if (dirEnum == DIR_DOWN) ctx.rotate(d90);
    else if (dirEnum == DIR_LEFT) ctx.rotate(2*d90);

    // plant corner of mouth
    ctx.beginPath();
    ctx.moveTo(mouthShift,0);

    // draw head outline
    ctx.arc(0,0,16,angle,2*Math.PI-angle);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
};

var drawMsPacmanSprite = function(ctx,x,y,dirEnum,frame,rot_angle) {
    var angle = 0;

    // draw body
    if (frame == 0) {
        // closed
        drawPacmanSpriteOrig(ctx,x,y,dirEnum,0,undefined,undefined,undefined,undefined,undefined,rot_angle);
    }
    else if (frame == 1) {
        // open
        angle = Math.atan(4/5);
        drawPacmanSpriteOrig(ctx,x,y,dirEnum,angle,undefined,undefined,undefined,undefined,undefined,rot_angle);
        angle = Math.atan(4/8); // angle for drawing eye
    }
    else if (frame == 2) {
        // wide
        angle = Math.atan(6/3);
        drawPacmanSpriteOrig(ctx,x,y,dirEnum,angle,undefined,undefined,undefined,undefined,undefined,rot_angle);
        angle = Math.atan(6/6); // angle for drawing eye
    }

    ctx.save();
    ctx.translate(x,y);
    if (rot_angle) {
        ctx.rotate(rot_angle);
    }

    // reflect or rotate sprite according to current direction
    var d90 = Math.PI/2;
    if (dirEnum == DIR_UP)
        ctx.rotate(-d90);
    else if (dirEnum == DIR_DOWN)
        ctx.rotate(d90);
    else if (dirEnum == DIR_LEFT)
        ctx.scale(-1,1);

    // bow
    var x=-7.5,y=-7.5;
    ctx.fillStyle = "#F00";
    ctx.beginPath(); ctx.arc(x+1,y+4,1.25,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x+2,y+5,1.25,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x+3,y+3,1.25,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x+4,y+1,1.25,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x+5,y+2,1.25,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#0031FF";
    ctx.beginPath(); ctx.arc(x+2.5,y+3.5,0.5,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x+3.5,y+2.5,0.5,0,Math.PI*2); ctx.closePath(); ctx.fill();

    // lips
    ctx.strokeStyle = "#F00";
    ctx.lineWidth = 1.25;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (frame == 0) {
        ctx.moveTo(5,0);
        ctx.lineTo(6.5,0);
        ctx.moveTo(6.5,-1.5);
        ctx.lineTo(6.5,1.5);
    }
    else {
        var r1 = 7.5;
        var r2 = 8.5;
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        ctx.moveTo(-3+r1*c,r1*s);
        ctx.lineTo(-3+r2*c,r2*s);
        ctx.moveTo(-3+r1*c,-r1*s);
        ctx.lineTo(-3+r2*c,-r2*s);
    }
    ctx.stroke();

    // mole
    ctx.beginPath();
    ctx.arc(-3,2,0.5,0,Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();

    // eye
    ctx.strokeStyle = "#000";
    ctx.lineCap = "round";
    ctx.beginPath();
    if (frame == 0) {
        ctx.moveTo(-2.5,-2);
        ctx.lineTo(-0.5,-2);
    }
    else {
        var r1 = 0.5;
        var r2 = 2.5;
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        ctx.moveTo(-3+r1*c,-2-r1*s);
        ctx.lineTo(-3+r2*c,-2-r2*s);
    }
    ctx.stroke();

    ctx.restore();
};

var drawCookiemanSprite = (function(){

    // TODO: draw pupils separately in atlas
    //      composite the body frame and a random pupil frame when drawing cookie-man

    var prevFrame = undefined;
    var sx1 = 0; // shift x for first pupil
    var sy1 = 0; // shift y for first pupil
    var sx2 = 0; // shift x for second pupil
    var sy2 = 0; // shift y for second pupil

    var er = 2.1; // eye radius
    var pr = 1; // pupil radius

    var movePupils = function() {
        var a1 = Math.random()*Math.PI*2;
        var a2 = Math.random()*Math.PI*2;
        var r1 = Math.random()*pr;
        var r2 = Math.random()*pr;

        sx1 = Math.cos(a1)*r1;
        sy1 = Math.sin(a1)*r1;
        sx2 = Math.cos(a2)*r2;
        sy2 = Math.sin(a2)*r2;
    };

    return function(ctx,x,y,dirEnum,frame,shake,rot_angle) {
        var angle = 0;

        // draw body
        var draw = function(angle) {
            //angle = Math.PI/6*frame;
            drawPacmanSpriteOrig(ctx,x,y,dirEnum,angle,undefined,undefined,undefined,undefined,"#47b8ff",rot_angle);
        };
        if (frame == 0) {
            // closed
            draw(0);
        }
        else if (frame == 1) {
            // open
            angle = Math.atan(4/5);
            draw(angle);
            angle = Math.atan(4/8); // angle for drawing eye
        }
        else if (frame == 2) {
            // wide
            angle = Math.atan(6/3);
            draw(angle);
            angle = Math.atan(6/6); // angle for drawing eye
        }

        ctx.save();
        ctx.translate(x,y);
        if (rot_angle) {
            ctx.rotate(rot_angle);
        }

        // reflect or rotate sprite according to current direction
        var d90 = Math.PI/2;
        if (dirEnum == DIR_UP)
            ctx.rotate(-d90);
        else if (dirEnum == DIR_DOWN)
            ctx.rotate(d90);
        else if (dirEnum == DIR_LEFT)
            ctx.scale(-1,1);

        var x = -4; // pivot point
        var y = -3.5;
        var r1 = 3;   // distance from pivot of first eye
        var r2 = 6; // distance from pivot of second eye
        angle /= 3; // angle from pivot point
        angle += Math.PI/8;
        var c = Math.cos(angle);
        var s = Math.sin(angle);

        if (shake) {
            if (frame != prevFrame) {
                movePupils();
            }
            prevFrame = frame;
        }

        // second eyeball
        ctx.beginPath();
        ctx.arc(x+r2*c, y-r2*s, er, 0, Math.PI*2);
        ctx.fillStyle = "#FFF";
        ctx.fill();
        // second pupil
        ctx.beginPath();
        ctx.arc(x+r2*c+sx2, y-r2*s+sy2, pr, 0, Math.PI*2);
        ctx.fillStyle = "#000";
        ctx.fill();

        // first eyeball
        ctx.beginPath();
        ctx.arc(x+r1*c, y-r1*s, er, 0, Math.PI*2);
        ctx.fillStyle = "#FFF";
        ctx.fill();
        // first pupil
        ctx.beginPath();
        ctx.arc(x+r1*c+sx1, y-r1*s+sy1, pr, 0, Math.PI*2);
        ctx.fillStyle = "#000";
        ctx.fill();

        ctx.restore();

    };
})();

////////////////////////////////////////////////////////////////////
// FRUIT SPRITES

var drawCherry = function(ctx,x,y) {

    // cherry
    var cherry = function(x,y) {
        ctx.save();
        ctx.translate(x,y);

        // red fruit
        ctx.beginPath();
        ctx.arc(2.5,2.5,3,0,Math.PI*2);
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = "#000";
        ctx.stroke();
        ctx.fillStyle = "#ff0000";
        ctx.fill();

        // white shine
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(1,3);
        ctx.lineTo(2,4);
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.restore();
    };

    ctx.save();
    ctx.translate(x,y);

    // draw both cherries
    cherry(-6,-1);
    cherry(-1,1);

    // draw stems
    ctx.beginPath();
    ctx.moveTo(-3,0);
    ctx.bezierCurveTo(-1,-2, 2,-4, 5,-5);
    ctx.lineTo(5,-4);
    ctx.bezierCurveTo(3,-4, 1,0, 1,2);
    ctx.strokeStyle = "#ff9900";
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
};

var drawStrawberry = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // red body
    ctx.beginPath();
    ctx.moveTo(-1,-4);
    ctx.bezierCurveTo(-3,-4,-5,-3, -5,-1);
    ctx.bezierCurveTo(-5,3,-2,5, 0,6);
    ctx.bezierCurveTo(3,5, 5,2, 5,0);
    ctx.bezierCurveTo(5,-3, 3,-4, 0,-4);
    ctx.fillStyle = "#f00";
    ctx.fill();
    ctx.strokeStyle = "#f00";
    ctx.stroke();

    // white spots
    var spots = [
        {x:-4,y:-1},
        {x:-3,y:2 },
        {x:-2,y:0 },
        {x:-1,y:4 },
        {x:0, y:2 },
        {x:0, y:0 },
        {x:2, y:4 },
        {x:2, y:-1 },
        {x:3, y:1 },
        {x:4, y:-2 } ];

    ctx.fillStyle = "#fff";
    var i,len;
    for (i=0, len=spots.length; i<len; i++) {
        var s = spots[i];
        ctx.beginPath();
        ctx.arc(s.x,s.y,0.75,0,2*Math.PI);
        ctx.fill();
    }

    // green leaf
    ctx.beginPath();
    ctx.moveTo(0,-4);
    ctx.lineTo(-3,-4);
    ctx.lineTo(0,-4);
    ctx.lineTo(-2,-3);
    ctx.lineTo(-1,-3);
    ctx.lineTo(0,-4);
    ctx.lineTo(0,-2);
    ctx.lineTo(0,-4);
    ctx.lineTo(1,-3);
    ctx.lineTo(2,-3);
    ctx.lineTo(0,-4);
    ctx.lineTo(3,-4);
    ctx.closePath();
    ctx.strokeStyle = "#00ff00";
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // stem
    ctx.beginPath();
    ctx.moveTo(0,-4);
    ctx.lineTo(0,-5);
    ctx.lineCap = 'round';
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.restore();
};

var drawOrange = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // orange body
    ctx.beginPath();
    ctx.moveTo(-2,-2);
    ctx.bezierCurveTo(-3,-2, -5,-1, -5,1);
    ctx.bezierCurveTo(-5,4, -3,6, 0,6);
    ctx.bezierCurveTo(3,6, 5,4, 5,1);
    ctx.bezierCurveTo(5,-1, 3,-2, 2,-2);
    ctx.closePath();
    ctx.fillStyle="#ffcc33";
    ctx.fill();
    ctx.strokeStyle = "#ffcc33";
    ctx.stroke();

    // stem
    ctx.beginPath();
    ctx.moveTo(-1,-1);
    ctx.quadraticCurveTo(-1,-2,-2,-2);
    ctx.quadraticCurveTo(-1,-2,-1,-4);
    ctx.quadraticCurveTo(-1,-2,0,-2);
    ctx.quadraticCurveTo(-1,-2,-1,-1);
    ctx.strokeStyle = "#ff9900";
    ctx.lineJoin = 'round';
    ctx.stroke();

    // green leaf
    ctx.beginPath();
    ctx.moveTo(-0.5,-4);
    ctx.quadraticCurveTo(0,-5,1,-5);
    ctx.bezierCurveTo(2,-5, 3,-4,4,-4);
    ctx.bezierCurveTo(3,-4, 3,-3, 2,-3);
    ctx.bezierCurveTo(1,-3,1,-4,-0.5,-4);
    ctx.strokeStyle = "#00ff00";
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = "#00ff00";
    ctx.fill();

    ctx.restore();
};

var drawApple = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // red fruit
    ctx.beginPath();
    ctx.moveTo(-2,-3);
    ctx.bezierCurveTo(-2,-4,-3,-4,-4,-4);
    ctx.bezierCurveTo(-5,-4,-6,-3,-6,0);
    ctx.bezierCurveTo(-6,3,-4,6,-2.5,6);
    ctx.quadraticCurveTo(-1,6,-1,5);
    ctx.bezierCurveTo(-1,6,0,6,1,6);
    ctx.bezierCurveTo(3,6, 5,3, 5,0);
    ctx.bezierCurveTo(5,-3, 3,-4, 2,-4);
    ctx.quadraticCurveTo(0,-4,0,-3);
    ctx.closePath();
    ctx.fillStyle = "#ff0000";
    ctx.fill();

    // stem
    ctx.beginPath();
    ctx.moveTo(-1,-3);
    ctx.quadraticCurveTo(-1,-5, 0,-5);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ff9900';
    ctx.stroke();

    // shine
    ctx.beginPath();
    ctx.moveTo(2,3);
    ctx.quadraticCurveTo(3,3, 3,1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    ctx.restore();
};

var drawMelon = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // draw body
    ctx.beginPath();
    ctx.arc(0,2,5.5,0,Math.PI*2);
    ctx.fillStyle = "#7bf331";
    ctx.fill();

    // draw stem
    ctx.beginPath();
    ctx.moveTo(0,-4);
    ctx.lineTo(0,-5);
    ctx.moveTo(2,-5);
    ctx.quadraticCurveTo(-3,-5,-3,-6);
    ctx.strokeStyle="#69b4af";
    ctx.lineCap = "round";
    ctx.stroke();

    // dark lines
    /*
    ctx.beginPath();
    ctx.moveTo(0,-2);
    ctx.lineTo(-4,2);
    ctx.lineTo(-1,5);
    ctx.moveTo(-3,-1);
    ctx.lineTo(-2,0);
    ctx.moveTo(-2,6);
    ctx.lineTo(1,3);
    ctx.moveTo(1,7);
    ctx.lineTo(3,5);
    ctx.lineTo(0,2);
    ctx.lineTo(3,-1);
    ctx.moveTo(2,0);
    ctx.lineTo(4,2);
    ctx.strokeStyle="#69b4af";
    ctx.lineCap = "round";
    ctx.lineJoin = 'round';
    ctx.stroke();
    */
    // dark spots
    var spots = [
        0,-2,
        -1,-1,
        -2,0,
        -3,1,
        -4,2,
        -3,3,
        -2,4,
        -1,5,
        -2,6,
        -3,-1,
        1,7,
        2,6,
        3,5,
        2,4,
        1,3,
        0,2,
        1,1,
        2,0,
        3,-1,
        3,1,
        4,2,
         ];

    ctx.fillStyle="#69b4af";
    var i,len;
    for (i=0, len=spots.length; i<len; i+=2) {
        var x = spots[i];
        var y = spots[i+1];
        ctx.beginPath();
        ctx.arc(x,y,0.65,0,2*Math.PI);
        ctx.fill();
    }

    // white spots
    var spots = [
        {x: 0,y:-3},
        {x:-2,y:-1},
        {x:-4,y: 1},
        {x:-3,y: 3},
        {x: 1,y: 0},
        {x:-1,y: 2},
        {x:-1,y: 4},
        {x: 3,y: 2},
        {x: 1,y: 4},
         ];

    ctx.fillStyle = "#fff";
    var i,len;
    for (i=0, len=spots.length; i<len; i++) {
        var s = spots[i];
        ctx.beginPath();
        ctx.arc(s.x,s.y,0.65,0,2*Math.PI);
        ctx.fill();
    }

    ctx.restore();
};

var drawGalaxian = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // draw yellow body
    ctx.beginPath();
    ctx.moveTo(-4,-2);
    ctx.lineTo(4,-2);
    ctx.lineTo(4,-1);
    ctx.lineTo(2,1);
    ctx.lineTo(1,0);
    ctx.lineTo(0,0);
    ctx.lineTo(0,5);
    ctx.lineTo(0,0);
    ctx.lineTo(-1,0);
    ctx.lineTo(-2,1);
    ctx.lineTo(-4,-1);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ctx.fillStyle = '#fffa36';
    ctx.fill();
    ctx.stroke();

    // draw red arrow head
    ctx.beginPath();
    ctx.moveTo(0,-5);
    ctx.lineTo(-3,-2);
    ctx.lineTo(-2,-2);
    ctx.lineTo(-1,-3);
    ctx.lineTo(0,-3);
    ctx.lineTo(0,-1);
    ctx.lineTo(0,-3);
    ctx.lineTo(1,-3);
    ctx.lineTo(2,-2);
    ctx.lineTo(3,-2);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ctx.fillStyle = "#f00";
    ctx.fill();
    ctx.stroke();

    // draw blue wings
    ctx.beginPath();
    ctx.moveTo(-5,-4);
    ctx.lineTo(-5,-1);
    ctx.lineTo(-2,2);
    ctx.moveTo(5,-4);
    ctx.lineTo(5,-1);
    ctx.lineTo(2,2);
    ctx.strokeStyle = "#00f";
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();
};

var drawBell = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // bell body
    ctx.beginPath();
    ctx.moveTo(-1,-5);
    ctx.bezierCurveTo(-4,-5,-6,1,-6,6);
    ctx.lineTo(5,6);
    ctx.bezierCurveTo(5,1,3,-5,0,-5);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle = "#fffa37";
    ctx.stroke();
    ctx.fill();

    // marks
    ctx.beginPath();
    ctx.moveTo(-4,4);
    ctx.lineTo(-4,3);
    ctx.moveTo(-3,1);
    ctx.quadraticCurveTo(-3,-2,-2,-2);
    ctx.moveTo(-1,-4);
    ctx.lineTo(0,-4);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // bell bottom
    ctx.beginPath();
    ctx.rect(-5.5,6,10,2);
    ctx.fillStyle = "#68b9fc";
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-0.5,6,2,2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.restore();
};

var drawKey = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // draw key metal
    ctx.beginPath();
    ctx.moveTo(-1,-2);
    ctx.lineTo(-1,5);
    ctx.moveTo(0,6);
    ctx.quadraticCurveTo(1,6,1,3);
    ctx.moveTo(1,4);
    ctx.lineTo(2,4);
    ctx.moveTo(1,1);
    ctx.lineTo(1,-2);
    ctx.moveTo(1,0);
    ctx.lineTo(2,0);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    // draw key top
    ctx.beginPath();
    ctx.moveTo(0,-6);
    ctx.quadraticCurveTo(-3,-6,-3,-4);
    ctx.lineTo(-3,-2);
    ctx.lineTo(3,-2);
    ctx.lineTo(3,-4);
    ctx.quadraticCurveTo(3,-6, 0,-6);
    ctx.strokeStyle = ctx.fillStyle = "#68b9fc";
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1,-5);
    ctx.lineTo(-1,-5);
    ctx.lineCap = 'round';
    ctx.strokeStyle = "#000";
    ctx.stroke();

    ctx.restore();
};

var drawPretzel = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // bread
    ctx.beginPath();
    ctx.moveTo(-2,-5);
    ctx.quadraticCurveTo(-4,-6,-6,-4);
    ctx.quadraticCurveTo(-7,-2,-5,1);
    ctx.quadraticCurveTo(-3,4,0,5);
    ctx.quadraticCurveTo(5,5,5,-1);
    ctx.quadraticCurveTo(6,-5,3,-5);
    ctx.quadraticCurveTo(1,-5,0,-2);
    ctx.quadraticCurveTo(-2,3,-5,5);
    ctx.moveTo(1,1);
    ctx.quadraticCurveTo(3,4,4,6);
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.strokeStyle = "#ffcc33";
    ctx.stroke();

    // salt
    var spots = [
        -5,-6,
        1,-6,
        4,-4,
        -5,0,
        -2,0,
        6,1,
        -4,6,
        5,5,
         ];

    ctx.fillStyle = "#fff";
    var i,len;
    for (i=0, len=spots.length; i<len; i+=2) {
        var x = spots[i];
        var y = spots[i+1];
        ctx.beginPath();
        ctx.arc(x,y,0.65,0,2*Math.PI);
        ctx.fill();
    }

    ctx.restore();
};

var drawPear = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // body
    ctx.beginPath();
    ctx.moveTo(0,-4);
    ctx.bezierCurveTo(-1,-4,-2,-3,-2,-1);
    ctx.bezierCurveTo(-2,1,-4,2,-4,4);
    ctx.bezierCurveTo(-4,6,-2,7,0,7);
    ctx.bezierCurveTo(2,7,4,6,4,4);
    ctx.bezierCurveTo(4,2,2,1,2,-1);
    ctx.bezierCurveTo(2,-3,1,-4,0,-4);
    ctx.fillStyle = ctx.strokeStyle = "#00ff00";
    ctx.stroke();
    ctx.fill();

    // blue shine
    ctx.beginPath();
    ctx.moveTo(-2,3);
    ctx.quadraticCurveTo(-2,5,-1,5);
    ctx.strokeStyle = "#0033ff";
    ctx.lineCap = 'round';
    ctx.stroke();

    // white stem
    ctx.beginPath();
    ctx.moveTo(0,-4);
    ctx.quadraticCurveTo(0,-6,2,-6);
    ctx.strokeStyle = "#fff";
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
};

var drawBanana = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // body
    ctx.beginPath();
    ctx.moveTo(-5,5);
    ctx.quadraticCurveTo(-4,5,-2,6);
    ctx.bezierCurveTo(2,6,6,2,6,-4);
    ctx.lineTo(3,-3);
    ctx.lineTo(3,-2);
    ctx.lineTo(-4,5);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle = "#ffff00";
    ctx.stroke();
    ctx.fill();

    // stem
    ctx.beginPath();
    ctx.moveTo(4,-5);
    ctx.lineTo(5,-6);
    ctx.strokeStyle="#ffff00";
    ctx.lineCap='round';
    ctx.stroke();

    // black mark
    ctx.beginPath();
    ctx.moveTo(3,-1);
    ctx.lineTo(-2,4);
    ctx.strokeStyle = "#000";
    ctx.lineCap='round';
    ctx.stroke();

    // shine
    ctx.beginPath();
    ctx.moveTo(2,3);
    ctx.lineTo(0,5);
    ctx.strokeStyle = "#fff";
    ctx.lineCap='round';
    ctx.stroke();

    ctx.restore();
};

var drawCookie = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // body
    ctx.beginPath();
    ctx.arc(0,0,6,0,Math.PI*2);
    ctx.fillStyle = "#f9bd6d";
    //ctx.fillStyle = "#dfab68";
    ctx.fill();

    // chocolate chips
    var spots = [
        0,-3,
        -4,-1,
        0,2,
        3,0,
        3,3,
         ];

    ctx.fillStyle = "#000";
    var i,len;
    for (i=0, len=spots.length; i<len; i+=2) {
        var x = spots[i];
        var y = spots[i+1];
        ctx.beginPath();
        ctx.arc(x,y,0.75,0,2*Math.PI);
        ctx.fill();
    }

    ctx.restore();
};

var drawCookieFlash = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // body
    ctx.beginPath();
    ctx.arc(0,0,6,0,Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f9bd6d";
    ctx.fill();
    ctx.stroke();

    // chocolate chips
    var spots = [
        0,-3,
        -4,-1,
        0,2,
        3,0,
        3,3,
         ];

    ctx.fillStyle = "#f9bd6d";
    var i,len;
    for (i=0, len=spots.length; i<len; i+=2) {
        var x = spots[i];
        var y = spots[i+1];
        ctx.beginPath();
        ctx.arc(x,y,0.75,0,2*Math.PI);
        ctx.fill();
    }

    ctx.restore();
};

var getSpriteFuncFromFruitName = function(name) {
    var funcs = {
        'cherry': drawCherry,
        'strawberry': drawStrawberry,
        'orange': drawOrange,
        'apple': drawApple,
        'melon': drawMelon,
        'galaxian': drawGalaxian,
        'bell': drawBell,
        'key': drawKey,
        'pretzel': drawPretzel,
        'pear': drawPear,
        'banana': drawBanana,
        'cookie': drawCookie,
    };

    return funcs[name];
};

var drawRecordSymbol = function(ctx,x,y,color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(x,y);

    ctx.beginPath();
    ctx.arc(0,0,4,0,Math.PI*2);
    ctx.fill();

    ctx.restore();
};

var drawRewindSymbol = function(ctx,x,y,color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(x,y);

    var s = 3;
    var drawTriangle = function(x) {
        ctx.beginPath();
        ctx.moveTo(x,s);
        ctx.lineTo(x-2*s,0);
        ctx.lineTo(x,-s);
        ctx.closePath();
        ctx.fill();
    };
    drawTriangle(0);
    drawTriangle(2*s);

    ctx.restore();
};

var drawUpSymbol = function(ctx,x,y,color) {
    ctx.save();
    ctx.translate(x,y);
    var s = tileSize;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0,-s/2);
    ctx.lineTo(s/2,s/2);
    ctx.lineTo(-s/2,s/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};

var drawDownSymbol = function(ctx,x,y,color) {
    ctx.save();
    ctx.translate(x,y);
    var s = tileSize;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0,s/2);
    ctx.lineTo(s/2,-s/2);
    ctx.lineTo(-s/2,-s/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};

var drawSnail = (function(){
    var plotSolid = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineJoin = "round";
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.fill();
        ctx.stroke();
    };
    return function(ctx,x,y,color) {
        ctx.save();
        ctx.translate(x,y);
        ctx.beginPath();
        ctx.moveTo(-7,3);
        ctx.lineTo(-5,3);
        ctx.bezierCurveTo(-6,0,-5,-3,-2,-3);
        ctx.bezierCurveTo(0,-3,2,-2,2,2);
        ctx.bezierCurveTo(3,-1,3,-2,5,-2);
        ctx.bezierCurveTo(6,-2,6,0,5,0);
        ctx.bezierCurveTo(4,1,4,3,2,3);
        ctx.closePath();

        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(4,-2);
        ctx.lineTo(3,-5);
        ctx.moveTo(5,-1);
        ctx.lineTo(7,-5);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(3,-5, 1, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(7,-5, 1, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-4,1);
        ctx.bezierCurveTo(-5,-1,-3,-3, -1,-2);
        ctx.bezierCurveTo(0,-1,0,0,-1,1);
        ctx.bezierCurveTo(-2,1,-3,0,-2,-0.5);
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = "#000";
        ctx.stroke();

        ctx.restore();
    };
})();

var drawHeartSprite = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle = "#ffb8ff";

    ctx.beginPath();
    ctx.moveTo(0,-3);
    ctx.bezierCurveTo(-1,-4,-2,-6,-3.5,-6);
    ctx.quadraticCurveTo(-7,-6,-7,-0.5);
    ctx.bezierCurveTo(-7,2,-2,5,0,7);
    ctx.bezierCurveTo(2,5,7,2,7,-0.5);
    ctx.quadraticCurveTo(7,-6,3.5,-6);
    ctx.bezierCurveTo(2,-6,1,-4,0,-3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
};

var drawExclamationPoint = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = ctx.fillStyle = "#ff0";
    ctx.beginPath();
    ctx.moveTo(-1,1);
    ctx.bezierCurveTo(-1,0,-1,-3,0,-3);
    ctx.lineTo(2,-3);
    ctx.bezierCurveTo(2,-2,0,0,-1,1);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-2,3,0.5,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
};
//@line 1 "src/Actor.js"
//////////////////////////////////////////////////////////////////////////////////////
// The actor class defines common data functions for the ghosts and pacman
// It provides everything for updating position and direction.

// "Ghost" and "Player" inherit from this "Actor"

// Actor constructor
var Actor = function() {

    this.dir = {};          // facing direction vector
    this.pixel = {};        // pixel position
    this.tile = {};         // tile position
    this.tilePixel = {};    // pixel location inside tile
    this.distToMid = {};    // pixel distance to mid-tile

    this.targetTile = {};   // tile position used for targeting

    this.frames = 0;        // frame count
    this.steps = 0;         // step count

    this.isDrawTarget = false;
    this.isDrawPath = false;

    this.savedSteps = {};
    this.savedFrames = {};
    this.savedDirEnum = {};
    this.savedPixel = {};
    this.savedTargetting = {};
    this.savedTargetTile = {};
};

// save state at time t
Actor.prototype.save = function(t) {
    this.savedSteps[t] = this.steps;
    this.savedFrames[t] = this.frames;
    this.savedDirEnum[t] = this.dirEnum;
    this.savedPixel[t] = { x:this.pixel.x, y:this.pixel.y };
    this.savedTargetting[t] = this.targetting;
    this.savedTargetTile[t] = { x: this.targetTile.x, y: this.targetTile.y };
};

// load state at time t
Actor.prototype.load = function(t) {
    this.steps = this.savedSteps[t];
    this.frames = this.savedFrames[t];
    this.setDir(this.savedDirEnum[t]);
    this.setPos(this.savedPixel[t].x, this.savedPixel[t].y);
    this.targetting = this.savedTargetting[t];
    this.targetTile.x = this.savedTargetTile[t].x;
    this.targetTile.y = this.savedTargetTile[t].y;
};


// reset to initial position and direction
Actor.prototype.reset = function() {
    this.setDir(this.startDirEnum);
    this.setPos(this.startPixel.x, this.startPixel.y);
    this.frames = 0;
    this.steps = 0;
    this.targetting = false;
};

// sets the position and updates its dependent variables
Actor.prototype.setPos = function(px,py) {
    this.pixel.x = px;
    this.pixel.y = py;
    this.commitPos();
};

// returns the relative pixel inside a tile given a map pixel
Actor.prototype.getTilePixel = function(pixel,tilePixel) {
    if (pixel == undefined) {
        pixel = this.pixel;
    }
    if (tilePixel == undefined) {
        tilePixel = {};
    }
    tilePixel.x = pixel.x % tileSize;
    tilePixel.y = pixel.y % tileSize;
    if (tilePixel.x < 0) {
        tilePixel.x += tileSize;
    }
    if (tilePixel.y < 0) {
        tilePixel.y += tileSize;
    }
    return tilePixel;
};

// updates the position's dependent variables
Actor.prototype.commitPos = function() {

    // use map-specific tunnel teleport
    if (map) {
        map.teleport(this);
    }

    this.tile.x = Math.floor(this.pixel.x / tileSize);
    this.tile.y = Math.floor(this.pixel.y / tileSize);
    this.getTilePixel(this.pixel,this.tilePixel);
    this.distToMid.x = midTile.x - this.tilePixel.x;
    this.distToMid.y = midTile.y - this.tilePixel.y;
};

// sets the direction and updates its dependent variables
Actor.prototype.setDir = function(dirEnum) {
    setDirFromEnum(this.dir, dirEnum);
    this.dirEnum = dirEnum;
};

// used as "pattern" parameter in getStepSizeFromTable()
var STEP_PACMAN = 0;
var STEP_GHOST = 1;
var STEP_PACMAN_FRIGHT = 2;
var STEP_GHOST_FRIGHT = 3;
var STEP_GHOST_TUNNEL = 4;
var STEP_ELROY1 = 5;
var STEP_ELROY2 = 6;

// getter function to extract a step size from speed control table
Actor.prototype.getStepSizeFromTable = (function(){

    // Actor speed is controlled by a list of 16 values.
    // Each value is the number of steps to take in a specific frame.
    // Once the end of the list is reached, we cycle to the beginning.
    // This method allows us to represent different speeds in a low-resolution space.

    // speed control table (from Jamey Pittman)
    var stepSizes = (
                         // LEVEL 1
    "1111111111111111" + // pac-man (normal)
    "0111111111111111" + // ghosts (normal)
    "1111211111112111" + // pac-man (fright)
    "0110110101101101" + // ghosts (fright)
    "0101010101010101" + // ghosts (tunnel)
    "1111111111111111" + // elroy 1
    "1111111121111111" + // elroy 2

                         // LEVELS 2-4
    "1111211111112111" + // pac-man (normal)
    "1111111121111111" + // ghosts (normal)
    "1111211112111121" + // pac-man (fright)
    "0110110110110111" + // ghosts (fright)
    "0110101011010101" + // ghosts (tunnel)
    "1111211111112111" + // elroy 1
    "1111211112111121" + // elroy 2

                         // LEVELS 5-20
    "1121112111211121" + // pac-man (normal)
    "1111211112111121" + // ghosts (normal)
    "1121112111211121" + // pac-man (fright) (N/A for levels 17, 19 & 20)
    "0111011101110111" + // ghosts (fright)  (N/A for levels 17, 19 & 20)
    "0110110101101101" + // ghosts (tunnel)
    "1121112111211121" + // elroy 1
    "1121121121121121" + // elroy 2

                         // LEVELS 21+
    "1111211111112111" + // pac-man (normal)
    "1111211112111121" + // ghosts (normal)
    "0000000000000000" + // pac-man (fright) N/A
    "0000000000000000" + // ghosts (fright)  N/A
    "0110110101101101" + // ghosts (tunnel)
    "1121112111211121" + // elroy 1
    "1121121121121121"); // elroy 2

    return function(level, pattern) {
        var entry;
        if (level < 1) return;
        else if (level==1)                  entry = 0;
        else if (level >= 2 && level <= 4)  entry = 1;
        else if (level >= 5 && level <= 20) entry = 2;
        else if (level >= 21)               entry = 3;
        return stepSizes[entry*7*16 + pattern*16 + this.frames%16];
    };
})();

// updates the actor state
Actor.prototype.update = function(j) {

    // get number of steps to advance in this frame
    var numSteps = this.getNumSteps();
    if (j >= numSteps) 
        return;

    // request to advance one step, and increment count if step taken
    this.steps += this.step();

    // update head direction
    this.steer();
};
//@line 1 "src/Ghost.js"
//////////////////////////////////////////////////////////////////////////////////////
// Ghost class

// modes representing the ghost's current state
var GHOST_OUTSIDE = 0;
var GHOST_EATEN = 1;
var GHOST_GOING_HOME = 2;
var GHOST_ENTERING_HOME = 3;
var GHOST_PACING_HOME = 4;
var GHOST_LEAVING_HOME = 5;

// Ghost constructor
var Ghost = function() {
    // inherit data from Actor
    Actor.apply(this);

    this.randomScatter = false;
    this.faceDirEnum = this.dirEnum;
};

// inherit functions from Actor class
Ghost.prototype = newChildObject(Actor.prototype);

// displacements for ghost bouncing
Ghost.prototype.getBounceY = (function(){

    // NOTE: The bounce animation assumes an actor is moving in straight
    // horizontal or vertical lines between the centers of each tile.
    //
    // When moving horizontal, bounce height is a function of x.
    // When moving vertical, bounce height is a function of y.

    var bounceY = {};

    // map y tile pixel to new y tile pixel
    bounceY[DIR_UP] =    [-4,-2,0,2,4,3,2,3];
    bounceY[DIR_DOWN] =  [3,5,7,5,4,5,7,8];

    // map x tile pixel to y tile pixel
    bounceY[DIR_LEFT] =  [2,3,3,4,3,2,2,2];
    bounceY[DIR_RIGHT] = [2,2,3,4,3,3,2,2];

    return function(px,py,dirEnum) {
        if (px == undefined) {
            px = this.pixel.x;
        }
        if (py == undefined) {
            py = this.pixel.y;
        }
        if (dirEnum == undefined) {
            dirEnum = this.dirEnum;
        }

        if (this.mode != GHOST_OUTSIDE || !this.scared || gameMode != GAME_COOKIE) {
            return py;
        }

        var tilePixel = this.getTilePixel({x:px,y:py});
        var tileY = Math.floor(py / tileSize);
        var y = tileY*tileSize;

        if (dirEnum == DIR_UP || dirEnum == DIR_DOWN) {
            y += bounceY[dirEnum][tilePixel.y];
        }
        else {
            y += bounceY[dirEnum][tilePixel.x];
        }

        return y;
    };
})();

Ghost.prototype.getAnimFrame = function(frames) {
    if (frames == undefined) {
        frames = this.frames;
    }
    return Math.floor(frames/8)%2; // toggle frame every 8 ticks
};

// reset the state of the ghost on new level or level restart
Ghost.prototype.reset = function() {

    // signals
    this.sigReverse = false;
    this.sigLeaveHome = false;

    // modes
    this.mode = this.startMode;
    this.scared = false;
    audio.ghostReset();

    this.savedSigReverse = {};
    this.savedSigLeaveHome = {};
    this.savedMode = {};
    this.savedScared = {};
    this.savedElroy = {};
    this.savedFaceDirEnum = {};

    // call Actor's reset function to reset position and direction
    Actor.prototype.reset.apply(this);

    // faceDirEnum  = direction the ghost is facing
    // dirEnum      = direction the ghost is moving
    // (faceDirEnum represents what dirEnum will be once the ghost reaches the middle of the tile)
    this.faceDirEnum = this.dirEnum;
};

Ghost.prototype.save = function(t) {
    this.savedSigReverse[t] = this.sigReverse;
    this.savedSigLeaveHome[t] = this.sigLeaveHome;
    this.savedMode[t] = this.mode;
    this.savedScared[t] = this.scared;
    if (this == blinky) {
        this.savedElroy[t] = this.elroy;
    }
    this.savedFaceDirEnum[t] = this.faceDirEnum;
    Actor.prototype.save.call(this,t);
};

Ghost.prototype.load = function(t) {
    this.sigReverse = this.savedSigReverse[t];
    this.sigLeaveHome = this.savedSigLeaveHome[t];
    this.mode = this.savedMode[t];
    this.scared = this.savedScared[t];
    if (this == blinky) {
        this.elroy = this.savedElroy[t];
    }
    this.faceDirEnum = this.savedFaceDirEnum[t];
    Actor.prototype.load.call(this,t);
};

// indicates if we slow down in the tunnel
Ghost.prototype.isSlowInTunnel = function() {
    // special case for Ms. Pac-Man (slow down only for the first three levels)
    if (gameMode == GAME_MSPACMAN || gameMode == GAME_OTTO || gameMode == GAME_COOKIE)
        return level <= 3;
    else
        return true;
};

// gets the number of steps to move in this frame
Ghost.prototype.getNumSteps = function() {

    var pattern = STEP_GHOST;

    if (this.mode == GHOST_GOING_HOME || this.mode == GHOST_ENTERING_HOME)
        return 2;
    else if (this.mode == GHOST_LEAVING_HOME || this.mode == GHOST_PACING_HOME)
        return this.getStepSizeFromTable(1, STEP_GHOST_TUNNEL);
    else if (map.isTunnelTile(this.tile.x, this.tile.y) && this.isSlowInTunnel())
        pattern = STEP_GHOST_TUNNEL;
    else if (this.scared)
        pattern = STEP_GHOST_FRIGHT;
    else if (this.elroy == 1)
        pattern = STEP_ELROY1;
    else if (this.elroy == 2)
        pattern = STEP_ELROY2;

    return this.getStepSizeFromTable(level ? level : 1, pattern);
};

// signal ghost to reverse direction after leaving current tile
Ghost.prototype.reverse = function() {
    this.sigReverse = true;
};

// signal ghost to go home
// It is useful to have this because as soon as the ghost gets eaten,
// we have to freeze all the actors for 3 seconds, except for the
// ones who are already traveling to the ghost home to be revived.
// We use this signal to change mode to GHOST_GOING_HOME, which will be
// set after the update() function is called so that we are still frozen
// for 3 seconds before traveling home uninterrupted.
Ghost.prototype.goHome = function() {
    audio.silence();
    audio.eatingGhost.play();
    this.mode = GHOST_EATEN;
};

// Following the pattern that state changes be made via signaling (e.g. reversing, going home)
// the ghost is commanded to leave home similarly.
// (not sure if this is correct yet)
Ghost.prototype.leaveHome = function() {
    this.playSounds();
    this.sigLeaveHome = true;
};

Ghost.prototype.playSounds = function() {
    var ghostsOutside = 0;
    var ghostsGoingHome = 0;
    for (var i=0; i<4; i++) {
        if (ghosts[i].mode == GHOST_OUTSIDE)    ghostsOutside++;
        if (ghosts[i].mode == GHOST_GOING_HOME) ghostsGoingHome++;
    }
    if (ghostsGoingHome > 0) {
        audio.ghostNormalMove.stopLoop();
        audio.ghostReturnToHome.startLoop(true);
        return;
    }
    else {
        audio.ghostReturnToHome.stopLoop();
    }
    if (ghostsOutside > 0 ) {
        if (! this.scared)
            audio.ghostNormalMove.startLoop(true);
    }
    else {
        audio.ghostNormalMove.stopLoop();
    }
}

// function called when pacman eats an energizer
Ghost.prototype.onEnergized = function() {

    this.reverse();

    // only scare me if not already going home
    if (this.mode != GHOST_GOING_HOME && this.mode != GHOST_ENTERING_HOME) {
        this.scared = true;
        this.targetting = undefined;
    }
};

// function called when this ghost gets eaten
Ghost.prototype.onEaten = function() {
    this.goHome();       // go home
    this.scared = false; // turn off scared
};

// move forward one step
Ghost.prototype.step = function() {
    this.setPos(this.pixel.x+this.dir.x, this.pixel.y+this.dir.y);
    return 1;
};

// ghost home-specific path steering
Ghost.prototype.homeSteer = (function(){

    // steering functions to execute for each mode
    var steerFuncs = {};

    steerFuncs[GHOST_GOING_HOME] = function() {
        // at the doormat
        if (this.tile.x == map.doorTile.x && this.tile.y == map.doorTile.y) {
            this.faceDirEnum = DIR_DOWN;
            this.targetting = false;
            // walk to the door, or go through if already there
            if (this.pixel.x == map.doorPixel.x) {
                this.mode = GHOST_ENTERING_HOME;
                this.playSounds();
                this.setDir(DIR_DOWN);
                this.faceDirEnum = this.dirEnum;
            }
            else {
                this.setDir(DIR_RIGHT);
                this.faceDirEnum = this.dirEnum;
            }
        }
    };

    steerFuncs[GHOST_ENTERING_HOME] = function() {
        if (this.pixel.y == map.homeBottomPixel) {
            // revive if reached its seat
            if (this.pixel.x == this.startPixel.x) {
                this.setDir(DIR_UP);
                this.mode = this.arriveHomeMode;
            }
            // sidestep to its seat
            else {
                this.setDir(this.startPixel.x < this.pixel.x ? DIR_LEFT : DIR_RIGHT);
            }
            this.faceDirEnum = this.dirEnum;
        }
    };

    steerFuncs[GHOST_PACING_HOME] = function() {
        // head for the door
        if (this.sigLeaveHome) {
            this.sigLeaveHome = false;
            this.mode = GHOST_LEAVING_HOME;
            if (this.pixel.x == map.doorPixel.x)
                this.setDir(DIR_UP);
            else
                this.setDir(this.pixel.x < map.doorPixel.x ? DIR_RIGHT : DIR_LEFT);
        }
        // pace back and forth
        else {
            if (this.pixel.y == map.homeTopPixel)
                this.setDir(DIR_DOWN);
            else if (this.pixel.y == map.homeBottomPixel)
                this.setDir(DIR_UP);
        }
        this.faceDirEnum = this.dirEnum;
    };

    steerFuncs[GHOST_LEAVING_HOME] = function() {
        if (this.pixel.x == map.doorPixel.x) {
            // reached door
            if (this.pixel.y == map.doorPixel.y) {
                this.mode = GHOST_OUTSIDE;
                this.setDir(DIR_LEFT); // always turn left at door?
            }
            // keep walking up to the door
            else {
                this.setDir(DIR_UP);
            }
            this.faceDirEnum = this.dirEnum;
        }
    };

    // return a function to execute appropriate steering function for a given ghost
    return function() { 
        var f = steerFuncs[this.mode];
        if (f)
            f.apply(this);
    };

})();

// special case for Ms. Pac-Man game that randomly chooses a corner for blinky and pinky when scattering
Ghost.prototype.isScatterBrain = function() {
    var scatter = false;
    if (ghostCommander.getCommand() == GHOST_CMD_SCATTER) {
        if (gameMode == GAME_MSPACMAN || gameMode == GAME_COOKIE) {
            scatter = (this == blinky || this == pinky);
        }
        else if (gameMode == GAME_OTTO) {
            scatter = true;
        }
    }
    return scatter;
};

// determine direction
Ghost.prototype.steer = function() {

    var dirEnum;                         // final direction to update to
    var openTiles;                       // list of four booleans indicating which surrounding tiles are open
    var oppDirEnum = rotateAboutFace(this.dirEnum); // current opposite direction enum
    var actor;                           // actor whose corner we will target

    // special map-specific steering when going to, entering, pacing inside, or leaving home
    this.homeSteer();

    // current opposite direction enum
    oppDirEnum = rotateAboutFace(this.dirEnum); 

    // only execute rest of the steering logic if we're pursuing a target tile
    if (this.mode != GHOST_OUTSIDE && this.mode != GHOST_GOING_HOME) {
        this.targetting = false;
        return;
    }

    // AT MID-TILE (update movement direction)
    if (this.distToMid.x == 0 && this.distToMid.y == 0) {

        // trigger reversal
        if (this.sigReverse) {
            this.faceDirEnum = oppDirEnum;
            this.sigReverse = false;
        }

        // commit previous direction
        this.setDir(this.faceDirEnum);
    }
    // JUST PASSED MID-TILE (update face direction)
    else if (
            this.dirEnum == DIR_RIGHT && this.tilePixel.x == midTile.x+1 ||
            this.dirEnum == DIR_LEFT  && this.tilePixel.x == midTile.x-1 ||
            this.dirEnum == DIR_UP    && this.tilePixel.y == midTile.y-1 ||
            this.dirEnum == DIR_DOWN  && this.tilePixel.y == midTile.y+1) {

        // get next tile
        var nextTile = {
            x: this.tile.x + this.dir.x,
            y: this.tile.y + this.dir.y,
        };

        // get tiles surrounding next tile and their open indication
        openTiles = getOpenTiles(nextTile, this.dirEnum);

        if (this.scared) {
            // choose a random turn
            dirEnum = Math.floor(Math.random()*4);
            while (!openTiles[dirEnum])
                dirEnum = (dirEnum+1)%4; // look at likelihood of random turns
            this.targetting = false;
        }
        else {

            /* SET TARGET */

            // target ghost door
            if (this.mode == GHOST_GOING_HOME) {
                this.targetTile.x = map.doorTile.x;
                this.targetTile.y = map.doorTile.y;
            }
            // target corner when scattering
            else if (!this.elroy && ghostCommander.getCommand() == GHOST_CMD_SCATTER) {

                actor = this.isScatterBrain() ? actors[Math.floor(Math.random()*4)] : this;

                this.targetTile.x = actor.cornerTile.x;
                this.targetTile.y = actor.cornerTile.y;
                this.targetting = 'corner';
            }
            // use custom function for each ghost when in attack mode
            else {
                this.setTarget();
            }

            /* CHOOSE TURN */

            var dirDecided = false;
            if (this.mode == GHOST_GOING_HOME && map.getExitDir) {
                // If the map has a 'getExitDir' function, then we are using
                // a custom algorithm to choose the next direction.
                // Currently, procedurally-generated maps use this function
                // to ensure that ghosts can return home without looping forever.
                var exitDir = map.getExitDir(nextTile.x,nextTile.y);
                if (exitDir != undefined && exitDir != oppDirEnum) {
                    dirDecided = true;
                    dirEnum = exitDir;
                }
            }

            if (!dirDecided) {
                // Do not constrain turns for ghosts going home. (thanks bitwave)
                if (this.mode != GHOST_GOING_HOME) {
                    if (map.constrainGhostTurns) {
                        // edit openTiles to reflect the current map's special contraints
                        map.constrainGhostTurns(nextTile, openTiles, this.dirEnum);
                    }
                }

                // choose direction that minimizes distance to target
                dirEnum = getTurnClosestToTarget(nextTile, this.targetTile, openTiles);
            }
        }

        // Point eyeballs to the determined direction.
        this.faceDirEnum = dirEnum;
    }
};

Ghost.prototype.getPathDistLeft = function(fromPixel, dirEnum) {
    var distLeft = tileSize;
    var pixel = this.getTargetPixel();
    if (this.targetting == 'pacman') {
        if (dirEnum == DIR_UP || dirEnum == DIR_DOWN)
            distLeft = Math.abs(fromPixel.y - pixel.y);
        else {
            distLeft = Math.abs(fromPixel.x - pixel.x);
        }
    }
    return distLeft;
};

Ghost.prototype.setTarget = function() {
    // This sets the target tile when in chase mode.
    // The "target" is always Pac-Man when in this mode,
    // except for Clyde.  He runs away back home sometimes,
    // so the "targetting" parameter is set in getTargetTile
    // for Clyde only.

    this.targetTile = this.getTargetTile();

    if (this != clyde) {
        this.targetting = 'pacman';
    }
};
//@line 1 "src/Player.js"
//////////////////////////////////////////////////////////////////////////////////////
// Player is the controllable character (Pac-Man)

// Player constructor
var Player = function() {

    // inherit data from Actor
    Actor.apply(this);
    if (gameMode == GAME_MSPACMAN || gameMode == GAME_COOKIE) {
        this.frames = 1; // start with mouth open
    }

    this.nextDir = {};
    this.lastMeal = { x:-1, y:-1 };

    // determines if this player should be AI controlled
    this.ai = false;
    this.invincible = false;

    this.savedNextDirEnum = {};
    this.savedStopped = {};
    this.savedEatPauseFramesLeft = {};
};

// inherit functions from Actor
Player.prototype = newChildObject(Actor.prototype);

Player.prototype.save = function(t) {
    this.savedEatPauseFramesLeft[t] = this.eatPauseFramesLeft;
    this.savedNextDirEnum[t] = this.nextDirEnum;
    this.savedStopped[t] = this.stopped;

    Actor.prototype.save.call(this,t);
};

Player.prototype.load = function(t) {
    this.eatPauseFramesLeft = this.savedEatPauseFramesLeft[t];
    this.setNextDir(this.savedNextDirEnum[t]);
    this.stopped = this.savedStopped[t];

    Actor.prototype.load.call(this,t);
};

// reset the state of the player on new level or level restart
Player.prototype.reset = function() {

    this.setNextDir(this.startDirEnum);
    this.stopped = false;
    this.inputDirEnum = undefined;

    this.eatPauseFramesLeft = 0;   // current # of frames left to pause after eating

    // call Actor's reset function to reset to initial position and direction
    Actor.prototype.reset.apply(this);

};

// sets the next direction and updates its dependent variables
Player.prototype.setNextDir = function(nextDirEnum) {
    setDirFromEnum(this.nextDir, nextDirEnum);
    this.nextDirEnum = nextDirEnum;
};

// gets the number of steps to move in this frame
Player.prototype.getNumSteps = function() {
    if (turboMode)
        return 2;

    // power-up orbs: O(N) speeds up, O(N^2) slows down
    // (only during real gameplay, so demos and the learn screen are never affected)
    var orbSteps = (state == playState) ? powerups.getNumSteps(this.frames) : undefined;
    if (orbSteps != undefined)
        return orbSteps;

    var pattern = energizer.isActive() ? STEP_PACMAN_FRIGHT : STEP_PACMAN;
    return this.getStepSizeFromTable(level, pattern);
};

Player.prototype.getStepFrame = function(steps) {
    if (steps == undefined) {
        steps = this.steps;
    }
    return Math.floor(steps/2)%4;
};

Player.prototype.getAnimFrame = function(frame) {
    if (frame == undefined) {
        frame = this.getStepFrame();
    }
    if (gameMode == GAME_MSPACMAN || gameMode == GAME_COOKIE) { // ms. pacman starts with mouth open
        frame = (frame+1)%4;
        if (state == deadState)
            frame = 1; // hack to force this frame when dead
    }
    if (gameMode != GAME_OTTO) {
        if (frame == 3) 
            frame = 1;
    }
    return frame;
};

Player.prototype.setInputDir = function(dirEnum) {
    this.inputDirEnum = dirEnum;
};

Player.prototype.clearInputDir = function(dirEnum) {
    if (dirEnum == undefined || this.inputDirEnum == dirEnum) {
        this.inputDirEnum = undefined;
    }
};

// move forward one step
Player.prototype.step = (function(){

    // return sign of a number
    var sign = function(x) {
        if (x<0) return -1;
        if (x>0) return 1;
        return 0;
    };

    return function() {

        // just increment if we're not in a map
        if (!map) {
            this.setPos(this.pixel.x+this.dir.x, this.pixel.y+this.dir.y);
            return 1;
        }

        // identify the axes of motion
        var a = (this.dir.x != 0) ? 'x' : 'y'; // axis of motion
        var b = (this.dir.x != 0) ? 'y' : 'x'; // axis perpendicular to motion

        // Don't proceed past the middle of a tile if facing a wall
        this.stopped = this.stopped || (this.distToMid[a] == 0 && !isNextTileFloor(this.tile, this.dir));
        if (!this.stopped) {
            // Move in the direction of travel.
            this.pixel[a] += this.dir[a];

            // Drift toward the center of the track (a.k.a. cornering)
            this.pixel[b] += sign(this.distToMid[b]);
        }


        this.commitPos();
        return this.stopped ? 0 : 1;
    };
})();

// determine direction
Player.prototype.steer = function() {

    // if AI-controlled, only turn at mid-tile
    if (this.ai) {
        if (this.distToMid.x != 0 || this.distToMid.y != 0)
            return;

        // make turn that is closest to target
        var openTiles = getOpenTiles(this.tile, this.dirEnum);
        this.setTarget();
        this.setNextDir(getTurnClosestToTarget(this.tile, this.targetTile, openTiles));
    }
    else {
        this.targetting = undefined;
    }

    if (this.inputDirEnum == undefined) {
        if (this.stopped) {
            this.setDir(this.nextDirEnum);
        }
    }
    else {
        // Determine if input direction is open.
        var inputDir = {};
        setDirFromEnum(inputDir, this.inputDirEnum);
        var inputDirOpen = isNextTileFloor(this.tile, inputDir);

        if (inputDirOpen) {
            this.setDir(this.inputDirEnum);
            this.setNextDir(this.inputDirEnum);
            this.stopped = false;
        }
        else {
            if (!this.stopped) {
                this.setNextDir(this.inputDirEnum);
            }
        }
    }
    if (this.stopped) {
        audio.eating.stopLoop(true);
    }
};


// update this frame
Player.prototype.update = function(j) {

    var numSteps = this.getNumSteps();
    if (j >= numSteps)
        return;

    // skip frames
    if (this.eatPauseFramesLeft > 0) {
        if (j == numSteps-1)
            this.eatPauseFramesLeft--;
        return;
    }

    // call super function to update position and direction
    Actor.prototype.update.call(this,j);

    // eat something
    if (map) {
        var t = map.getTile(this.tile.x, this.tile.y);
        if (t == '.' || t == 'o') {
            this.lastMeal.x = this.tile.x;
            this.lastMeal.y = this.tile.y
            // apply eating drag (unless in turbo mode)
            if (!turboMode) {
                this.eatPauseFramesLeft = (t=='.') ? 1 : 3;
            }
            audio.eating.startLoop(true);
            map.onDotEat(this.tile.x, this.tile.y);
            ghostReleaser.onDotEat();
            fruit.onDotEat();
            addScore((t=='.') ? 10 : 50);

            if (t=='o')
                energizer.activate();
        }
        if (t == ' ' && ! (this.lastMeal.x == this.tile.x && this.lastMeal.y == this.tile.y)) {
            audio.eating.stopLoop(true);
        }
    }
};
//@line 1 "src/actors.js"
//////////////////////////////////////////////////////////////////////////////////////
// create all the actors

var blinky = new Ghost();
blinky.name = "blinky";
blinky.color = "#FF0000";
blinky.pathColor = "rgba(255,0,0,0.8)";
blinky.isVisible = true;

var pinky = new Ghost();
pinky.name = "pinky";
pinky.color = "#FFB8FF";
pinky.pathColor = "rgba(255,184,255,0.8)";
pinky.isVisible = true;

var inky = new Ghost();
inky.name = "inky";
inky.color = "#00FFFF";
inky.pathColor = "rgba(0,255,255,0.8)";
inky.isVisible = true;

var clyde = new Ghost();
clyde.name = "clyde";
clyde.color = "#FFB851";
clyde.pathColor = "rgba(255,184,81,0.8)";
clyde.isVisible = true;

var pacman = new Player();
pacman.name = "pacman";
pacman.color = "#FFFF00";
pacman.pathColor = "rgba(255,255,0,0.8)";

// order at which they appear in original arcade memory
// (suggests drawing/update order)
var actors = [blinky, pinky, inky, clyde, pacman];
var ghosts = [blinky, pinky, inky, clyde];
//@line 1 "src/targets.js"
/////////////////////////////////////////////////////////////////
// Targetting
// (a definition for each actor's targetting algorithm and a draw function to visualize it)
// (getPathDistLeft is used to obtain a smoothly interpolated path endpoint)

// the tile length of the path drawn toward the target
var actorPathLength = 16;

(function() {

// the size of the square rendered over a target tile (just half a tile)
var targetSize = midTile.y;

// when drawing paths, use these offsets so they don't completely overlap each other
pacman.pathCenter = { x:0, y:0};
blinky.pathCenter = { x:-2, y:-2 };
pinky.pathCenter = { x:-1, y:-1 };
inky.pathCenter = { x:1, y:1 };
clyde.pathCenter = { x:2, y:2 };

/////////////////////////////////////////////////////////////////
// blinky directly targets pacman

blinky.getTargetTile = function() {
    return { x: pacman.tile.x, y: pacman.tile.y };
};
blinky.getTargetPixel = function() {
    return { x: pacman.pixel.x, y: pacman.pixel.y };
};
blinky.drawTarget = function(ctx) {
    if (!this.targetting) return;
    ctx.fillStyle = this.color;
    if (this.targetting == 'pacman')
        renderer.drawCenterPixelSq(ctx, pacman.pixel.x, pacman.pixel.y, targetSize);
    else
        renderer.drawCenterTileSq(ctx, this.targetTile.x, this.targetTile.y, targetSize);
};

/////////////////////////////////////////////////////////////////
// pinky targets four tiles ahead of pacman
pinky.getTargetTile = function() {
    var px = pacman.tile.x + 4*pacman.dir.x;
    var py = pacman.tile.y + 4*pacman.dir.y;
    if (pacman.dirEnum == DIR_UP) {
        px -= 4;
    }
    return { x : px, y : py };
};
pinky.getTargetPixel = function() {
    var px = pacman.pixel.x + 4*pacman.dir.x*tileSize;
    var py = pacman.pixel.y + 4*pacman.dir.y*tileSize;
    if (pacman.dirEnum == DIR_UP) {
        px -= 4*tileSize;
    }
    return { x : px, y : py };
};
pinky.drawTarget = function(ctx) {
    if (!this.targetting) return;
    ctx.fillStyle = this.color;

    var pixel = this.getTargetPixel();

    if (this.targetting == 'pacman') {
        ctx.beginPath();
        ctx.moveTo(pacman.pixel.x, pacman.pixel.y);
        if (pacman.dirEnum == DIR_UP) {
            ctx.lineTo(pacman.pixel.x, pixel.y);
        }
        ctx.lineTo(pixel.x, pixel.y);
        ctx.stroke();
        renderer.drawCenterPixelSq(ctx, pixel.x, pixel.y, targetSize);
    }
    else
        renderer.drawCenterTileSq(ctx, this.targetTile.x, this.targetTile.y, targetSize);
};

/////////////////////////////////////////////////////////////////
// inky targets twice the distance from blinky to two tiles ahead of pacman
inky.getTargetTile = function() {
    var px = pacman.tile.x + 2*pacman.dir.x;
    var py = pacman.tile.y + 2*pacman.dir.y;
    if (pacman.dirEnum == DIR_UP) {
        px -= 2;
    }
    return {
        x : blinky.tile.x + 2*(px - blinky.tile.x),
        y : blinky.tile.y + 2*(py - blinky.tile.y),
    };
};
inky.getJointPixel = function() {
    var px = pacman.pixel.x + 2*pacman.dir.x*tileSize;
    var py = pacman.pixel.y + 2*pacman.dir.y*tileSize;
    if (pacman.dirEnum == DIR_UP) {
        px -= 2*tileSize;
    }
    return { x: px, y: py };
};
inky.getTargetPixel = function() {
    var px = pacman.pixel.x + 2*pacman.dir.x*tileSize;
    var py = pacman.pixel.y + 2*pacman.dir.y*tileSize;
    if (pacman.dirEnum == DIR_UP) {
        px -= 2*tileSize;
    }
    return {
        x : blinky.pixel.x + 2*(px-blinky.pixel.x),
        y : blinky.pixel.y + 2*(py-blinky.pixel.y),
    };
};
inky.drawTarget = function(ctx) {
    if (!this.targetting) return;
    var pixel;

    var joint = this.getJointPixel();

    if (this.targetting == 'pacman') {
        pixel = this.getTargetPixel();
        ctx.beginPath();
        ctx.moveTo(pacman.pixel.x, pacman.pixel.y);
        if (pacman.dirEnum == DIR_UP) {
            ctx.lineTo(pacman.pixel.x, joint.y);
        }
        ctx.lineTo(joint.x, joint.y);
        ctx.moveTo(blinky.pixel.x, blinky.pixel.y);
        ctx.lineTo(pixel.x, pixel.y);
        ctx.closePath();
        ctx.stroke();

        // draw seesaw joint
        ctx.beginPath();
        ctx.arc(joint.x, joint.y, 2,0,Math.PI*2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();

        ctx.fillStyle = this.color;
        renderer.drawCenterPixelSq(ctx, pixel.x, pixel.y, targetSize);
    }
    else {
        ctx.fillStyle = this.color;
        renderer.drawCenterTileSq(ctx, this.targetTile.x, this.targetTile.y, targetSize);
    }
};

/////////////////////////////////////////////////////////////////
// clyde targets pacman if >=8 tiles away, otherwise targets home

clyde.getTargetTile = function() {
    var dx = pacman.tile.x - (this.tile.x + this.dir.x);
    var dy = pacman.tile.y - (this.tile.y + this.dir.y);
    var dist = dx*dx+dy*dy;
    if (dist >= 64) {
        this.targetting = 'pacman';
        return { x: pacman.tile.x, y: pacman.tile.y };
    }
    else {
        this.targetting = 'corner';
        return { x: this.cornerTile.x, y: this.cornerTile.y };
    }
};
clyde.getTargetPixel = function() {
    // NOTE: won't ever need this function for corner tile because it is always outside
    return { x: pacman.pixel.x, y: pacman.pixel.y };
};
clyde.drawTarget = function(ctx) {
    if (!this.targetting) return;
    ctx.fillStyle = this.color;

    if (this.targetting == 'pacman') {
        ctx.beginPath();
        if (true) {
            // draw a radius
            ctx.arc(pacman.pixel.x, pacman.pixel.y, tileSize*8,0, 2*Math.PI);
            ctx.closePath();
        }
        else {
            // draw a distance stick
            ctx.moveTo(pacman.pixel.x, pacman.pixel.y);
            var dx = clyde.pixel.x - pacman.pixel.x;
            var dy = clyde.pixel.y - pacman.pixel.y;
            var dist = Math.sqrt(dx*dx+dy*dy);
            dx = dx/dist*tileSize*8;
            dy = dy/dist*tileSize*8;
            ctx.lineTo(pacman.pixel.x + dx, pacman.pixel.y + dy);
        }
        ctx.stroke();
        renderer.drawCenterPixelSq(ctx, pacman.pixel.x, pacman.pixel.y, targetSize);
    }
    else {
        // draw a radius
        if (ghostCommander.getCommand() == GHOST_CMD_CHASE) {
            ctx.beginPath();
            ctx.arc(pacman.pixel.x, pacman.pixel.y, tileSize*8,0, 2*Math.PI);
            ctx.strokeStyle = "rgba(255,255,255,0.25)";
            ctx.stroke();
        }
        renderer.drawCenterTileSq(ctx, this.targetTile.x, this.targetTile.y, targetSize);
    }
};


/////////////////////////////////////////////////////////////////
// pacman targets twice the distance from pinky to pacman or target pinky

pacman.setTarget = function() {
    if (blinky.mode == GHOST_GOING_HOME || blinky.scared) {
        this.targetTile.x = pinky.tile.x;
        this.targetTile.y = pinky.tile.y;
        this.targetting = 'pinky';
    }
    else {
        this.targetTile.x = pinky.tile.x + 2*(pacman.tile.x-pinky.tile.x);
        this.targetTile.y = pinky.tile.y + 2*(pacman.tile.y-pinky.tile.y);
        this.targetting = 'flee';
    }
};
pacman.drawTarget = function(ctx) {
    if (!this.ai) return;
    ctx.fillStyle = this.color;
    var px,py;

    if (this.targetting == 'flee') {
        px = pacman.pixel.x - pinky.pixel.x;
        py = pacman.pixel.y - pinky.pixel.y;
        px = pinky.pixel.x + 2*px;
        py = pinky.pixel.y + 2*py;
        ctx.beginPath();
        ctx.moveTo(pinky.pixel.x, pinky.pixel.y);
        ctx.lineTo(px,py);
        ctx.closePath();
        ctx.stroke();
        renderer.drawCenterPixelSq(ctx, px, py, targetSize);
    }
    else {
        renderer.drawCenterPixelSq(ctx, pinky.pixel.x, pinky.pixel.y, targetSize);
    };

};
pacman.getPathDistLeft = function(fromPixel, dirEnum) {
    var distLeft = tileSize;
    var px,py;
    if (this.targetting == 'pinky') {
        if (dirEnum == DIR_UP || dirEnum == DIR_DOWN)
            distLeft = Math.abs(fromPixel.y - pinky.pixel.y);
        else
            distLeft = Math.abs(fromPixel.x - pinky.pixel.x);
    }
    else { // 'flee'
        px = pacman.pixel.x - pinky.pixel.x;
        py = pacman.pixel.y - pinky.pixel.y;
        px = pinky.pixel.x + 2*px;
        py = pinky.pixel.y + 2*py;
        if (dirEnum == DIR_UP || dirEnum == DIR_DOWN)
            distLeft = Math.abs(py - fromPixel.y);
        else
            distLeft = Math.abs(px - fromPixel.x);
    }
    return distLeft;
};

})();
//@line 1 "src/ghostCommander.js"
//////////////////////////////////////////////////////////////////////////////////////
// Ghost Commander
// Determines when a ghost should be chasing a target

// modes representing the ghosts' current command
var GHOST_CMD_CHASE = 0;
var GHOST_CMD_SCATTER = 1;

var ghostCommander = (function() {

    // determine if there is to be a new command issued at the given time
    var getNewCommand = (function(){
        var t;
        var times = [{},{},{}];
        // level 1
        times[0][t=7*60] = GHOST_CMD_CHASE;
        times[0][t+=20*60] = GHOST_CMD_SCATTER;
        times[0][t+=7*60] = GHOST_CMD_CHASE;
        times[0][t+=20*60] = GHOST_CMD_SCATTER;
        times[0][t+=5*60] = GHOST_CMD_CHASE;
        times[0][t+=20*60] = GHOST_CMD_SCATTER;
        times[0][t+=5*60] = GHOST_CMD_CHASE;
        // level 2-4
        times[1][t=7*60] = GHOST_CMD_CHASE;
        times[1][t+=20*60] = GHOST_CMD_SCATTER;
        times[1][t+=7*60] = GHOST_CMD_CHASE;
        times[1][t+=20*60] = GHOST_CMD_SCATTER;
        times[1][t+=5*60] = GHOST_CMD_CHASE;
        times[1][t+=1033*60] = GHOST_CMD_SCATTER;
        times[1][t+=1] = GHOST_CMD_CHASE;
        // level 5+
        times[2][t=5*60] = GHOST_CMD_CHASE;
        times[2][t+=20*60] = GHOST_CMD_SCATTER;
        times[2][t+=5*60] = GHOST_CMD_CHASE;
        times[2][t+=20*60] = GHOST_CMD_SCATTER;
        times[2][t+=5*60] = GHOST_CMD_CHASE;
        times[2][t+=1037*60] = GHOST_CMD_SCATTER;
        times[2][t+=1] = GHOST_CMD_CHASE;

        return function(frame) {
            var i;
            if (level == 1)
                i = 0;
            else if (level >= 2 && level <= 4)
                i = 1;
            else
                i = 2;
            var newCmd = times[i][frame];

            if (gameMode == GAME_PACMAN) {
                return newCmd;
            }
            else if (frame <= 27*60) { // only revearse twice in Ms. Pac-Man (two happen in first 27 seconds)
                if (newCmd != undefined) {
                    return GHOST_CMD_CHASE; // always chase in Ms. Pac-Man mode
                }
            }
        };
    })();

    var frame;   // current frame
    var command; // last command given to ghosts

    var savedFrame = {};
    var savedCommand = {};

    // save state at time t
    var save = function(t) {
        savedFrame[t] = frame;
        savedCommand[t] = command;
    };

    // load state at time t
    var load = function(t) {
        frame = savedFrame[t];
        command = savedCommand[t];
    };

    return {
        save: save,
        load: load,
        reset: function() { 
            command = GHOST_CMD_SCATTER;
            frame = 0;
        },
        update: function() {
            var newCmd;
            if (!energizer.isActive()) {
                newCmd = getNewCommand(frame);
                if (newCmd != undefined) {
                    command = newCmd;
                    for (i=0; i<4; i++)
                        ghosts[i].reverse();
                }
                frame++;
            }
        },
        getCommand: function() {
            return command; 
        },
        setCommand: function(cmd) {
            command = cmd;
        },
    };
})();
//@line 1 "src/ghostReleaser.js"
//////////////////////////////////////////////////////////////////////////////////////
// Ghost Releaser

// Determines when to release ghosts from home

var ghostReleaser = (function(){
    // two separate counter modes for releasing the ghosts from home
    var MODE_PERSONAL = 0;
    var MODE_GLOBAL = 1;

    // ghost enumerations
    var PINKY = 1;
    var INKY = 2;
    var CLYDE = 3;

    // this is how many frames it will take to release a ghost after pacman stops eating
    var getTimeoutLimit = function() { return (level < 5) ? 4*60 : 3*60; };

    // dot limits used in personal mode to release ghost after # of dots have been eaten
    var personalDotLimit = {};
    personalDotLimit[PINKY] = function() { return 0; };
    personalDotLimit[INKY] = function() { return (level==1) ? 30 : 0; };
    personalDotLimit[CLYDE] = function() {
        if (level == 1) return 60;
        if (level == 2) return 50;
        return 0;
    };

    // dot limits used in global mode to release ghost after # of dots have been eaten
    var globalDotLimit = {};
    globalDotLimit[PINKY] = 7;
    globalDotLimit[INKY] = 17;
    globalDotLimit[CLYDE] = 32;

    var framesSinceLastDot; // frames elapsed since last dot was eaten
    var mode;               // personal or global dot counter mode
    var ghostCounts = {};   // personal dot counts for each ghost
    var globalCount;        // global dot count

    var savedGlobalCount = {};
    var savedFramesSinceLastDot = {};
    var savedGhostCounts = {};

    // save state at time t
    var save = function(t) {
        savedFramesSinceLastDot[t] = framesSinceLastDot;
        if (mode == MODE_GLOBAL) {
            savedGlobalCount[t] = globalCount;
        }
        else if (mode == MODE_PERSONAL) {
            savedGhostCounts[t] = {};
            savedGhostCounts[t][PINKY] = ghostCounts[PINKY];
            savedGhostCounts[t][INKY] = ghostCounts[INKY];
            savedGhostCounts[t][CLYDE] = ghostCounts[CLYDE];
        }
    };

    // load state at time t
    var load = function(t) {
        framesSinceLastDot = savedFramesSinceLastDot[t];
        if (mode == MODE_GLOBAL) {
            globalCount = savedGlobalCount[t];
        }
        else if (mode == MODE_PERSONAL) {
            ghostCounts[PINKY] = savedGhostCounts[t][PINKY];
            ghostCounts[INKY] = savedGhostCounts[t][INKY];
            ghostCounts[CLYDE] = savedGhostCounts[t][CLYDE];
        }
    };

    return {
        save: save,
        load: load,
        onNewLevel: function() {
            mode = MODE_PERSONAL;
            framesSinceLastDot = 0;
            ghostCounts[PINKY] = 0;
            ghostCounts[INKY] = 0;
            ghostCounts[CLYDE] = 0;
        },
        onRestartLevel: function() {
            mode = MODE_GLOBAL;
            framesSinceLastDot = 0;
            globalCount = 0;
        },
        onDotEat: function() {
            var i;

            framesSinceLastDot = 0;

            if (mode == MODE_GLOBAL) {
                globalCount++;
            }
            else {
                for (i=1;i<4;i++) {
                    if (ghosts[i].mode == GHOST_PACING_HOME) {
                        ghostCounts[i]++;
                        break;
                    }
                }
            }

        },
        update: function() {
            var g;

            // use personal dot counter
            if (mode == MODE_PERSONAL) {
                for (i=1;i<4;i++) {
                    g = ghosts[i];
                    if (g.mode == GHOST_PACING_HOME) {
                        if (ghostCounts[i] >= personalDotLimit[i]()) {
                            g.leaveHome();
                            return;
                        }
                        break;
                    }
                }
            }
            // use global dot counter
            else if (mode == MODE_GLOBAL) {
                if (globalCount == globalDotLimit[PINKY] && pinky.mode == GHOST_PACING_HOME) {
                    pinky.leaveHome();
                    return;
                }
                else if (globalCount == globalDotLimit[INKY] && inky.mode == GHOST_PACING_HOME) {
                    inky.leaveHome();
                    return;
                }
                else if (globalCount == globalDotLimit[CLYDE] && clyde.mode == GHOST_PACING_HOME) {
                    globalCount = 0;
                    mode = MODE_PERSONAL;
                    clyde.leaveHome();
                    return;
                }
            }

            // also use time since last dot was eaten
            if (framesSinceLastDot > getTimeoutLimit()) {
                framesSinceLastDot = 0;
                for (i=1;i<4;i++) {
                    g = ghosts[i];
                    if (g.mode == GHOST_PACING_HOME) {
                        g.leaveHome();
                        break;
                    }
                }
            }
            else
                framesSinceLastDot++;
        },
    };
})();
//@line 1 "src/elroyTimer.js"
//////////////////////////////////////////////////////////////////////////////////////
// Elroy Timer

// Determines when to put blinky into faster elroy modes

var elroyTimer = (function(){

    // get the number of dots left that should trigger elroy stage #1 or #2
    var getDotsEatenLimit = (function(){
        var dotsLeft = [
            [20,30,40,40,40,50,50,50,60,60,60,70,70,70,100,100,100,100,120,120,120], // elroy1
            [10,15,20,20,20,25,25,25,30,30,30,40,40,40, 50, 50, 50, 50, 60, 60, 60]]; // elroy2
        return function(stage) {
            var i = level;
            if (i>21) i = 21;
            var pacman_max_pellets = 244;
            return pacman_max_pellets - dotsLeft[stage-1][i-1];
        };
    })();

    // when level restarts, blinky must wait for clyde to leave home before resuming elroy mode
    var waitForClyde;

    var savedWaitForClyde = {};

    // save state at time t
    var save = function(t) {
        savedWaitForClyde[t] = waitForClyde;
    };

    // load state at time t
    var load = function(t) {
        waitForClyde = savedWaitForClyde[t];
    };

    return {
        onNewLevel: function() {
            waitForClyde = false;
        },
        onRestartLevel: function() {
            waitForClyde = true;
        },
        update: function() {

            // stop waiting for clyde when clyde leaves home
            if (waitForClyde && clyde.mode != GHOST_PACING_HOME)
                waitForClyde = false;

            if (waitForClyde) {
                blinky.elroy = 0;
            }
            else {
                if (map.dotsEaten >= getDotsEatenLimit(2)) {
                    blinky.elroy = 2;
                }
                else if (map.dotsEaten >= getDotsEatenLimit(1)) {
                    blinky.elroy = 1;
                }
                else {
                    blinky.elroy = 0;
                }
            }
        },
        save: save,
        load: load,
    };
})();
//@line 1 "src/energizer.js"
//////////////////////////////////////////////////////////////////////////////////////
// Energizer

// This handles how long the energizer lasts as well as how long the
// points will display after eating a ghost.

var energizer = (function() {

    // how many seconds to display points when ghost is eaten
    var pointsDuration = 1;

    // how long to stay energized based on current level
    var getDuration = (function(){
        var seconds = [6,5,4,3,2,5,2,2,1,5,2,1,1,3,1,1,0,1];
        return function() {
            var i = level;
            return (i > 18) ? 0 : 60*seconds[i-1];
        };
    })();

    // how many ghost flashes happen near the end of frightened mode based on current level
    var getFlashes = (function(){
        var flashes = [5,5,5,5,5,5,5,5,3,5,5,3,3,5,3,3,0,3];
        return function() {
            var i = level;
            return (i > 18) ? 0 : flashes[i-1];
        };
    })();

    // "The ghosts change colors every 14 game cycles when they start 'flashing'" -Jamey Pittman
    var flashInterval = 14;

    var count;  // how long in frames energizer has been active
    var active; // indicates if energizer is currently active
    var points; // points that the last eaten ghost was worth
    var pointsFramesLeft; // number of frames left to display points earned from eating ghost

    var savedCount = {};
    var savedActive = {};
    var savedPoints = {};
    var savedPointsFramesLeft = {};

    // save state at time t
    var save = function(t) {
        savedCount[t] = count;
        savedActive[t] = active;
        savedPoints[t] = points;
        savedPointsFramesLeft[t] = pointsFramesLeft;
    };

    // load state at time t
    var load = function(t) {
        count = savedCount[t];
        active = savedActive[t];
        points = savedPoints[t];
        pointsFramesLeft = savedPointsFramesLeft[t];
    };

    return {
        save: save,
        load: load,
        reset: function() {
            audio.ghostTurnToBlue.stopLoop();
            count = 0;
            active = false;
            points = 100;
            pointsFramesLeft = 0;
            for (i=0; i<4; i++)
                ghosts[i].scared = false;
        },
        update: function() {
            var i;
            if (active) {
                if (count == getDuration())
                    this.reset();
                else
                    count++;
            }
        },
        activate: function() { 
            audio.ghostNormalMove.stopLoop();
            audio.ghostTurnToBlue.startLoop();
            active = true;
            count = 0;
            points = 100;
            for (i=0; i<4; i++) {
                ghosts[i].onEnergized();
            }
            if (getDuration() == 0) { // if no duration, then immediately reset
                this.reset();
            }
        },
        isActive: function() { return active; },
        isFlash: function() { 
            var i = Math.floor((getDuration()-count)/flashInterval);
            return (i<=2*getFlashes()-1) ? (i%2==0) : false;
        },

        getPoints: function() {
            return points;
        },
        addPoints: function() {
            addScore(points*=2);
            pointsFramesLeft = pointsDuration*60;
        },
        showingPoints: function() { return pointsFramesLeft > 0; },
        updatePointsTimer: function() { if (pointsFramesLeft > 0) pointsFramesLeft--; },
    };
})();
//@line 1 "src/fruit.js"
//////////////////////////////////////////////////////////////////////////////////////
// Fruit

var BaseFruit = function() {
    // pixel
    this.pixel = {x:0, y:0};

    this.fruitHistory = {};

    this.scoreDuration = 2; // number of seconds that the fruit score is on the screen
    this.scoreFramesLeft; // frames left until the picked-up fruit score is off the screen
    this.savedScoreFramesLeft = {};
};

BaseFruit.prototype = {
    isScorePresent: function() {
        return this.scoreFramesLeft > 0;
    },
    onNewLevel: function() {
        this.buildFruitHistory();
    },
    setCurrentFruit: function(i) {
        this.currentFruitIndex = i;
    },
    onDotEat: function() {
        if (!this.isPresent() && (map.dotsEaten == this.dotLimit1 || map.dotsEaten == this.dotLimit2)) {
            this.initiate();
        }
    },
    save: function(t) {
        this.savedScoreFramesLeft[t] = this.scoreFramesLeft;
    },
    load: function(t) {
        this.scoreFramesLeft = this.savedScoreFramesLeft[t];
    },
    reset: function() {
        this.scoreFramesLeft = 0;
    },
    getCurrentFruit: function() {
        return this.fruits[this.currentFruitIndex];
    },
    getPoints: function() {
        return this.getCurrentFruit().points;
    },
    update: function() {
        if (this.scoreFramesLeft > 0)
            this.scoreFramesLeft--;
    },
    isCollide: function() {
        return Math.abs(pacman.pixel.y - this.pixel.y) <= midTile.y && Math.abs(pacman.pixel.x - this.pixel.x) <= midTile.x;
    },
    testCollide: function() {
        if (this.isPresent() && this.isCollide()) {
            addScore(this.getPoints());
            audio.silence(true);
            audio.eatingFruit.play();
            setTimeout(ghosts[0].playSounds, 500);
            this.reset();
            this.scoreFramesLeft = this.scoreDuration*60;
        }
    },
};

// PAC-MAN FRUIT

var PacFruit = function() {
    BaseFruit.call(this);
    this.fruits = [
        {name:'cherry',     points:100},
        {name:'strawberry', points:300},
        {name:'orange',     points:500},
        {name:'apple',      points:700},
        {name:'melon',      points:1000},
        {name:'galaxian',   points:2000},
        {name:'bell',       points:3000},
        {name:'key',        points:5000},
    ];

    this.order = [
        0,  // level 1
        1,  // level 2 
        2,  // level 3
        2,  // level 4
        3,  // level 5
        3,  // level 6
        4,  // level 7
        4,  // level 8
        5,  // level 9
        5,  // level 10
        6,  // level 11
        6,  // level 12
        7]; // level 13+

    this.dotLimit1 = 70;
    this.dotLimit2 = 170;

    this.duration = 9; // number of seconds that the fruit is on the screen
    this.framesLeft; // frames left until fruit is off the screen

    this.savedFramesLeft = {};
};

PacFruit.prototype = newChildObject(BaseFruit.prototype, {

    onNewLevel: function() {
        this.setCurrentFruit(this.getFruitIndexFromLevel(level));
        BaseFruit.prototype.onNewLevel.call(this);
    },

    getFruitFromLevel: function(i) {
        return this.fruits[this.getFruitIndexFromLevel(i)];
    },

    getFruitIndexFromLevel: function(i) {
        if (i > 13) {
            i = 13;
        }
        return this.order[i-1];
    },

    buildFruitHistory: function() {
        this.fruitHistory = {};
        var i;
        for (i=1; i<= level; i++) {
            this.fruitHistory[i] = this.fruits[this.getFruitIndexFromLevel(i)];
        }
    },

    initiate: function() {
        var x = 13;
        var y = 20;
        this.pixel.x = tileSize*(1+x)-1;
        this.pixel.y = tileSize*y + midTile.y;
        this.framesLeft = 60*this.duration;
    },

    isPresent: function() {
        return this.framesLeft > 0;
    },

    reset: function() {
        BaseFruit.prototype.reset.call(this);

        this.framesLeft = 0;
    },

    update: function() {
        BaseFruit.prototype.update.call(this);

        if (this.framesLeft > 0)
            this.framesLeft--;
    },

    save: function(t) {
        BaseFruit.prototype.save.call(this,t);
        this.savedFramesLeft[t] = this.framesLeft;
    },
    load: function(t) {
        BaseFruit.prototype.load.call(this,t);
        this.framesLeft = this.savedFramesLeft[t];
    },
});

// MS. PAC-MAN FRUIT

var PATH_ENTER = 0;
var PATH_PEN = 1;
var PATH_EXIT = 2;

var MsPacFruit = function() {
    BaseFruit.call(this);
    this.fruits = [
        {name: 'cherry',     points: 100},
        {name: 'strawberry', points: 200},
        {name: 'orange',     points: 500},
        {name: 'pretzel',    points: 700},
        {name: 'apple',      points: 1000},
        {name: 'pear',       points: 2000},
        {name: 'banana',     points: 5000},
    ];

    this.dotLimit1 = 64;
    this.dotLimit2 = 176;

    this.pen_path = "<<<<<<^^^^^^>>>>>>>>>vvvvvv<<";

    this.savedIsPresent = {};
    this.savedPixel = {};
    this.savedPathMode = {};
    this.savedFrame = {};
    this.savedNumFrames = {};
    this.savedPath = {};
};

MsPacFruit.prototype = newChildObject(BaseFruit.prototype, {

    shouldRandomizeFruit: function() {
        return level > 7;
    },

    getFruitFromLevel: function(i) {
        if (i <= 7) {
            return this.fruits[i-1];
        }
        else {
            return undefined;
        }
    },

    onNewLevel: function() {
        if (!this.shouldRandomizeFruit()) {
            this.setCurrentFruit(level-1);
        }
        else {
            this.setCurrentFruit(0);
        }
        BaseFruit.prototype.onNewLevel.call(this);
    },

    buildFruitHistory: function() {
        this.fruitHistory = {};
        var i;
        for (i=1; i<= Math.max(level,7); i++) {
            this.fruitHistory[i] = this.fruits[i-1];
        }
    },

    reset: function() {
        BaseFruit.prototype.reset.call(this);

        this.frame = 0;
        this.numFrames = 0;
        this.path = undefined;
    },

    initiatePath: function(p) {
        this.frame = 0;
        this.numFrames = p.length*16;
        this.path = p;
    },

    initiate: function() {
        if (this.shouldRandomizeFruit()) {
            this.setCurrentFruit(getRandomInt(0,6));
        }
        var entrances = map.fruitPaths.entrances;
        var e = entrances[getRandomInt(0,entrances.length-1)];
        this.initiatePath(e.path);
        this.pathMode = PATH_ENTER;
        this.pixel.x = e.start.x;
        this.pixel.y = e.start.y;
    },

    isPresent: function() {
        return this.frame < this.numFrames;
    },

    bounceFrames: (function(){
        var U = { dx:0, dy:-1 };
        var D = { dx:0, dy:1 };
        var L = { dx:-1, dy:0 };
        var R = { dx:1, dy:0 };
        var UL = { dx:-1, dy:-1 };
        var UR = { dx:1, dy:-1 };
        var DL = { dx:-1, dy:1 };
        var DR = { dx:1, dy:1 };
        var Z = { dx:0, dy:0 };

        // A 16-frame animation for moving 8 pixels either up, down, left, or right.
        return {
            '^': [U, U, U, U, U, U, U, U, U, Z, U, Z, Z, D, Z, D],
            '>': [Z, UR,Z, R, Z, UR,Z, R, Z, R, Z, R, Z, DR,DR,Z],
            '<': [Z, Z, UL,Z, L, Z, UL,Z, L, Z, L, Z, L, Z, DL,DL],
            'v': [Z, D, D, D, D, D, D, D, D, D, D, D, U, U, Z, U],
        };
    })(),

    move: function() {
        var p = this.path[Math.floor(this.frame/16)]; // get current path frame
        var b = this.bounceFrames[p][this.frame%16]; // get current bounce animation frame
        this.pixel.x += b.dx;
        this.pixel.y += b.dy;
        this.frame++;
    },

    setNextPath: function() {
        if (this.pathMode == PATH_ENTER) {
            this.pathMode = PATH_PEN;
            this.initiatePath(this.pen_path);
        }
        else if (this.pathMode == PATH_PEN) {
            this.pathMode = PATH_EXIT;
            var exits = map.fruitPaths.exits;
            var e = exits[getRandomInt(0,exits.length-1)];
            this.initiatePath(e.path);
        }
        else if (this.pathMode == PATH_EXIT) {
            this.reset();
        }
    },

    update: function() {
        BaseFruit.prototype.update.call(this);

        if (this.isPresent()) {
            this.move();
            if (this.frame == this.numFrames) {
                this.setNextPath();
            }
        }
    },

    save: function(t) {
        BaseFruit.prototype.save.call(this,t);

        this.savedPixel[t] =        this.isPresent() ? {x:this.pixel.x, y:this.pixel.y} : undefined;
        this.savedPathMode[t] =     this.pathMode;
        this.savedFrame[t] =        this.frame;
        this.savedNumFrames[t] =    this.numFrames;
        this.savedPath[t] =         this.path;
    },

    load: function(t) {
        BaseFruit.prototype.load.call(this,t);

        if (this.savedPixel[t]) {
            this.pixel.x =      this.savedPixel[t].x;
            this.pixel.y =      this.savedPixel[t].y;
        }
        this.pathMode =     this.savedPathMode[t];
        this.frame =        this.savedFrame[t];
        this.numFrames =    this.savedNumFrames[t]; 
        this.path =         this.savedPath[t];
    },
});

var fruit;
var setFruitFromGameMode = (function() {
    var pacfruit = new PacFruit();
    var mspacfruit = new MsPacFruit();
    fruit = pacfruit;
    return function() {
        if (gameMode == GAME_PACMAN) {
            fruit = pacfruit;
        }
        else {
            fruit = mspacfruit;
        }
    };
})();
//@line 1 "src/powerups.js"
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
    var SPAWN_MIN_DELAY  = 7*FPS;    // random delay between spawns
    var SPAWN_MAX_DELAY  = 15*FPS;
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
    var viruses = [];   // the two FORK BOMB monsters (Ghost objects, created on first use)
    var virusFrames;    // frames of FORK BOMB left (0 = no viruses on the map)

    var popupText, popupColor, popupX, popupY, popupFrames;

    var saved = {};

    ////////////////////////////////////////////////////////////////////////////////
    // Helpers

    var randInt = function(min, max) {
        return Math.floor(Math.random() * (max-min+1)) + min;
    };

    var nextSpawnDelay = function() {
        return randInt(SPAWN_MIN_DELAY, SPAWN_MAX_DELAY);
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
            type: randInt(0,3),
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

    var makeViruses = function() {
        var i, v;
        viruses = [];
        for (i=0; i<2; i++) {
            v = new Ghost();
            v.name = "virus" + i;
            v.color = "#7cfc00";
            v.isVisible = true;
            v.index = i;
            v.savedAge = {};
            if (i == 0) {
                v.getTargetTile = function() { return { x: pacman.tile.x, y: pacman.tile.y }; };
                v.getTargetPixel = function() { return { x: pacman.pixel.x, y: pacman.pixel.y }; };
            }
            else {
                v.getTargetTile = pinky.getTargetTile;
                v.getTargetPixel = pinky.getTargetPixel;
            }
            viruses.push(v);
        }
    };

    var startViruses = function() {
        if (viruses.length == 0)
            makeViruses();
        var i, v, corner;
        for (i=0; i<viruses.length; i++) {
            v = viruses[i];
            corner = (i == 0) ? pinky.cornerTile : clyde.cornerTile;
            v.cornerTile = { x: corner.x, y: corner.y };
            // they pop out of the ghost house door; one heads left, the other right
            v.startPixel = { x: blinky.startPixel.x, y: blinky.startPixel.y };
            v.startDirEnum = (i == 0) ? DIR_LEFT : DIR_RIGHT;
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
            v.age = -i*VIRUS_SPAWN_GAP; // negative age = not on the map yet
        }
        virusFrames = VIRUS_DURATION;
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
                virusFrames = VIRUS_DURATION;  // already infected: just restart the clock
            else
                startViruses();
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
                for (i=0; i<viruses.length; i++) {
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

        // advance the viruses by one movement step (called from playState.update, like actors)
        updateViruses: function(j) {
            if (virusFrames <= 0) return;
            var i;
            for (i=0; i<viruses.length; i++)
                if (virusOnMap(viruses[i]))
                    viruses[i].update(j);
        },

        // true if an armed virus is on Pac-Man's tile
        virusTouchesPacman: function() {
            if (virusFrames <= 0) return false;
            var i, v;
            for (i=0; i<viruses.length; i++) {
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
            };
            if (virusFrames > 0) {
                for (i=0; i<viruses.length; i++) {
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
            if (virusFrames > 0) {
                for (i=0; i<viruses.length; i++) {
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
            for (i=0; i<viruses.length; i++) {
                v = viruses[i];
                if (!virusOnMap(v)) continue;
                alpha = 1;
                if (!virusArmed(v))                 // just spawned: flicker, harmless
                    alpha = (Math.floor(v.age/4) % 2 == 0) ? 0.25 : 0.6;
                else if (virusFrames < VIRUS_FADE_TIME) // about to vanish: flicker
                    alpha = (Math.floor(virusFrames/5) % 2 == 0) ? 0.25 : 1;
                frame = Math.floor(v.frames/8) % 2;
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
                chips.push({ t: INFO[ORB_FORK_BOMB].hud + " " + Math.ceil(virusFrames/FPS), c: INFO[ORB_FORK_BOMB].color });
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
//@line 1 "src/legend.js"
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


    var GFG_LOGO = "data:image/png;base64,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";

    ////////////////////////////////////////////////////////////////////////////////
    // Panel construction

    var CSS = [
        "#legend{position:fixed;left:10px;top:50%;width:" + PANEL_WIDTH + "px;box-sizing:border-box;",
        "  transform-origin:0 50%;z-index:5;user-select:none;-webkit-user-select:none;",
        "  font-family:ArcadeR,monospace;color:#fff;line-height:1;}",
        "#legend .lg-logo{display:block;width:100%;height:auto;margin:0 0 14px;image-rendering:auto;}",
        "#legend .lg-box{background:#000;padding:12px 12px 10px;image-rendering:pixelated;",
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

        // GeeksforGeeks logo above the box
        var logo = el("img", "lg-logo");
        logo.src = GFG_LOGO;
        logo.alt = "GeeksforGeeks";
        panel.appendChild(logo);

        var box = el("div", "lg-box");
        panel.appendChild(box);

        // title
        var title = el("div", "lg-title");
        title.appendChild(spriteIcon("pac1", 17, 2));
        var tt = el("div");
        tt.appendChild(el("b", null, "HASH MAP"));
        tt.appendChild(el("i", null, "MAP&lt;KEY, EFFECT&gt;"));
        title.appendChild(tt);
        box.appendChild(title);
        box.appendChild(el("div", "lg-dots"));

        // buffs
        box.appendChild(section("BUFFS", "#00ff66"));
        box.appendChild(row("0", orbIcon("speed", c.speed, "#00805a"), "O(N)", c.speed,
            "SPEED UP <em>" + info.speedSec + "s</em>"));
        box.appendChild(row("1", orbIcon("shield", c.shield, "#1b4fa8"), "STACK SHIELD", c.shield,
            "BLOCKS 1 HIT, <em>" + info.shieldSec + "s</em>"));

        // debuffs
        box.appendChild(section("DEBUFFS", "#ff3d3d"));
        box.appendChild(row("2", orbIcon("slow", c.slow, "#8f1240"), "O(N^2)", c.slow,
            "SLOWED DOWN <em>" + info.slowSec + "s</em>"));
        box.appendChild(row("3", orbIcon("fork", c.fork, "#5a1f8f"), "FORK BOMB", c.fork,
            "+2 VIRUSES CHASE YOU <em>" + info.virusSec + "s</em>"));

        // mechanics
        box.appendChild(section("MECHANICS", "#00ffff"));
        box.appendChild(row("4", dotIcon(false), "PELLET", "#ffb8ae",
            "<em>+10</em> EAT THEM ALL TO CLEAR THE LEVEL"));
        box.appendChild(row("5", dotIcon(true), "ENERGIZER", "#ffffff",
            "BUGS TURN BLUE: EAT THEM FOR <em>PTS</em>"));
        box.appendChild(row("6", spriteIcon("blinky", 14, 2), "BUG", "#ff6b6b",
            "TOUCH ONE AND YOU LOSE A LIFE"));
        box.appendChild(row("7", spriteIcon("virus", 14, 2), "VIRUS", "#7cfc00",
            "CAN'T BE EATEN. RUN OR SHIELD"));
        box.appendChild(row("8", orbIcon("fork", "#888", "#444"), "ORB", "#ffffff",
            "HIDES ON A PELLET, VANISHES IN <em>" + info.orbSec + "s</em>"));

        box.appendChild(el("div", "lg-dots"));
        box.appendChild(el("div", "lg-foot",
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
//@line 1 "src/executive.js"
var executive = (function(){

    var framePeriod = 1000/60; // length of each frame at 60Hz (updates per second)
    var gameTime; // virtual time of the last game update

    var paused = false; // flag for pausing the state updates, while still drawing
    var running = false; // flag for truly stopping everything

    /**********/
    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

    // requestAnimationFrame polyfill by Erik Möller
    // fixes from Paul Irish and Tino Zijdel

    (function() {
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
            window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                       || window[vendors[x]+'CancelRequestAnimationFrame'];
        }
     
        if (!window.requestAnimationFrame)
            window.requestAnimationFrame = function(callback, element) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function() { callback(currTime + timeToCall); },
                  timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
     
        if (!window.cancelAnimationFrame)
            window.cancelAnimationFrame = function(id) {
                clearTimeout(id);
            };
    }());
    /**********/

    var fps;
    var updateFps = (function(){
        // TODO: fix this to reflect the average rate of the last n frames, where 0 < n < 60
        var length = 60;
        var times = [];
        var startIndex = 0;
        var endIndex = -1;
        var filled = false;

        return function(now) {
            if (filled) {
                startIndex = (startIndex+1) % length;
            }
            endIndex = (endIndex+1) % length;
            if (endIndex == length-1) {
                filled = true;
            }

            times[endIndex] = now;

            var seconds = (now - times[startIndex]) / 1000;
            var frames = endIndex - startIndex;
            if (frames < 0) {
                frames += length;
            }
            fps = frames / seconds;
        };
    })();
        

    var reqFrame; // id of requestAnimationFrame object
    var tick = function(now) {
        if (gameTime == undefined) {
            gameTime = now;
        }

        // Update fps counter.
        updateFps(now);

        // Control frame-skipping by only allowing gameTime to lag behind the current time by some amount.
        var maxFrameSkip = 3;
        gameTime = Math.max(gameTime, now-maxFrameSkip*framePeriod);

        // Prevent any updates from being called when paused.
        if (paused || inGameMenu.isOpen()) {
            gameTime = now;
        }

        hud.update();

        // Update the game until the gameTime surpasses the current time.
        while (gameTime < now) {
            state.update();
            gameTime += framePeriod;
        }

        // Draw.
        renderer.beginFrame();
        state.draw();
        if (hud.isValidState()) {
            renderer.renderFunc(hud.draw);
        }
        renderer.endFrame();

        // Schedule the next tick.
        reqFrame = requestAnimationFrame(tick);
    };

    return {

        getFramePeriod: function() {
            return framePeriod;
        },
        setUpdatesPerSecond: function(ups) {
            framePeriod = 1000/ups;
            //gameTime = undefined;
            vcr.onFramePeriodChange();
        },
        init: function() {
            var that = this;
            window.addEventListener('focus', function() {that.start();});
            window.addEventListener('blur', function() {that.stop();});
            this.start();
        },
        start: function() {
            if (!running) {
                reqFrame = requestAnimationFrame(tick);
                running = true;
            }
        },
        stop: function() {
            if (running) {
                cancelAnimationFrame(reqFrame);
                running = false;
            }
        },
        togglePause: function() { paused = !paused; },
        isPaused: function() { return paused; },
        getFps: function() { return fps; },
    };
})();
//@line 1 "src/states.js"
//////////////////////////////////////////////////////////////////////////////////////
// States
// (main loops for each state of the game)
// state is set to any of these states, each containing an init(), draw(), and update()

// current game state
var state;

// switches to another game state
var switchState = function(nextState,fadeDuration, continueUpdate1, continueUpdate2) {
    state = (fadeDuration) ? fadeNextState(state,nextState,fadeDuration,continueUpdate1, continueUpdate2) : nextState;
    audio.silence();
    state.init();
    if (executive.isPaused()) {
        executive.togglePause();
    }
};

//////////////////////////////////////////////////////////////////////////////////////
// Fade state

// Creates a state that will fade from a given state to another in the given amount of time.
// if continueUpdate1 is true, then prevState.update will be called while fading out
// if continueUpdate2 is true, then nextState.update will be called while fading in
var fadeNextState = function (prevState, nextState, frameDuration, continueUpdate1, continueUpdate2) {
    var frames;
    var midFrame = Math.floor(frameDuration/2);
    var inFirstState = function() { return frames < midFrame; };
    var getStateTime = function() { return frames/frameDuration*2 + (inFirstState() ? 0 : -1); };
    var initialized = false;

    return {
        init: function() {
            frames = 0;
            initialized = true;
        },
        draw: function() {
            if (!initialized) return;
            var t = getStateTime();
            if (frames < midFrame) {
                if (prevState) {
                    prevState.draw();
                    renderer.setOverlayColor("rgba(0,0,0,"+t+")");
                }
            }
            else if (frames > midFrame) {
                nextState.draw();
                renderer.setOverlayColor("rgba(0,0,0,"+(1-t)+")");
            }
        },
        update: function() {

            // update prevState
            if (frames < midFrame) {
                if (continueUpdate1) {
                    prevState.update();
                }
            }
            // change to nextState
            else if (frames == midFrame) {
                nextState.init();
            }
            // update nextState
            else if (frames < frameDuration) {
                if (continueUpdate2) {
                    nextState.update();
                }
            }
            // hand over state to nextState
            else {
                state = nextState;
                initialized = false;
            }

            frames++;
        },
    }
};

//////////////////////////////////////////////////////////////////////////////////////
// Home State
// (the home title screen state)

var homeState = (function(){

    var exitTo = function(s) {
        switchState(s);
        menu.disable();
    };

    var menu = new Menu("",2*tileSize,0*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    var getIconAnimFrame = function(frame) {
        frame = Math.floor(frame/3)+1;
        frame %= 4;
        if (frame == 3) {
            frame = 1;
        }
        return frame;
    };
    var getOttoAnimFrame = function(frame) {
        frame = Math.floor(frame/3);
        frame %= 4;
        return frame;
    };
    menu.addTextIconButton(getGameName(GAME_PACMAN),
        function() {
            gameMode = GAME_PACMAN;
            exitTo(preNewGameState);
        },
        function(ctx,x,y,frame) {
            atlas.drawPacmanSprite(ctx,x,y,DIR_RIGHT,getIconAnimFrame(frame));
        });

    return {
        init: function() {
            menu.enable();
            audio.coffeeBreakMusic.startLoop();
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.beginMapClip();
            renderer.renderFunc(menu.draw,menu);
            renderer.endMapClip();
        },
        update: function() {
            menu.update();
        },
        getMenu: function() {
            return menu;
        },
    };

})();

//////////////////////////////////////////////////////////////////////////////////////
// Learn State

var learnState = (function(){

    var exitTo = function(s) {
        switchState(s);
        menu.disable();
        forEachCharBtn(function (btn) {
            btn.disable();
        });
        setAllVisibility(true);
        clearCheats();
    };

    var menu = new Menu("LEARN", 2*tileSize,-tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    menu.addSpacer(7);
    menu.addTextButton("BACK",
        function() {
            exitTo(homeState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];
    menu.noArrowKeys = true;

    var pad = tileSize;
    var w = 30;
    var h = 30;
    var x = mapWidth/2 - 2*(w) - 1.5*pad;
    var y = 4*tileSize;
    var redBtn = new Button(x,y,w,h,function(){
        setAllVisibility(false);
        blinky.isVisible = true;
        setVisibility(blinky,true);
    });
    redBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_DOWN,undefined,undefined,undefined,blinky.color);
    });
    x += w+pad;
    var pinkBtn = new Button(x,y,w,h,function(){
        setAllVisibility(false);
        setVisibility(pinky,true);
    });
    pinkBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_DOWN,undefined,undefined,undefined,pinky.color);
    });
    x += w+pad;
    var cyanBtn = new Button(x,y,w,h,function(){
        setAllVisibility(false);
        setVisibility(inky,true);
    });
    cyanBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_DOWN,undefined,undefined,undefined,inky.color);
    });
    x += w+pad;
    var orangeBtn = new Button(x,y,w,h,function(){
        setAllVisibility(false);
        setVisibility(clyde,true);
    });
    orangeBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_DOWN,undefined,undefined,undefined,clyde.color);
    });
    var forEachCharBtn = function(callback) {
        callback(redBtn);
        callback(pinkBtn);
        callback(cyanBtn);
        callback(orangeBtn);
    };

    var setVisibility = function(g,visible) {
        g.isVisible = g.isDrawTarget = g.isDrawPath = visible;
    };

    var setAllVisibility = function(visible) {
        setVisibility(blinky,visible);
        setVisibility(pinky,visible);
        setVisibility(inky,visible);
        setVisibility(clyde,visible);
    };

    return {
        init: function() {

            menu.enable();
            forEachCharBtn(function (btn) {
                btn.enable();
            });

            // set map
            map = mapLearn;
            renderer.drawMap();

            // set game parameters
            level = 1;
            practiceMode = false;
            turboMode = false;
            gameMode = GAME_PACMAN;

            // reset relevant game state
            ghostCommander.reset();
            energizer.reset();
            ghostCommander.setCommand(GHOST_CMD_CHASE);
            ghostReleaser.onNewLevel();
            elroyTimer.onNewLevel();

            // set ghost states
            for (i=0; i<4; i++) {
                var a = actors[i];
                a.reset();
                a.mode = GHOST_OUTSIDE;
            }
            blinky.setPos(14*tileSize-1, 13*tileSize+midTile.y);
            pinky.setPos(15*tileSize+midTile.x, 13*tileSize+midTile.y);
            inky.setPos(9*tileSize+midTile.x, 16*tileSize+midTile.y);
            clyde.setPos(18*tileSize+midTile.x, 16*tileSize+midTile.y);

            // set pacman state
            pacman.reset();
            pacman.setPos(14*tileSize-1,22*tileSize+midTile.y);

            // start with red ghost
            redBtn.onclick();

        },
        draw: function() {
            renderer.blitMap();
            renderer.renderFunc(menu.draw,menu);
            forEachCharBtn(function (btn) {
                renderer.renderFunc(btn.draw,btn);
            });
            renderer.beginMapClip();
            renderer.drawPaths();
            renderer.drawActors();
            renderer.drawTargets();
            renderer.endMapClip();
        },
        update: function() {
            menu.update();
            forEachCharBtn(function (btn) {
                btn.update();
            });
            var i,j;
            for (j=0; j<2; j++) {
                pacman.update(j);
                for (i=0;i<4;i++) {
                    actors[i].update(j);
                }
            }
            for (i=0; i<5; i++)
                actors[i].frames++;
        },
        getMenu: function() {
            return menu;
        },
    };

})();

//////////////////////////////////////////////////////////////////////////////////////
// Game Title
// (provides functions for managing the game title with clickable player and enemies below it)

var gameTitleState = (function() {

    var name,nameColor;

    var resetTitle = function() {
        if (yellowBtn.isSelected) {
            name = getGameName();
            nameColor = gameMode == GAME_COOKIE ? "#47b8ff" : pacman.color;
        }
        else if (redBtn.isSelected) {
            name = getGhostNames()[0];
            nameColor = blinky.color;
        }
        else if (pinkBtn.isSelected) {
            name = getGhostNames()[1];
            nameColor = pinky.color;
        }
        else if (cyanBtn.isSelected) {
            name = getGhostNames()[2];
            nameColor = inky.color;
        }
        else if (orangeBtn.isSelected) {
            name = getGhostNames()[3];
            nameColor = clyde.color;
        }
        else {
            name = getGameName();
            nameColor = "#FFF";
        }
    };

    var w = 20;
    var h = 30;
    var x = mapWidth/2 - 3*w;
    var y = 3*tileSize;
    var yellowBtn = new Button(x,y,w,h,function() {
        if (gameMode == GAME_MSPACMAN) {
            gameMode = GAME_OTTO;
        }
        else if (gameMode == GAME_OTTO) {
            gameMode = GAME_MSPACMAN;
        }
    });
    yellowBtn.setIcon(function (ctx,x,y,frame) {
        getPlayerDrawFunc()(ctx,x,y,DIR_RIGHT,pacman.getAnimFrame(pacman.getStepFrame(Math.floor((gameMode==GAME_PACMAN?frame+4:frame)/1.5))),true);
    });

    x += 2*w;
    var redBtn = new Button(x,y,w,h);
    redBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_LEFT,undefined,undefined,undefined,blinky.color);
    });

    x += w;
    var pinkBtn = new Button(x,y,w,h);
    pinkBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_LEFT,undefined,undefined,undefined,pinky.color);
    });

    x += w;
    var cyanBtn = new Button(x,y,w,h)
    cyanBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_LEFT,undefined,undefined,undefined,inky.color);
    });

    x += w;
    var orangeBtn = new Button(x,y,w,h);
    orangeBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_LEFT,undefined,undefined,undefined,clyde.color);
    });
    
    var forEachCharBtn = function(callback) {
        callback(yellowBtn);
        callback(redBtn);
        callback(pinkBtn);
        callback(cyanBtn);
        callback(orangeBtn);
    };
    forEachCharBtn(function(btn) {
        btn.borderBlurColor = btn.borderFocusColor = "#000";
    });

    return {
        init: function() {
            resetTitle();
            forEachCharBtn(function (btn) {
                btn.enable();
            });
        },
        shutdown: function() {
            forEachCharBtn(function (btn) {
                btn.disable();
            });
        },
        draw: function() {
            forEachCharBtn(function (btn) {
                renderer.renderFunc(btn.draw,btn);
            });

            resetTitle();
            renderer.renderFunc(function(ctx){
                ctx.font = tileSize+"px ArcadeR";
                ctx.fillStyle = nameColor;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(name, mapWidth/2, tileSize);
            });
        },
        update: function() {
            forEachCharBtn(function (btn) {
                btn.update();
            });
        },
        getYellowBtn: function() {
            return yellowBtn;
        },
    };

})();

//////////////////////////////////////////////////////////////////////////////////////
// Pre New Game State
// (the main menu for the currently selected game)

var preNewGameState = (function() {

    var exitTo = function(s,fade) {
        gameTitleState.shutdown();
        menu.disable();
        switchState(s,fade);
    };

    var menu = new Menu("",2*tileSize,0,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");

    menu.addSpacer(2);
    menu.addTextButton("PLAY",
        function() { 
            practiceMode = false;
            turboMode = false;
            newGameState.setStartLevel(1);
            exitTo(newGameState, 60);
        });
    menu.addTextButton("PLAY TURBO",
        function() { 
            practiceMode = false;
            turboMode = true;
            newGameState.setStartLevel(1);
            exitTo(newGameState, 60);
        });
    menu.addTextButton("PRACTICE",
        function() { 
            practiceMode = true;
            turboMode = false;
            exitTo(selectActState);
        });
    menu.addSpacer(0.5);
    menu.addTextButton("CUTSCENES",
        function() { 
            exitTo(cutSceneMenuState);
        });
    menu.addTextButton("ABOUT",
        function() { 
            exitTo(aboutGameState);
        });
    menu.addSpacer(0.5);
    menu.addTextButton("BACK",
        function() {
            exitTo(homeState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    return {
        init: function() {
            audio.startMusic.play();
            menu.enable();
            gameTitleState.init();
            map = undefined;
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw,menu);
            gameTitleState.draw();
        },
        update: function() {
            gameTitleState.update();
        },
        getMenu: function() {
            return menu;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Select Act State

var selectActState = (function() {

    // TODO: create ingame menu option to return to this menu (with last act played present)

    var menu;
    var numActs = 4;
    var defaultStartAct = 1;
    var startAct = defaultStartAct;

    var exitTo = function(state,fade) {
        gameTitleState.shutdown();
        menu.disable();
        switchState(state,fade);
    };

    var chooseLevelFromAct = function(act) {
        selectLevelState.setAct(act);
        exitTo(selectLevelState);
    };

    var scrollToAct = function(act) {
        // just rebuild the menu
        selectActState.setStartAct(act);
        exitTo(selectActState);
    };

    var drawArrow = function(ctx,x,y,dir) {
        ctx.save();
        ctx.translate(x,y);
        ctx.scale(1,dir);
        ctx.beginPath();
        ctx.moveTo(0,-tileSize/2);
        ctx.lineTo(tileSize,tileSize/2);
        ctx.lineTo(-tileSize,tileSize/2);
        ctx.closePath();
        ctx.fillStyle = "#FFF";
        ctx.fill();
        ctx.restore();
    };

    var buildMenu = function(act) {
        // set buttons starting at the given act
        startAct = act;

        menu = new Menu("",2*tileSize,0,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
        var i;
        var range;
        menu.addSpacer(2);
        menu.addIconButton(
            function(ctx,x,y) {
                drawArrow(ctx,x,y,1);
            },
            function() {
                scrollToAct(Math.max(1,act-numActs));
            });
        for (i=0; i<numActs; i++) {
            range = getActRange(act+i);
            menu.addTextIconButton("LEVELS "+range[0]+"-"+range[1],
                (function(j){
                    return function() { 
                        chooseLevelFromAct(act+j);
                    };
                })(i),
                (function(j){
                    return function(ctx,x,y) {
                        var s = tileSize/3*2;
                        var r = tileSize/6;
                        ctx.save();
                        ctx.translate(x,y);
                        ctx.beginPath();
                        ctx.moveTo(-s,0);
                        ctx.lineTo(-s,-r);
                        ctx.quadraticCurveTo(-s,-s,-r,-s);
                        ctx.lineTo(r,-s);
                        ctx.quadraticCurveTo(s,-s,s,-r);
                        ctx.lineTo(s,r);
                        ctx.quadraticCurveTo(s,s,r,s);
                        ctx.lineTo(-r,s);
                        ctx.quadraticCurveTo(-s,s,-s,r);
                        ctx.closePath();
                        var colors = getActColor(act+j);
                        ctx.fillStyle = colors.wallFillColor;
                        ctx.strokeStyle = WALL_OUTLINE_COLOR;
                        ctx.fill();
                        ctx.stroke();
                        ctx.restore();
                    };
                })(i));
        }
        menu.addIconButton(
            function(ctx,x,y) {
                drawArrow(ctx,x,y,-1);
            },
            function() {
                scrollToAct(act+numActs);
            });
        menu.addTextButton("BACK",
            function() {
                exitTo(preNewGameState);
            });
        menu.backButton = menu.buttons[menu.buttonCount-1];
        menu.enable();
    };

    return {
        init: function() {
            buildMenu(startAct);
            gameTitleState.init();
        },
        setStartAct: function(act) {
            startAct = act;
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw,menu);
            gameTitleState.draw();
        },
        update: function() {
            gameTitleState.update();
        },
        getMenu: function() {
            return menu;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Select Level State

var selectLevelState = (function() {

    var menu;
    var act = 1;

    var exitTo = function(state,fade) {
        gameTitleState.shutdown();
        menu.disable();
        switchState(state,fade);
    };

    var playLevel = function(i) {
        // TODO: set level (will have to set up fruit history correctly)
        newGameState.setStartLevel(i);
        exitTo(newGameState, 60);
    };

    var buildMenu = function(act) {
        var range = getActRange(act);

        menu = new Menu("",2*tileSize,0,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
        var i;
        menu.addSpacer(2);
        if (range[0] < range[1]) {
            for (i=range[0]; i<=range[1]; i++) {
                menu.addTextIconButton("LEVEL "+i,
                    (function(j){
                        return function() { 
                            playLevel(j);
                        };
                    })(i),
                    (function(j){
                        return function(ctx,x,y) {
                            var f = fruit.getFruitFromLevel(j);
                            if (f) {
                                atlas.drawFruitSprite(ctx,x,y,f.name);
                            }
                        };
                    })(i));
            }
        }
        menu.addSpacer(0.5);
        menu.addTextButton("BACK",
            function() {
                exitTo(selectActState);
            });
        menu.backButton = menu.buttons[menu.buttonCount-1];
        menu.enable();
    };

    return {
        init: function() {
            setFruitFromGameMode();
            buildMenu(act);
            gameTitleState.init();
        },
        setAct: function(a) {
            act = a;
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw,menu);
            gameTitleState.draw();
        },
        update: function() {
            gameTitleState.update();
        },
        getMenu: function() {
            return menu;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// About Game State
// (the screen shows some information about the game)

var aboutGameState = (function() {

    var exitTo = function(s,fade) {
        gameTitleState.shutdown();
        menu.disable();
        switchState(s,fade);
    };

    var menu = new Menu("",2*tileSize,0,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");

    menu.addSpacer(8);
    menu.addTextButton("BACK",
        function() {
            exitTo(preNewGameState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    var desc;
    var numDescLines;

    var drawDesc = function(ctx){
        ctx.font = tileSize+"px ArcadeR";
        ctx.fillStyle = "#FFF";
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        var y = 12*tileSize;
        var i;
        for (i=0; i<numDescLines; i++) {
            ctx.fillText(desc[i],14*tileSize,y+i*2*tileSize);
        }
    };

    return {
        init: function() {
            menu.enable();
            gameTitleState.init();
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw,menu);
            gameTitleState.draw();
            desc = getGameDescription();
            numDescLines = desc.length;
            renderer.renderFunc(drawDesc);
        },
        update: function() {
            gameTitleState.update();
        },
        getMenu: function() {
            return menu;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Cut Scene Menu State
// (the screen that shows a list of the available cutscenes for the current game)

var cutSceneMenuState = (function() {

    var exitTo = function(s,fade) {
        gameTitleState.shutdown();
        menu.disable();
        switchState(s,fade);
    };

    var exitToCutscene = function(s) {
        if (s) {
            gameTitleState.shutdown();
            menu.disable();
            playCutScene(s,cutSceneMenuState);
        }
    };

    var menu = new Menu("",2*tileSize,0,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");

    menu.addSpacer(2);
    menu.addTextButton("CUTSCENE 1",
        function() { 
            exitToCutscene(cutscenes[gameMode][0]);
        });
    menu.addTextButton("CUTSCENE 2",
        function() { 
            exitToCutscene(cutscenes[gameMode][1]);
        });
    menu.addTextButton("CUTSCENE 3",
        function() { 
            exitToCutscene(cutscenes[gameMode][2]);
        });
    menu.addSpacer();
    menu.addTextButton("BACK",
        function() {
            exitTo(preNewGameState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    return {
        init: function() {
            menu.enable();
            gameTitleState.init();
            level = 0;
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw,menu);
            gameTitleState.draw();
        },
        update: function() {
            gameTitleState.update();
        },
        getMenu: function() {
            return menu;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Score State
// (the high score screen state)

var scoreState = (function(){

    var exitTo = function(s) {
        switchState(s);
        menu.disable();
    };

    var menu = new Menu("", 2*tileSize,mapHeight-6*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    menu.addTextButton("BACK",
        function() {
            exitTo(homeState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    var frame = 0;

    var bulbs = {};
    var numBulbs;
    (function(){
        var x = -1.5*tileSize;
        var y = -1*tileSize;
        var w = 18*tileSize;
        var h = 29*tileSize;
        var s = 3;

        var i=0;
        var x0 = x;
        var y0 = y;
        var addBulb = function(x,y) { bulbs[i++] = { x:x, y:y }; };
        for (; y0<y+h; y0+=s) { addBulb(x0,y0); }
        for (; x0<x+w; x0+=s) { addBulb(x0,y0); }
        for (; y0>y; y0-=s) { addBulb(x0,y0); }
        for (; x0>x; x0-=s) { addBulb(x0,y0); }

        numBulbs = i;
    })();

    var drawScoreBox = function(ctx) {

        // draw chaser lights around the marquee
        ctx.fillStyle = "#555";
        var i,b,s=2;
        for (i=0; i<numBulbs; i++) {
            b = bulbs[i];
            ctx.fillRect(b.x, b.y, s, s);
        }
        ctx.fillStyle = "#FFF";
        for (i=0; i<63; i++) {
            b = bulbs[(i*4+Math.floor(frame/2))%numBulbs];
            ctx.fillRect(b.x, b.y, s, s);
        }

        ctx.font = tileSize+"px ArcadeR";
        ctx.textBaseline = "top";
        ctx.textAlign = "right";
        var scoreColor = "#AAA";
        var captionColor = "#444";

        var x,y;
        x = 9*tileSize;
        y = 0;
        ctx.fillStyle = "#FFF"; ctx.fillText("HIGH SCORES", x+4*tileSize,y);
        y += tileSize*4;

        var drawContrails = function(x,y) {
            ctx.lineWidth = 1.0;
            ctx.lineCap = "round";
            ctx.strokeStyle = "rgba(255,255,255,0.5)";

            ctx.save();
            ctx.translate(-2.5,0);

            var dy;
            for (dy=-4; dy<=4; dy+=2) {
                ctx.beginPath();
                ctx.moveTo(x+tileSize,y+dy);
                ctx.lineTo(x+tileSize*(Math.random()*0.5+1.5),y+dy);
                ctx.stroke();
            }
            ctx.restore();

        };

        ctx.fillStyle = scoreColor; ctx.fillText(highScores[0], x,y);
        atlas.drawPacmanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);
        y += tileSize*2;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[1], x,y);
        drawContrails(x+2*tileSize,y+tileSize/2);
        atlas.drawPacmanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);

        y += tileSize*3;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[2], x,y);
        atlas.drawMsPacmanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);
        y += tileSize*2;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[3], x,y);
        drawContrails(x+2*tileSize,y+tileSize/2);
        atlas.drawMsPacmanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);

        y += tileSize*3;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[6], x,y);
        atlas.drawOttoSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,0);
        y += tileSize*2;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[7], x,y);
        drawContrails(x+2*tileSize,y+tileSize/2);
        atlas.drawOttoSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,0);

        y += tileSize*3;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[4], x,y);
        atlas.drawCookiemanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);
        y += tileSize*2;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[5], x,y);
        drawContrails(x+2*tileSize,y+tileSize/2);
        atlas.drawCookiemanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);
    };

    var drawFood = function(ctx) {
        ctx.globalAlpha = 0.5;
        ctx.font = tileSize + "px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        var x = 20*tileSize;
        var y = 0;

        ctx.fillStyle = "#ffb8ae";
        ctx.fillRect(x-1,y-1.5,2,2);
        ctx.fillStyle = "#FFF";
        ctx.fillText("10",x+tileSize,y);
        y += 1.5*tileSize;

        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath();
        ctx.arc(x,y-0.5,tileSize/2,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "#FFF";
        ctx.fillText("50",x+tileSize,y);

        y += 3*tileSize;
        atlas.drawGhostSprite(ctx,x,y,0,DIR_RIGHT,true);
        atlas.drawGhostPoints(ctx,x+2*tileSize,y,200);

        var alpha = ctx.globalAlpha;

        y += 2*tileSize;
        ctx.globalAlpha = alpha*0.5;
        atlas.drawGhostSprite(ctx,x,y,0,DIR_RIGHT,true);
        ctx.globalAlpha = alpha;
        atlas.drawGhostSprite(ctx,x+2*tileSize,y,0,DIR_RIGHT,true);
        atlas.drawGhostPoints(ctx,x+4*tileSize,y,400);

        y += 2*tileSize;
        ctx.globalAlpha = alpha*0.5;
        atlas.drawGhostSprite(ctx,x,y,0,DIR_RIGHT,true);
        atlas.drawGhostSprite(ctx,x+2*tileSize,y,0,DIR_RIGHT,true);
        ctx.globalAlpha = alpha;
        atlas.drawGhostSprite(ctx,x+4*tileSize,y,0,DIR_RIGHT,true);
        atlas.drawGhostPoints(ctx,x+6*tileSize,y,800);

        y += 2*tileSize;
        ctx.globalAlpha = alpha*0.5;
        atlas.drawGhostSprite(ctx,x,y,0,DIR_RIGHT,true);
        atlas.drawGhostSprite(ctx,x+2*tileSize,y,0,DIR_RIGHT,true);
        atlas.drawGhostSprite(ctx,x+4*tileSize,y,0,DIR_RIGHT,true);
        ctx.globalAlpha = alpha;
        atlas.drawGhostSprite(ctx,x+6*tileSize,y,0,DIR_RIGHT,true);
        atlas.drawGhostPoints(ctx,x+8*tileSize,y,1600);

        var mspac_fruits = [
            {name: 'cherry',     points: 100},
            {name: 'strawberry', points: 200},
            {name: 'orange',     points: 500},
            {name: 'pretzel',    points: 700},
            {name: 'apple',      points: 1000},
            {name: 'pear',       points: 2000},
            {name: 'banana',     points: 5000},
        ];

        var pac_fruits = [
            {name:'cherry',     points:100},
            {name:'strawberry', points:300},
            {name:'orange',     points:500},
            {name:'apple',      points:700},
            {name:'melon',      points:1000},
            {name:'galaxian',   points:2000},
            {name:'bell',       points:3000},
            {name:'key',        points:5000},
        ];

        var i,f;
        y += 3*tileSize;
        for (i=0; i<pac_fruits.length; i++) {
            f = pac_fruits[i];
            atlas.drawFruitSprite(ctx,x,y,f.name);
            atlas.drawPacFruitPoints(ctx,x+2*tileSize,y,f.points);
            y += 2*tileSize;
        }
        x += 6*tileSize;
        y = 13.5*tileSize;
        for (i=0; i<mspac_fruits.length; i++) {
            f = mspac_fruits[i];
            atlas.drawFruitSprite(ctx,x,y,f.name);
            atlas.drawMsPacFruitPoints(ctx,x+2*tileSize,y,f.points);
            y += 2*tileSize;
        }
        ctx.globalAlpha = 1;
    };

    return {
        init: function() {
            menu.enable();
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(drawScoreBox);
            renderer.renderFunc(drawFood);
            renderer.renderFunc(menu.draw,menu);
        },
        update: function() {
            menu.update();
            frame++;
        },
        getMenu: function() {
            return menu;
        },
    };

})();

//////////////////////////////////////////////////////////////////////////////////////
// About State
// (the about screen state)

var aboutState = (function(){

    var exitTo = function(s) {
        switchState(s);
        menu.disable();
    };

    var menu = new Menu("", 2*tileSize,mapHeight-11*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    menu.addTextButton("GO TO PROJECT PAGE",
        function() {
            window.open("https://github.com/shaunew/Pac-Man");
        });
    menu.addTextButton("BACK",
        function() {
            exitTo(homeState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    var drawBody = function(ctx) {
        ctx.font = tileSize+"px ArcadeR";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";

        var x,y;
        x = 2*tileSize;
        y = 0*tileSize;
        ctx.fillStyle = "#0FF";
        ctx.fillText("DEVELOPER", x,y);
        y += tileSize*2;
        ctx.fillStyle = "#777";
        ctx.fillText("SHAUN WILLIAMS", x,y);

        y += tileSize*4;
        ctx.fillStyle = "#0FF";
        ctx.fillText("REVERSE-ENGINEERS",x,y);
        y += tileSize*2;
        ctx.fillStyle = "#777";
        ctx.fillText("JAMEY PITTMAN",x,y);
        y += tileSize*2;
        ctx.fillText("BART GRANTHAM",x,y);

        y += tileSize*4;
        ctx.fillStyle = "#FF0";
        ctx.fillText("PAC-MAN",x,y);
        y += tileSize*2;
        ctx.fillStyle = "#777";
        ctx.fillText("NAMCO",x,y);

        y += tileSize*4;
        ctx.fillStyle = "#FF0";
        ctx.fillText("MS. PAC-MAN / CRAZY OTTO",x,y);
        y += tileSize*2;
        ctx.fillStyle = "#777";
        ctx.fillText("GENERAL COMPUTING",x,y);
    };

    return {
        init: function() {
            menu.enable();
            galagaStars.init();
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.beginMapClip();
            renderer.renderFunc(galagaStars.draw);
            renderer.renderFunc(drawBody);
            renderer.renderFunc(menu.draw,menu);
            renderer.endMapClip();
        },
        update: function() {
            galagaStars.update();
            menu.update();
        },
        getMenu: function() {
            return menu;
        },
    };

})();

////////////////////////////////////////////////////
// New Game state
// (state when first starting a new game)

var newGameState = (function() {
    var frames;
    var duration = 0;
    var startLevel = 1;

    return {
        init: function() {
            clearCheats();
            frames = 0;
            level = startLevel-1;
            extraLives = practiceMode ? Infinity : 3;
            setScore(0);
            setFruitFromGameMode();
            readyNewState.init();
        },
        setStartLevel: function(i) {
            startLevel = i;
        },
        draw: function() {
            if (!map)
                return;
            renderer.blitMap();
            renderer.drawScore();
            renderer.drawMessage("PLAYER ONE", "#0FF", 9, 14);
            renderer.drawReadyMessage();
        },
        update: function() {
            if (frames == duration*60) {
                extraLives--;
                state = readyNewState;
                renderer.drawMap();
            }
            else 
                frames++;
        },
    };
})();

////////////////////////////////////////////////////
// Ready state
// (state when map is displayed and pausing before play)

var readyState =  (function(){
    var frames;
    var duration = 4;
    
    return {
        init: function() {
            audio.startMusic.play();
            var i;
            for (i=0; i<5; i++)
                actors[i].reset();
            ghostCommander.reset();
            fruit.reset();
            energizer.reset();
            powerups.reset();
            map.resetTimeEaten();
            frames = 0;
            vcr.init();
        },
        draw: function() {
            if (!map)
                return;
            renderer.blitMap();
            renderer.drawScore();
            renderer.drawActors();
            renderer.drawReadyMessage();
        },
        update: function() {
            if (frames == duration*60)
                switchState(playState);
            else
                frames++;
        },
    };
})();

////////////////////////////////////////////////////
// Ready New Level state
// (ready state when pausing before new level)

var readyNewState = newChildObject(readyState, {

    init: function() {

        // increment level and ready the next map
        level++;
        if (gameMode == GAME_PACMAN) {
            map = mapPacman;
        }
        else if (gameMode == GAME_MSPACMAN || gameMode == GAME_OTTO) {
            setNextMsPacMap();
        }
        else if (gameMode == GAME_COOKIE) {
            setNextCookieMap();
        }
        map.resetCurrent();
        fruit.onNewLevel();
        renderer.drawMap();

        // notify other objects of new level
        ghostReleaser.onNewLevel();
        elroyTimer.onNewLevel();

        // inherit attributes from readyState
        readyState.init.call(this);
    },
});

////////////////////////////////////////////////////
// Ready Restart Level state
// (ready state when pausing before restarted level)

var readyRestartState = newChildObject(readyState, {

    init: function() {
        extraLives--;
        ghostReleaser.onRestartLevel();
        elroyTimer.onRestartLevel();
        renderer.drawMap();

        // inherit attributes from readyState
        readyState.init.call(this);
    },
});

////////////////////////////////////////////////////
// Play state
// (state when playing the game)

var playState = {
    init: function() { 
        if (practiceMode) {
            vcr.reset();
        }
    },
    draw: function() {
        renderer.setLevelFlash(false);
        renderer.blitMap();
        renderer.drawScore();
        renderer.beginMapClip();
        renderer.drawFruit();
        renderer.drawPowerupOrbs();
        renderer.drawPaths();
        renderer.drawActors();
        renderer.drawPowerupViruses();
        renderer.drawPowerupAuras();
        renderer.drawTargets();
        renderer.endMapClip();
        renderer.drawPowerupHud();
    },

    // handles collision between pac-man and ghosts
    // returns true if collision happened
    isPacmanCollide: function() {
        var i,g;
        for (i = 0; i<4; i++) {
            g = ghosts[i];
            if (g.tile.x == pacman.tile.x && g.tile.y == pacman.tile.y && g.mode == GHOST_OUTSIDE) {
                if (g.scared) { // eat ghost
                    energizer.addPoints();
                    g.onEaten();
                }
                else if (pacman.invincible) // pass through ghost
                    continue;
                else if (powerups.absorbGhostHit()) // shield nullifies the attack
                    continue;
                else // killed by ghost
                    switchState(deadState);
                return true;
            }
        }
        // FORK BOMB viruses hit like ordinary (non-scared) ghosts
        if (powerups.virusTouchesPacman()) {
            if (pacman.invincible || powerups.absorbGhostHit())
                return false;
            switchState(deadState);
            return true;
        }
        return false;
    },
    update: function() {
        
        if (vcr.isSeeking()) {
            vcr.seek();
        }
        else {
            // record current state
            if (vcr.getMode() == VCR_RECORD) {
                vcr.record();
            }

            var i,j; // loop index
            var maxSteps = 2;
            var skip = false;

            // skip this frame if needed,
            // but update ghosts running home
            if (energizer.showingPoints()) {
                for (j=0; j<maxSteps; j++)
                    for (i=0; i<4; i++)
                        if (ghosts[i].mode == GHOST_GOING_HOME || ghosts[i].mode == GHOST_ENTERING_HOME)
                            ghosts[i].update(j);
                energizer.updatePointsTimer();
                skip = true;
            }
            else { // make ghosts go home immediately after points disappear
                for (i=0; i<4; i++)
                    if (ghosts[i].mode == GHOST_EATEN) {
                        ghosts[i].mode = GHOST_GOING_HOME;
                        ghosts[i].targetting = 'door';
                    }
                    ghosts[0].playSounds();
            }
            
            if (!skip) {

                // update counters
                ghostReleaser.update();
                ghostCommander.update();
                elroyTimer.update();
                fruit.update();
                energizer.update();
                powerups.update();

                // update actors one step at a time
                for (j=0; j<maxSteps; j++) {

                    // advance pacman
                    pacman.update(j);

                    // test collision with fruit
                    fruit.testCollide();

                    // test collision with power-up orbs
                    powerups.testCollide();

                    // finish level if all dots have been eaten
                    if (map.allDotsEaten()) {
                        //this.draw(); 
                        switchState(finishState);
                        audio.extend.play();
                        break;
                    }

                    // test pacman collision before and after updating ghosts
                    // (redundant to prevent pass-throughs)
                    // (if collision happens, stop immediately.)
                    if (this.isPacmanCollide()) break;
                    for (i=0;i<4;i++) actors[i].update(j);
                    powerups.updateViruses(j);
                    if (this.isPacmanCollide()) break;
                }

                // update frame counts
                for (i=0; i<5; i++)
                    actors[i].frames++;
            }
        }
    },
};

////////////////////////////////////////////////////
// Script state
// (a state that triggers functions at certain times)

var scriptState = (function(){

    return {
        init: function() {
            this.frames = 0;        // frames since state began
            this.triggerFrame = 0;  // frames since last trigger

            var trigger = this.triggers[0];
            this.drawFunc = trigger ? trigger.draw : undefined;   // current draw function
            this.updateFunc = trigger ? trigger.update : undefined; // current update function
        },
        update: function() {

            // if trigger is found for current time,
            // call its init() function
            // and store its draw() and update() functions
            var trigger = this.triggers[this.frames];
            if (trigger) {
                if (trigger.init) trigger.init();
                this.drawFunc = trigger.draw;
                this.updateFunc = trigger.update;
                this.triggerFrame = 0;
            }

            // call the last trigger's update function
            if (this.updateFunc) 
                this.updateFunc(this.triggerFrame);

            this.frames++;
            this.triggerFrame++;
        },
        draw: function() {
            // call the last trigger's draw function
            if (this.drawFunc) 
                this.drawFunc(this.triggerFrame);
        },
    };
})();

////////////////////////////////////////////////////
// Seekable Script state
// (a script state that can be controled by the VCR)

var seekableScriptState = newChildObject(scriptState, {

    init: function() {
        scriptState.init.call(this);
        this.savedFrames = {};
        this.savedTriggerFrame = {};
        this.savedDrawFunc = {};
        this.savedUpdateFunc = {};
    },

    save: function(t) {
        this.savedFrames[t] = this.frames;
        this.savedTriggerFrame[t] = this.triggerFrame;
        this.savedDrawFunc[t] = this.drawFunc;
        this.savedUpdateFunc[t] = this.updateFunc;
    },
    load: function(t) {
        this.frames = this.savedFrames[t];
        this.triggerFrame = this.savedTriggerFrame[t];
        this.drawFunc = this.savedDrawFunc[t];
        this.updateFunc = this.savedUpdateFunc[t];
    },
    update: function() {
        if (vcr.isSeeking()) {
            vcr.seek();
        }
        else {
            if (vcr.getMode() == VCR_RECORD) {
                vcr.record();
            }
            scriptState.update.call(this);
        }
    },
    draw: function() {
        if (this.drawFunc) {
            scriptState.draw.call(this);
        }
    },
});

////////////////////////////////////////////////////
// Dead state
// (state when player has lost a life)

var deadState = (function() {
    
    // this state will always have these drawn
    var commonDraw = function() {
        renderer.blitMap();
        renderer.drawScore();
    };

    return newChildObject(seekableScriptState, {

        // script functions for each time
        triggers: {
            0: { // freeze
                init: function() {
                    audio.die.play();
                },
                update: function() {
                    var i;
                    for (i=0; i<4; i++) 
                        actors[i].frames++; // keep animating ghosts
                },
                draw: function() {
                    commonDraw();
                    renderer.beginMapClip();
                    renderer.drawFruit();
                    renderer.drawActors();
                    renderer.endMapClip();
                }
            },
            60: {
                draw: function() { // isolate pacman
                    commonDraw();
                    renderer.beginMapClip();
                    renderer.drawPlayer();
                    renderer.endMapClip();
                },
            },
            120: {
                draw: function(t) { // dying animation
                    commonDraw();
                    renderer.beginMapClip();
                    renderer.drawDyingPlayer(t/75);
                    renderer.endMapClip();
                },
            },
            195: {
                draw: function() {
                    commonDraw();
                    renderer.beginMapClip();
                    renderer.drawDyingPlayer(1);
                    renderer.endMapClip();
                },
            },
            240: {
                draw: function() {
                    commonDraw();
                    renderer.beginMapClip();
                    renderer.drawDyingPlayer(1);
                    renderer.endMapClip();
                },
                init: function() { // leave
                    switchState( extraLives == 0 ? overState : readyRestartState);
                }
            },
        },
    });
})();

////////////////////////////////////////////////////
// Finish state
// (state when player has completed a level)

var finishState = (function(){

    // this state will always have these drawn
    var commonDraw = function() {
        renderer.blitMap();
        renderer.drawScore();

        renderer.beginMapClip();
        renderer.drawPlayer();
        renderer.endMapClip();
    };
    
    // flash the floor and draw
    var flashFloorAndDraw = function(on) {
        renderer.setLevelFlash(on);
        commonDraw();
    };

    return newChildObject(seekableScriptState, {

        // script functions for each time
        triggers: {
            0:   { draw: function() {
                    renderer.setLevelFlash(false);
                    renderer.blitMap();
                    renderer.drawScore();
                    renderer.beginMapClip();
                    renderer.drawFruit();
                    renderer.drawActors();
                    renderer.drawTargets();
                    renderer.endMapClip();
            } },
            120:  { draw: function() { flashFloorAndDraw(true); } },
            132: { draw: function() { flashFloorAndDraw(false); } },
            144: { draw: function() { flashFloorAndDraw(true); } },
            156: { draw: function() { flashFloorAndDraw(false); } },
            168: { draw: function() { flashFloorAndDraw(true); } },
            180: { draw: function() { flashFloorAndDraw(false); } },
            192: { draw: function() { flashFloorAndDraw(true); } },
            204: { draw: function() { flashFloorAndDraw(false); } },
            216: {
                init: function() {
                    if (!triggerCutsceneAtEndLevel()) {
                        switchState(readyNewState,60);
                    }
                }
            },
        },
    });
})();

////////////////////////////////////////////////////
// Game Over state
// (state when player has lost last life)

var overState = (function() {
    var frames;
    return {
        init: function() {
            frames = 0;
        },
        draw: function() {
            renderer.blitMap();
            renderer.drawScore();
            renderer.drawMessage("GAME  OVER", "#F00", 9, 20);
        },
        update: function() {
            if (frames == 120) {
                switchState(homeState,60);
            }
            else
                frames++;
        },
    };
})();

//@line 1 "src/input.js"
//////////////////////////////////////////////////////////////////////////////////////
// Input
// (Handles all key presses and touches)

(function(){

    // A Key Listener class (each key maps to an array of callbacks)
    var KeyEventListener = function() {
        this.listeners = {};
    };
    KeyEventListener.prototype = {
        add: function(key, callback, isActive) {
            this.listeners[key] = this.listeners[key] || [];
            this.listeners[key].push({
                isActive: isActive,
                callback: callback,
            });
        },
        exec: function(key, e) {
            var keyListeners = this.listeners[key];
            if (!keyListeners) {
                return;
            }
            var i,l;
            var numListeners = keyListeners.length;
            for (i=0; i<numListeners; i++) {
                l = keyListeners[i];
                if (!l.isActive || l.isActive()) {
                    e.preventDefault();
                    if (l.callback()) { // do not propagate keys if returns true
                        break;
                    }
                }
            }
        },
    };

    // declare key event listeners
    var keyDownListeners = new KeyEventListener();
    var keyUpListeners = new KeyEventListener();

    // helper functions for adding custom key listeners
    var addKeyDown = function(key,callback,isActive) { keyDownListeners.add(key,callback,isActive); };
    var addKeyUp   = function(key,callback,isActive) { keyUpListeners.add(key,callback,isActive); };

    // boolean states of each key
    var keyStates = {};

    // hook my key listeners to the window's listeners
    window.addEventListener("keydown", function(e) {
        var key = (e||window.event).keyCode;

        // only execute at first press event
        if (!keyStates[key]) {
            keyStates[key] = true;
            keyDownListeners.exec(key, e);
        }
    });
    window.addEventListener("keyup",function(e) {
        var key = (e||window.event).keyCode;

        keyStates[key] = false;
        keyUpListeners.exec(key, e);
    });


    // key enumerations

    var KEY_ENTER = 13;
    var KEY_ESC = 27;

    var KEY_LEFT = 37;
    var KEY_RIGHT = 39;
    var KEY_UP = 38;
    var KEY_DOWN = 40;

    var KEY_SHIFT = 16;
    var KEY_CTRL = 17;
    var KEY_ALT = 18;

    var KEY_SPACE = 32;

    var KEY_M = 77;
    var KEY_N = 78;
    var KEY_Q = 81;
    var KEY_W = 87;
    var KEY_E = 69;
    var KEY_R = 82;
    var KEY_T = 84;

    var KEY_A = 65;
    var KEY_S = 83;
    var KEY_D = 68;
    var KEY_F = 70;
    var KEY_G = 71;

    var KEY_I = 73;
    var KEY_O = 79;
    var KEY_P = 80;

    var KEY_1 = 49;
    var KEY_2 = 50;

    var KEY_END = 35;

    // Custom Key Listeners

    // Menu Navigation Keys
    var menu;
    var isInMenu = function() {
        menu = (state.getMenu && state.getMenu());
        if (!menu && inGameMenu.isOpen()) {
            menu = inGameMenu.getMenu();
        }
        return menu;
    };
    addKeyDown(KEY_ESC,   function(){ menu.backButton ? menu.backButton.onclick():0; return true; }, isInMenu);
    addKeyDown(KEY_ENTER, function(){ menu.clickCurrentOption(); }, isInMenu);
    var isMenuKeysAllowed = function() {
        var menu = isInMenu();
        return menu && !menu.noArrowKeys;
    };
    addKeyDown(KEY_UP,    function(){ menu.selectPrevOption(); }, isMenuKeysAllowed);
    addKeyDown(KEY_DOWN,  function(){ menu.selectNextOption(); }, isMenuKeysAllowed);
    var isInGameMenuButtonClickable = function() {
        return hud.isValidState() && !inGameMenu.isOpen();
    };
    addKeyDown(KEY_ESC, function() { inGameMenu.getMenuButton().onclick(); return true; }, isInGameMenuButtonClickable);

    // Move Pac-Man
    var isPlayState = function() { return state == learnState || state == newGameState || state == playState || state == readyNewState || state == readyRestartState; };
    addKeyDown(KEY_LEFT,  function() { pacman.setInputDir(DIR_LEFT); },  isPlayState);
    addKeyDown(KEY_RIGHT, function() { pacman.setInputDir(DIR_RIGHT); }, isPlayState);
    addKeyDown(KEY_UP,    function() { pacman.setInputDir(DIR_UP); },    isPlayState);
    addKeyDown(KEY_DOWN,  function() { pacman.setInputDir(DIR_DOWN); },  isPlayState);
    addKeyUp  (KEY_LEFT,  function() { pacman.clearInputDir(DIR_LEFT); },  isPlayState);
    addKeyUp  (KEY_RIGHT, function() { pacman.clearInputDir(DIR_RIGHT); }, isPlayState);
    addKeyUp  (KEY_UP,    function() { pacman.clearInputDir(DIR_UP); },    isPlayState);
    addKeyUp  (KEY_DOWN,  function() { pacman.clearInputDir(DIR_DOWN); },  isPlayState);

    // Slow-Motion
    var isPracticeMode = function() { return isPlayState() && practiceMode; };
    //isPracticeMode = function() { return true; };
    addKeyDown(KEY_1, function() { executive.setUpdatesPerSecond(30); }, isPracticeMode);
    addKeyDown(KEY_2,  function() { executive.setUpdatesPerSecond(15); }, isPracticeMode);
    addKeyUp  (KEY_1, function() { executive.setUpdatesPerSecond(60); }, isPracticeMode);
    addKeyUp  (KEY_2,  function() { executive.setUpdatesPerSecond(60); }, isPracticeMode);

    // Toggle VCR
    var canSeek = function() { return !isInMenu() && vcr.getMode() != VCR_NONE; };
    addKeyDown(KEY_SHIFT, function() { vcr.startSeeking(); },   canSeek);
    addKeyUp  (KEY_SHIFT, function() { vcr.startRecording(); }, canSeek);

    // Adjust VCR seeking
    var isSeekState = function() { return vcr.isSeeking(); };
    addKeyDown(KEY_UP,   function() { vcr.nextSpeed(1); },  isSeekState);
    addKeyDown(KEY_DOWN, function() { vcr.nextSpeed(-1); }, isSeekState);

    // Skip Level
    var canSkip = function() {
        return isPracticeMode() && 
            (state == newGameState ||
            state == readyNewState ||
            state == readyRestartState ||
            state == playState ||
            state == deadState ||
            state == finishState ||
            state == overState);
    };
    addKeyDown(KEY_N, function() { switchState(readyNewState, 60); }, canSkip);
    addKeyDown(KEY_M, function() { switchState(finishState); }, function() { return state == playState; });

    // Draw Actor Targets (fishpoles)
    addKeyDown(KEY_Q, function() { blinky.isDrawTarget = !blinky.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_W, function() { pinky.isDrawTarget = !pinky.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_E, function() { inky.isDrawTarget = !inky.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_R, function() { clyde.isDrawTarget = !clyde.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_T, function() { pacman.isDrawTarget = !pacman.isDrawTarget; }, isPracticeMode);

    // Draw Actor Paths
    addKeyDown(KEY_A, function() { blinky.isDrawPath = !blinky.isDrawPath; }, isPracticeMode);
    addKeyDown(KEY_S, function() { pinky.isDrawPath = !pinky.isDrawPath; }, isPracticeMode);
    addKeyDown(KEY_D, function() { inky.isDrawPath = !inky.isDrawPath; }, isPracticeMode);
    addKeyDown(KEY_F, function() { clyde.isDrawPath = !clyde.isDrawPath; }, isPracticeMode);
    addKeyDown(KEY_G, function() { pacman.isDrawPath = !pacman.isDrawPath; }, isPracticeMode);

    // Miscellaneous Cheats
    addKeyDown(KEY_I, function() { pacman.invincible = !pacman.invincible; }, isPracticeMode);
    addKeyDown(KEY_O, function() { turboMode = !turboMode; }, isPracticeMode);
    addKeyDown(KEY_P, function() { pacman.ai = !pacman.ai; }, isPracticeMode);

    addKeyDown(KEY_END, function() { executive.togglePause(); });

})();

var initSwipe = function() {

    // position of anchor
    var x = 0;
    var y = 0;

    // current distance from anchor
    var dx = 0;
    var dy = 0;

    // minimum distance from anchor before direction is registered
    var r = 4;
    
    var touchStart = function(event) {
        event.preventDefault();
        var fingerCount = event.touches.length;
        if (fingerCount == 1) {

            // commit new anchor
            x = event.touches[0].pageX;
            y = event.touches[0].pageY;

        }
        else {
            touchCancel(event);
        }
    };

    var touchMove = function(event) {
        event.preventDefault();
        var fingerCount = event.touches.length;
        if (fingerCount == 1) {

            // get current distance from anchor
            dx = event.touches[0].pageX - x;
            dy = event.touches[0].pageY - y;

            // if minimum move distance is reached
            if (dx*dx+dy*dy >= r*r) {

                // commit new anchor
                x += dx;
                y += dy;

                // register direction
                if (Math.abs(dx) >= Math.abs(dy)) {
                    pacman.setInputDir(dx>0 ? DIR_RIGHT : DIR_LEFT);
                }
                else {
                    pacman.setInputDir(dy>0 ? DIR_DOWN : DIR_UP);
                }
            }
        }
        else {
            touchCancel(event);
        }
    };

    var touchEnd = function(event) {
        event.preventDefault();
    };

    var touchCancel = function(event) {
        event.preventDefault();
        x=y=dx=dy=0;
    };

    var touchTap = function(event) {
        // tap to clear input directions
        pacman.clearInputDir(undefined);
    };
    
    // register touch events
    document.onclick = touchTap;
    document.ontouchstart = touchStart;
    document.ontouchend = touchEnd;
    document.ontouchmove = touchMove;
    document.ontouchcancel = touchCancel;
};
//@line 1 "src/cutscenes.js"
////////////////////////////////////////////////
// Cutscenes
//

var playCutScene = function(cutScene, nextState) {

    // redraw map buffer with fruit list but no map structure
    map = undefined;
    renderer.drawMap(true);

    // miss the audio silence and time it cleanly for pacman cut scene 1
    setTimeout(audio.coffeeBreakMusic.startLoop, 1200);
    cutScene.nextState = nextState;
    switchState(cutScene, 60);

};

var pacmanCutscene1 = newChildObject(scriptState, {
    init: function() {
        scriptState.init.call(this);

        // initialize actor positions
        pacman.setPos(232, 164);
        blinky.setPos(257, 164);

        // initialize actor directions
        blinky.setDir(DIR_LEFT);
        blinky.faceDirEnum = DIR_LEFT;
        pacman.setDir(DIR_LEFT);

        // initialize misc actor properties
        blinky.scared = false;
        blinky.mode = GHOST_OUTSIDE;

        // clear other states
        backupCheats();
        clearCheats();
        energizer.reset();

        // temporarily override actor step sizes
        pacman.getNumSteps = function() {
            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_PACMAN);
        };
        blinky.getNumSteps = function() {
            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
        };

        // temporarily override steering functions
        pacman.steer = blinky.steer = function(){};
    },
    triggers: {

        // Blinky chases Pac-Man
        0: {
            update: function() {
                var j;
                for (j=0; j<2; j++) {
                    pacman.update(j);
                    blinky.update(j);
                }
                pacman.frames++;
                blinky.frames++;
            },
            draw: function() {
                renderer.blitMap();
                renderer.beginMapClip();
                renderer.drawPlayer();
                renderer.drawGhost(blinky);
                renderer.endMapClip();
            },
        },

        // Pac-Man chases Blinky
        260: {
            init: function() {
                pacman.setPos(-193, 155);
                blinky.setPos(-8, 164);

                // initialize actor directions
                blinky.setDir(DIR_RIGHT);
                blinky.faceDirEnum = DIR_RIGHT;
                pacman.setDir(DIR_RIGHT);

                // initialize misc actor properties
                blinky.scared = true;

                // temporarily override step sizes
                pacman.getNumSteps = function() {
                    return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_PACMAN_FRIGHT);
                };
                blinky.getNumSteps = function() {
                    return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_GHOST_FRIGHT);
                };
            },
            update: function() {
                var j;
                for (j=0; j<2; j++) {
                    pacman.update(j);
                    blinky.update(j);
                }
                pacman.frames++;
                blinky.frames++;
            },
            draw: function() {
                renderer.blitMap();
                renderer.beginMapClip();
                renderer.drawGhost(blinky);
                renderer.renderFunc(function(ctx) {
                    var frame = Math.floor(pacman.steps/4) % 4; // slower to switch animation frame when giant
                    if (frame == 3) {
                        frame = 1;
                    }
                    drawGiantPacmanSprite(ctx, pacman.pixel.x, pacman.pixel.y, pacman.dirEnum, frame);
                });
                renderer.endMapClip();
            },
        },

        // end
        640: {
            init: function() {
                // disable custom steps
                delete pacman.getNumSteps;
                delete blinky.getNumSteps;

                // disable custom steering
                delete pacman.steer;
                delete blinky.steer;

                // exit to next level
                restoreCheats();
                switchState(pacmanCutscene1.nextState, 60);
            },
        },
    },
});

var mspacmanCutscene1 = (function() {

    // create new players pac and mspac for this scene
    var pac = new Player();
    var mspac = new Player();

    // draws pac or mspac
    var drawPlayer = function(ctx,player) {
        var frame = player.getAnimFrame();
        var func;
        if (player == pac) {
            func = gameMode == GAME_MSPACMAN ? atlas.drawPacmanSprite : atlas.drawOttoSprite;
        }
        else if (player == mspac) {
            func = gameMode == GAME_MSPACMAN ? atlas.drawMsPacmanSprite : atlas.drawMsOttoSprite;
        }
        func(ctx, player.pixel.x, player.pixel.y, player.dirEnum, frame);
    };

    // draws all actors
    var draw = function() {
        renderer.blitMap();
        renderer.beginMapClip();
        renderer.renderFunc(function(ctx) {
            drawPlayer(ctx,pac);
            drawPlayer(ctx,mspac);
        });
        renderer.drawGhost(inky);
        renderer.drawGhost(pinky);
        renderer.endMapClip();
    };

    // updates all actors
    var update = function() {
        var j;
        for (j=0; j<2; j++) {
            pac.update(j);
            mspac.update(j);
            inky.update(j);
            pinky.update(j);
        }
        pac.frames++;
        mspac.frames++;
        inky.frames++;
        pinky.frames++;
    };

    var exit = function() {
        // disable custom steps
        delete inky.getNumSteps;
        delete pinky.getNumSteps;

        // disable custom steering
        delete inky.steer;
        delete pinky.steer;

        // disable custom animation steps
        delete inky.getAnimFrame;
        delete pinky.getAnimFrame;

        // exit to next level
        restoreCheats();
        switchState(mspacmanCutscene1.nextState, 60);
    };

    return newChildObject(scriptState, {

        init: function() {
            scriptState.init.call(this);

            // chosen by trial-and-error to match animations
            mspac.frames = 20;
            pac.frames = 12;

            // initialize actor states
            pac.setPos(-10, 99);
            pac.setDir(DIR_RIGHT);
            mspac.setPos(232, 180);
            mspac.setDir(DIR_LEFT);
            
            // initial ghost states
            inky.frames = 0;
            inky.mode = GHOST_OUTSIDE;
            inky.scared = false;
            inky.setPos(pac.pixel.x-42, 99);
            inky.setDir(DIR_RIGHT);
            inky.faceDirEnum = DIR_RIGHT;
            pinky.frames = 3;
            pinky.mode = GHOST_OUTSIDE;
            pinky.scared = false;
            pinky.setPos(mspac.pixel.x+49, 180);
            pinky.setDir(DIR_LEFT);
            pinky.faceDirEnum = DIR_LEFT;

            // clear other states
            backupCheats();
            clearCheats();
            energizer.reset();

            // step player animation every four frames
            pac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };
            mspac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };

            // step ghost animation every six frames
            inky.getAnimFrame = function() { return Math.floor(this.frames/8)%2; };
            pinky.getAnimFrame = function() { return Math.floor(this.frames/8)%2; };

            // set actor step sizes
            pac.getNumSteps = function() { return 1; };
            mspac.getNumSteps = function() { return 1; };
            inky.getNumSteps = function() { return 1; };
            pinky.getNumSteps = function() { return 1; };

            // set steering functions
            pac.steer = function(){};
            mspac.steer = function(){};
            inky.steer = function(){};
            pinky.steer = function(){};
        },
        triggers: {

            // Inky chases Pac, Pinky chases Mspac
            0: {
                update: function() {
                    update();
                    if (inky.pixel.x == 105) {
                        // speed up the ghosts
                        inky.getNumSteps = function() {
                            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
                        };
                        pinky.getNumSteps = function() {
                            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
                        };
                    }
                },
                draw: draw,
            },

            // MsPac and Pac converge with ghosts chasing
            300: (function(){

                // bounce animation when ghosts bump heads
                var inkyBounceX =  [ 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
                var inkyBounceY =  [-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1];
                var pinkyBounceX = [ 0, 0, 0, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0];
                var pinkyBounceY = [ 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0];
                var inkyBounceFrame = 0;
                var pinkyBounceFrame = 0;
                var inkyBounceFrameLen = inkyBounceX.length;
                var pinkyBounceFrameLen = pinkyBounceX.length;

                // ramp animation for players
                var rampX = [0, 1, 1, 1, 1, 0, 0];
                var rampY = [0, 0,-1,-1,-1, 0, 0];
                var rampFrame = 0;
                var rampFrameLen = rampX.length;

                // climbing
                var climbFrame = 0;

                // meeting
                var meetFrame = 0;

                var ghostMode;
                var GHOST_RUN = 0;
                var GHOST_BUMP = 1;

                var playerMode;
                var PLAYER_RUN = 0;
                var PLAYER_RAMP = 1;
                var PLAYER_CLIMB = 2;
                var PLAYER_MEET = 3;
                     
                return {
                    init: function() {
                        // reset frames
                        inkyBounceFrame = pinkyBounceFrame = rampFrame = climbFrame = meetFrame = 0;

                        // set modes
                        ghostMode = GHOST_RUN;
                        playerMode = PLAYER_RUN;

                        // set initial positions and directions
                        mspac.setPos(-8,143);
                        mspac.setDir(DIR_RIGHT);

                        pinky.setPos(-81,143);
                        pinky.faceDirEnum = DIR_RIGHT;
                        pinky.setDir(DIR_RIGHT);

                        pac.setPos(223+8+3,142);
                        pac.setDir(DIR_LEFT);

                        inky.setPos(302,143);
                        inky.faceDirEnum = DIR_LEFT;
                        inky.setDir(DIR_LEFT);

                        // set ghost speed
                        inky.getNumSteps = pinky.getNumSteps = function() {
                            return "11211212"[this.frames%8];
                        };
                    },
                    update: function() {
                        var j;

                        // update players
                        if (playerMode == PLAYER_RUN) {
                            for (j=0; j<2; j++) {
                                pac.update(j);
                                mspac.update(j);
                            }
                            if (mspac.pixel.x == 102) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_RAMP) {
                            pac.pixel.x -= rampX[rampFrame];
                            pac.pixel.y += rampY[rampFrame];
                            pac.commitPos();
                            mspac.pixel.x += rampX[rampFrame];
                            mspac.pixel.y += rampY[rampFrame];
                            mspac.commitPos();
                            rampFrame++;
                            if (rampFrame == rampFrameLen) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_CLIMB) {
                            if (climbFrame == 0) {
                                // set initial climb state for mspac
                                mspac.pixel.y -= 2;
                                mspac.commitPos();
                                mspac.setDir(DIR_UP);

                                // set initial climb state for pac
                                pac.pixel.x -= 1;
                                pac.commitPos();
                                pac.setDir(DIR_UP);
                            }
                            else {
                                for (j=0; j<2; j++) {
                                    pac.update(j);
                                    mspac.update(j);
                                }
                            }
                            climbFrame++;
                            if (mspac.pixel.y == 91) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_MEET) {
                            if (meetFrame == 0) {
                                // set initial meet state for mspac
                                mspac.pixel.y++;
                                mspac.setDir(DIR_RIGHT);
                                mspac.commitPos();

                                // set initial meet state for pac
                                pac.pixel.y--;
                                pac.pixel.x++;
                                pac.setDir(DIR_LEFT);
                                pac.commitPos();
                            }
                            if (meetFrame > 18) {
                                // pause player frames after a certain period
                                pac.frames--;
                                mspac.frames--;
                            }
                            if (meetFrame == 78) {
                                exit();
                            }
                            meetFrame++;
                        }
                        pac.frames++;
                        mspac.frames++;

                        // update ghosts
                        if (ghostMode == GHOST_RUN) {
                            for (j=0; j<2; j++) {
                                inky.update(j);
                                pinky.update(j);
                            }

                            // stop at middle
                            inky.pixel.x = Math.max(120, inky.pixel.x);
                            inky.commitPos();
                            pinky.pixel.x = Math.min(105, pinky.pixel.x);
                            pinky.commitPos();

                            if (pinky.pixel.x == 105) {
                                ghostMode++;
                            }
                        }
                        else if (ghostMode == GHOST_BUMP) {
                            if (inkyBounceFrame < inkyBounceFrameLen) {
                                inky.pixel.x += inkyBounceX[inkyBounceFrame];
                                inky.pixel.y += inkyBounceY[inkyBounceFrame];
                            }
                            if (pinkyBounceFrame < pinkyBounceFrameLen) {
                                pinky.pixel.x += pinkyBounceX[pinkyBounceFrame];
                                pinky.pixel.y += pinkyBounceY[pinkyBounceFrame];
                            }
                            inkyBounceFrame++;
                            pinkyBounceFrame++;
                        }
                        inky.frames++;
                        pinky.frames++;
                    },
                    draw: function() {
                        renderer.blitMap();
                        renderer.beginMapClip();
                        renderer.renderFunc(function(ctx) {
                            drawPlayer(ctx,pac);
                            drawPlayer(ctx,mspac);
                        });
                        if (inkyBounceFrame < inkyBounceFrameLen) {
                            renderer.drawGhost(inky);
                        }
                        if (pinkyBounceFrame < pinkyBounceFrameLen) {
                            renderer.drawGhost(pinky);
                        }
                        if (playerMode == PLAYER_MEET) {
                            renderer.renderFunc(function(ctx) {
                                drawHeartSprite(ctx, 112, 73);
                            });
                        }
                        renderer.endMapClip();
                    },
                }; // returned object
            })(), // trigger at 300
        }, // triggers
    }); // returned object
})(); // mspacCutscene1

var mspacmanCutscene2 = (function() {

    // create new players pac and mspac for this scene
    var pac = new Player();
    var mspac = new Player();

    // draws pac or mspac
    var drawPlayer = function(ctx,player) {
        var frame = player.getAnimFrame();
        var func;
        if (player == pac) {
            func = gameMode == GAME_MSPACMAN ? atlas.drawPacmanSprite : atlas.drawOttoSprite;
        }
        else if (player == mspac) {
            func = gameMode == GAME_MSPACMAN ? atlas.drawMsPacmanSprite : atlas.drawMsOttoSprite;
        }
        func(ctx, player.pixel.x, player.pixel.y, player.dirEnum, frame);
    };

    // draws all actors
    var draw = function() {
        renderer.blitMap();
        renderer.beginMapClip();
        renderer.renderFunc(function(ctx) {
            drawPlayer(ctx,pac);
            drawPlayer(ctx,mspac);
        });
        renderer.endMapClip();
    };

    // updates all actors
    var update = function() {
        var j;
        for (j=0; j<7; j++) {
            pac.update(j);
            mspac.update(j);
        }
        pac.frames++;
        mspac.frames++;
    };

    var exit = function() {
        // exit to next level
        restoreCheats();
        switchState(mspacmanCutscene2.nextState, 60);
    };

    var getChaseSteps = function() { return 3; };
    var getFleeSteps = function() { return "32"[this.frames%2]; };
    var getDartSteps = function() { return 7; };

    return newChildObject(scriptState, {

        init: function() {
            scriptState.init.call(this);

            // chosen by trial-and-error to match animations
            mspac.frames = 20;
            pac.frames = 12;

            // step player animation every four frames
            pac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };
            mspac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };

            // set steering functions
            pac.steer = function(){};
            mspac.steer = function(){};
            
            backupCheats();
            clearCheats();
        },
        triggers: {
            0: {
                draw: function() {
                    renderer.blitMap();
                },
            },

            160: {
                init: function() {
                    pac.setPos(-8, 67);
                    pac.setDir(DIR_RIGHT);

                    mspac.setPos(-106, 68);
                    mspac.setDir(DIR_RIGHT);

                    pac.getNumSteps = getFleeSteps;
                    mspac.getNumSteps = getChaseSteps;
                },
                update: update,
                draw: draw,
            },
            410: {
                init: function() {
                    pac.setPos(329, 163);
                    pac.setDir(DIR_LEFT);

                    mspac.setPos(223+8, 164);
                    mspac.setDir(DIR_LEFT);

                    pac.getNumSteps = getChaseSteps;
                    mspac.getNumSteps = getFleeSteps;
                },
                update: update,
                draw: draw,
            },
            670: {
                init: function() {
                    pac.setPos(-8,142);
                    pac.setDir(DIR_RIGHT);

                    mspac.setPos(-106, 143);
                    mspac.setDir(DIR_RIGHT);

                    pac.getNumSteps = getFleeSteps;
                    mspac.getNumSteps = getChaseSteps;
                },
                update: update,
                draw: draw,
            },
            930: {
                init: function() {
                    pac.setPos(233+148,99);
                    pac.setDir(DIR_LEFT);

                    mspac.setPos(233,100);
                    mspac.setDir(DIR_LEFT);

                    pac.getNumSteps = getDartSteps;
                    mspac.getNumSteps = getDartSteps;
                },
                update: function() {
                    if (pac.pixel.x <= 17 && pac.dirEnum == DIR_LEFT) {
                        pac.setPos(-2,195);
                        pac.setDir(DIR_RIGHT);

                        mspac.setPos(-2-148,196);
                        mspac.setDir(DIR_RIGHT);
                    }
                    update();
                },
                draw: draw,
            },
            1140: {
                init: exit,
            },
        }, // triggers
    }); // returned object
})(); // mspacCutscene2

var cookieCutscene1 = newChildObject(scriptState, {

    init: function() {
        scriptState.init.call(this);

        // initialize actor positions
        pacman.setPos(232, 164);
        blinky.setPos(257, 164);

        // initialize actor directions
        blinky.setDir(DIR_LEFT);
        blinky.faceDirEnum = DIR_LEFT;
        pacman.setDir(DIR_LEFT);

        // initialize misc actor properties
        blinky.scared = false;
        blinky.mode = GHOST_OUTSIDE;

        // clear other states
        backupCheats();
        clearCheats();
        energizer.reset();

        // temporarily override actor step sizes
        pacman.getNumSteps = function() {
            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_PACMAN);
        };
        blinky.getNumSteps = function() {
            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
        };

        // temporarily override steering functions
        pacman.steer = blinky.steer = function(){};
    },
    triggers: {

        // Blinky chases Pac-Man
        0: {
            update: function() {
                var j;
                for (j=0; j<2; j++) {
                    pacman.update(j);
                    blinky.update(j);
                }
                pacman.frames++;
                blinky.frames++;
            },
            draw: function() {
                renderer.blitMap();
                renderer.beginMapClip();
                renderer.drawPlayer();
                renderer.drawGhost(blinky);
                renderer.endMapClip();
            },
        },

        // Pac-Man chases Blinky
        260: {
            init: function() {
                pacman.setPos(-193, 164);
                blinky.setPos(-8, 155);

                // initialize actor directions
                blinky.setDir(DIR_RIGHT);
                blinky.faceDirEnum = DIR_RIGHT;
                pacman.setDir(DIR_RIGHT);

                // initialize misc actor properties
                blinky.scared = true;

                // temporarily override step sizes
                pacman.getNumSteps = function() {
                    return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_PACMAN_FRIGHT);
                };
                blinky.getNumSteps = function() {
                    return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_GHOST_FRIGHT);
                };
            },
            update: function() {
                var j;
                for (j=0; j<2; j++) {
                    pacman.update(j);
                    blinky.update(j);
                }
                pacman.frames++;
                blinky.frames++;
            },
            draw: function() {
                renderer.blitMap();
                renderer.beginMapClip();
                renderer.drawPlayer();
                renderer.renderFunc(function(ctx) {
                    var y = blinky.getBounceY(blinky.pixel.x, blinky.pixel.y, DIR_RIGHT);
                    var x = blinky.pixel.x;
                    ctx.save();
                    ctx.translate(x,y);
                    var s = 16/6;
                    ctx.scale(s,s);
                    drawCookie(ctx,0,0);
                    ctx.restore();
                });
                renderer.endMapClip();
            },
        },

        // end
        640: {
            init: function() {
                // disable custom steps
                delete pacman.getNumSteps;
                delete blinky.getNumSteps;

                // disable custom steering
                delete pacman.steer;
                delete blinky.steer;

                // exit to next level
                restoreCheats();
                switchState(cookieCutscene1.nextState, 60);
            },
        },
    },
});

var cookieCutscene2 = (function() {

    /*
    NOTE:
    This is a copy-paste of mspacmanCutscene1.
    pac is replaced with a scared ghost (bouncing cookie)
    mspac is replaced with Cookie-Man
    */

    // create new players pac and mspac for this scene
    var pac = new Ghost();
    pac.scared = true;
    pac.mode = GHOST_OUTSIDE;
    var mspac = new Player();

    // draws pac or mspac
    var drawPlayer = function(ctx,player) {
        var frame = player.getAnimFrame();
        var func;
        if (player == pac) {
            var y = player.getBounceY(player.pixel.x, player.pixel.y, player.dirEnum);
            atlas.drawMuppetSprite(ctx, player.pixel.x, y, 0, player.dirEnum, true, false);
        }
        else if (player == mspac) {
            drawCookiemanSprite(ctx, player.pixel.x, player.pixel.y, player.dirEnum, frame, true);
        }
    };

    // draws all actors
    var draw = function() {
        renderer.blitMap();
        renderer.beginMapClip();
        renderer.renderFunc(function(ctx) {
            drawPlayer(ctx,pac);
            drawPlayer(ctx,mspac);
        });
        renderer.drawGhost(inky);
        renderer.drawGhost(pinky);
        renderer.endMapClip();
    };

    // updates all actors
    var update = function() {
        var j;
        for (j=0; j<2; j++) {
            pac.update(j);
            mspac.update(j);
            inky.update(j);
            pinky.update(j);
        }
        pac.frames++;
        mspac.frames++;
        inky.frames++;
        pinky.frames++;
    };

    var exit = function() {
        // disable custom steps
        delete inky.getNumSteps;
        delete pinky.getNumSteps;

        // disable custom steering
        delete inky.steer;
        delete pinky.steer;

        // disable custom animation steps
        delete inky.getAnimFrame;
        delete pinky.getAnimFrame;

        // exit to next level
        restoreCheats();
        switchState(cookieCutscene2.nextState, 60);
    };

    return newChildObject(scriptState, {

        init: function() {
            scriptState.init.call(this);

            // chosen by trial-and-error to match animations
            mspac.frames = 14;
            pac.frames = 12;

            // initialize actor states
            pac.setPos(-10, 99);
            pac.setDir(DIR_RIGHT);
            mspac.setPos(232, 180);
            mspac.setDir(DIR_LEFT);
            
            // initial ghost states
            inky.frames = 0;
            inky.mode = GHOST_OUTSIDE;
            inky.scared = false;
            inky.setPos(pac.pixel.x-42, 99);
            inky.setDir(DIR_RIGHT);
            inky.faceDirEnum = DIR_RIGHT;
            pinky.frames = 3;
            pinky.mode = GHOST_OUTSIDE;
            pinky.scared = false;
            pinky.setPos(mspac.pixel.x+49, 180);
            pinky.setDir(DIR_LEFT);
            pinky.faceDirEnum = DIR_LEFT;

            // clear other states
            backupCheats();
            clearCheats();
            energizer.reset();

            // step player animation every four frames
            pac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };
            mspac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };

            // step ghost animation every six frames
            inky.getAnimFrame = function() { return Math.floor(this.frames/8)%2; };
            pinky.getAnimFrame = function() { return Math.floor(this.frames/8)%2; };

            // set actor step sizes
            pac.getNumSteps = function() { return 1; };
            mspac.getNumSteps = function() { return 1; };
            inky.getNumSteps = function() { return 1; };
            pinky.getNumSteps = function() { return 1; };

            // set steering functions
            pac.steer = function(){};
            mspac.steer = function(){};
            inky.steer = function(){};
            pinky.steer = function(){};
        },
        triggers: {

            // Inky chases Pac, Pinky chases Mspac
            0: {
                update: function() {
                    update();
                    if (inky.pixel.x == 105) {
                        // speed up the ghosts
                        inky.getNumSteps = function() {
                            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
                        };
                        pinky.getNumSteps = function() {
                            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
                        };
                    }
                },
                draw: draw,
            },

            // MsPac and Pac converge with ghosts chasing
            300: (function(){

                // bounce animation when ghosts bump heads
                var inkyBounceX =  [ 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
                var inkyBounceY =  [-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1];
                var pinkyBounceX = [ 0, 0, 0, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0];
                var pinkyBounceY = [ 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0];
                var inkyBounceFrame = 0;
                var pinkyBounceFrame = 0;
                var inkyBounceFrameLen = inkyBounceX.length;
                var pinkyBounceFrameLen = pinkyBounceX.length;

                // ramp animation for players
                var rampX = [0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1];
                var rampY = [0, 0,-1,-1,-1, 0, 0, 0, 0, 0, 0, 0, 0];
                var rampFrame = 0;
                var rampFrameLen = rampX.length;

                // climbing
                var climbFrame = 0;

                // meeting
                var meetFrame = 0;

                var ghostMode;
                var GHOST_RUN = 0;
                var GHOST_BUMP = 1;

                var playerMode;
                var PLAYER_RUN = 0;
                var PLAYER_RAMP = 1;
                var PLAYER_CLIMB = 2;
                var PLAYER_MEET = 3;
                     
                return {
                    init: function() {
                        // reset frames
                        inkyBounceFrame = pinkyBounceFrame = rampFrame = climbFrame = meetFrame = 0;

                        // set modes
                        ghostMode = GHOST_RUN;
                        playerMode = PLAYER_RUN;

                        // set initial positions and directions
                        mspac.setPos(-8,143);
                        mspac.setDir(DIR_RIGHT);

                        pinky.setPos(-81,143);
                        pinky.faceDirEnum = DIR_RIGHT;
                        pinky.setDir(DIR_RIGHT);

                        pac.setPos(223+8+3,142);
                        pac.setDir(DIR_LEFT);

                        inky.setPos(302,143);
                        inky.faceDirEnum = DIR_LEFT;
                        inky.setDir(DIR_LEFT);

                        // set ghost speed
                        inky.getNumSteps = pinky.getNumSteps = function() {
                            return "11211212"[this.frames%8];
                        };
                    },
                    update: function() {
                        var j;

                        // update players
                        if (playerMode == PLAYER_RUN) {
                            for (j=0; j<2; j++) {
                                pac.update(j);
                                mspac.update(j);
                            }
                            if (mspac.pixel.x == 102) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_RAMP) {
                            pac.pixel.x -= rampX[rampFrame];
                            pac.pixel.y += rampY[rampFrame];
                            pac.commitPos();
                            mspac.pixel.x += rampX[rampFrame];
                            mspac.pixel.y += rampY[rampFrame];
                            mspac.commitPos();
                            rampFrame++;
                            if (rampFrame == rampFrameLen) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_CLIMB) {
                            if (climbFrame == 0) {
                                // set initial climb state for mspac
                                mspac.pixel.y -= 2;
                                mspac.commitPos();
                                mspac.setDir(DIR_UP);
                            }
                            else {
                                for (j=0; j<2; j++) {
                                    mspac.update(j);
                                }
                            }
                            climbFrame++;
                            if (mspac.pixel.y == 91) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_MEET) {
                            if (meetFrame == 0) {
                                // set initial meet state for mspac
                                mspac.pixel.y++;
                                mspac.setDir(DIR_RIGHT);
                                mspac.commitPos();
                            }
                            if (meetFrame > 18) {
                                // pause player frames after a certain period
                                mspac.frames--;
                            }
                            if (meetFrame == 78) {
                                exit();
                            }
                            meetFrame++;
                        }
                        pac.frames++;
                        mspac.frames++;

                        // update ghosts
                        if (ghostMode == GHOST_RUN) {
                            for (j=0; j<2; j++) {
                                inky.update(j);
                                pinky.update(j);
                            }

                            // stop at middle
                            inky.pixel.x = Math.max(120, inky.pixel.x);
                            inky.commitPos();
                            pinky.pixel.x = Math.min(105, pinky.pixel.x);
                            pinky.commitPos();

                            if (pinky.pixel.x == 105) {
                                ghostMode++;
                            }
                        }
                        else if (ghostMode == GHOST_BUMP) {
                            if (inkyBounceFrame < inkyBounceFrameLen) {
                                inky.pixel.x += inkyBounceX[inkyBounceFrame];
                                inky.pixel.y += inkyBounceY[inkyBounceFrame];
                            }
                            if (pinkyBounceFrame < pinkyBounceFrameLen) {
                                pinky.pixel.x += pinkyBounceX[pinkyBounceFrame];
                                pinky.pixel.y += pinkyBounceY[pinkyBounceFrame];
                            }
                            inkyBounceFrame++;
                            pinkyBounceFrame++;
                        }
                        inky.frames++;
                        pinky.frames++;
                    },
                    draw: function() {
                        renderer.blitMap();
                        renderer.beginMapClip();
                        renderer.renderFunc(function(ctx) {
                            if (playerMode <= PLAYER_RAMP) {
                                drawPlayer(ctx,pac);
                            }
                            drawPlayer(ctx,mspac);
                        });
                        if (inkyBounceFrame < inkyBounceFrameLen) {
                            renderer.drawGhost(inky);
                        }
                        if (pinkyBounceFrame < pinkyBounceFrameLen) {
                            renderer.drawGhost(pinky);
                        }
                        if (playerMode == PLAYER_MEET) {
                            renderer.renderFunc(function(ctx) {
                                drawHeartSprite(ctx, 112, 73);
                            });
                        }
                        renderer.endMapClip();
                    },
                }; // returned object
            })(), // trigger at 300
        }, // triggers
    }); // returned object
})(); // mspacCutscene1

var cutscenes = [
    [pacmanCutscene1], // GAME_PACMAN
    [mspacmanCutscene1, mspacmanCutscene2], // GAME_MSPACMAN
    [cookieCutscene1, cookieCutscene2], // GAME_COOKIE
    [mspacmanCutscene1, mspacmanCutscene2], // GAME_OTTO
];

var isInCutScene = function() {
    var scenes = cutscenes[gameMode];
    var i,len = scenes.length;
    for (i=0; i<len; i++) {
        if (state == scenes[i]) {
            return true;
        }
    }
    return false;
};

// TODO: no cutscene after board 17 (last one after completing board 17)
var triggerCutsceneAtEndLevel = function() {
    if (gameMode == GAME_PACMAN) {
        if (level == 2) {
            playCutScene(pacmanCutscene1, readyNewState);
            return true;
        }
        /*
        else if (level == 5) {
            playCutScene(pacmanCutscene2, readyNewState);
            return true;
        }
        else if (level >= 9 && (level-9)%4 == 0) {
            playCutScene(pacmanCutscene3, readyNewState);
            return true;
        }
        */
    }
    else if (gameMode == GAME_MSPACMAN || gameMode == GAME_OTTO) {
        if (level == 2) {
            playCutScene(mspacmanCutscene1, readyNewState);
            return true;
        }
        else if (level == 5) {
            playCutScene(mspacmanCutscene2, readyNewState);
            return true;
        }
    }
    else if (gameMode == GAME_COOKIE) {
        if (level == 2) {
            playCutScene(cookieCutscene1, readyNewState);
            return true;
        }
        else if (level == 5) {
            playCutScene(cookieCutscene2, readyNewState);
            return true;
        }
    }

    // no cutscene triggered
    return false;
};

//@line 1 "src/maps.js"
//////////////////////////////////////////////////////////////////////////////////////
// Maps

// Definitions of playable maps

// current map
var map;

// actor starting states

blinky.startDirEnum = DIR_LEFT;
blinky.startPixel = {
    x: 14*tileSize-1,
    y: 14*tileSize+midTile.y
};
blinky.cornerTile = {
    x: 28-1-2,
    y: 0
};
blinky.startMode = GHOST_OUTSIDE;
blinky.arriveHomeMode = GHOST_LEAVING_HOME;

pinky.startDirEnum = DIR_DOWN;
pinky.startPixel = {
    x: 14*tileSize-1,
    y: 17*tileSize+midTile.y,
};
pinky.cornerTile = {
    x: 2,
    y: 0
};
pinky.startMode = GHOST_PACING_HOME;
pinky.arriveHomeMode = GHOST_PACING_HOME;

inky.startDirEnum = DIR_UP;
inky.startPixel = {
    x: 12*tileSize-1,
    y: 17*tileSize + midTile.y,
};
inky.cornerTile = {
    x: 28-1,
    y: 36 - 2,
};
inky.startMode = GHOST_PACING_HOME;
inky.arriveHomeMode = GHOST_PACING_HOME;

clyde.startDirEnum = DIR_UP;
clyde.startPixel = {
    x: 16*tileSize-1,
    y: 17*tileSize + midTile.y,
};
clyde.cornerTile = {
    x: 0,
    y: 36-2,
};
clyde.startMode = GHOST_PACING_HOME;
clyde.arriveHomeMode = GHOST_PACING_HOME;

pacman.startDirEnum = DIR_LEFT;
pacman.startPixel = {
    x: 14*tileSize-1,
    y: 26*tileSize + midTile.y,
};

// Learning Map
var mapLearn = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "__||||||||||||||||||||||||__" +
    "__|                      |__" +
    "__| ||||| |||||||| ||||| |__" +
    "__| ||||| |||||||| ||||| |__" +
    "__| ||    ||    ||    || |__" +
    "__| || || || || || || || |__" +
    "||| || || || || || || || |||" +
    "       ||    ||    ||       " +
    "||| ||||| |||||||| ||||| |||" +
    "__| ||||| |||||||| ||||| |__" +
    "__|    ||          ||    |__" +
    "__| || || |||||||| || || |__" +
    "__| || || |||||||| || || |__" +
    "__| ||    ||    ||    || |__" +
    "__| || || || || || || || |__" +
    "||| || || || || || || || |||" +
    "       ||    ||    ||       " +
    "||| |||||||| || |||||||| |||" +
    "__| |||||||| || |||||||| |__" +
    "__|                      |__" +
    "__||||||||||||||||||||||||__" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________"));

mapLearn.name = "Pac-Man";
mapLearn.wallStrokeColor = "#47b897"; // from Pac-Man Plus
mapLearn.wallFillColor = "#000";
mapLearn.pelletColor = "#ffb8ae";
mapLearn.shouldDrawMapOnly = true;

// Original Pac-Man map
var mapPacman = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "||||||||||||||||||||||||||||" +
    "|............||............|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|o||||.|||||.||.|||||.||||o|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|..........................|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|......||....||....||......|" +
    "||||||.||||| || |||||.||||||" +
    "_____|.||||| || |||||.|_____" +
    "_____|.||          ||.|_____" +
    "_____|.|| |||--||| ||.|_____" +
    "||||||.|| |______| ||.||||||" +
    "      .   |______|   .      " +
    "||||||.|| |______| ||.||||||" +
    "_____|.|| |||||||| ||.|_____" +
    "_____|.||          ||.|_____" +
    "_____|.|| |||||||| ||.|_____" +
    "||||||.|| |||||||| ||.||||||" +
    "|............||............|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|o..||.......  .......||..o|" +
    "|||.||.||.||||||||.||.||.|||" +
    "|||.||.||.||||||||.||.||.|||" +
    "|......||....||....||......|" +
    "|.||||||||||.||.||||||||||.|" +
    "|.||||||||||.||.||||||||||.|" +
    "|..........................|" +
    "||||||||||||||||||||||||||||" +
    "____________________________" +
    "____________________________"));

mapPacman.name = "Pac-Man";
//mapPacman.wallStrokeColor = "#47b897"; // from Pac-Man Plus
mapPacman.wallStrokeColor = "#2121ff"; // from original
mapPacman.wallFillColor = "#000";
mapPacman.pelletColor = "#ffb8ae";
mapPacman.constrainGhostTurns = function(tile,openTiles) {
    // prevent ghost from turning up at these tiles
    if ((tile.x == 12 || tile.x == 15) && (tile.y == 14 || tile.y == 26)) {
        openTiles[DIR_UP] = false;
    }
};

// Levels are grouped into "acts."
// In Ms. Pac-Man (and Cookie-Man) a map only changes after the end of an act.
// The levels within an act progress in difficulty.
// But the beginning of an act is generally easier than the end of the previous act to stave frustration.
// Completing an act results in a cutscene.
var getLevelAct = function(level) {
    // Act 1: (levels 1,2)
    // Act 2: (levels 3,4,5)
    // Act 3: (levels 6,7,8,9)
    // Act 4: (levels 10,11,12,13)
    // Act 5: (levels 14,15,16,17)
    // ...
    if (level <= 2) {
        return 1;
    }
    else if (level <= 5) {
        return 2;
    }
    else {
        return 3 + Math.floor((level - 6)/4);
    }
};

var getActColor = function(act) {
    if (gameMode == GAME_PACMAN) {
        return {
            wallFillColor: mapPacman.wallFillColor,
            wallStrokeColor: mapPacman.wallStrokeColor,
            pelletColor: mapPacman.pelletColor,
        };
    }
    else if (gameMode == GAME_MSPACMAN || gameMode == GAME_OTTO) {
        return getMsPacActColor(act);
    }
    else if (gameMode == GAME_COOKIE) {
        return getCookieActColor(act);
    }
};

var getActRange = function(act) {
    if (act == 1) {
        return [1,2];
    }
    else if (act == 2) {
        return [3,5];
    }
    else {
        var start = act*4-6;
        return [start, start+3];
    }
};

var getCookieActColor = function(act) {
    var colors = [
        "#359c9c", "#80d8fc", // turqoise
        "#c2b853", "#e6f1e7", // yellow
        "#86669c", "#f2c1db", // purple
        "#ed0a04", "#e8b4cd", // red
        "#2067c1", "#63e0b6", // blue
        "#c55994", "#fd61c3", // pink
        "#12bc76", "#b4e671", // green
        "#5036d9", "#618dd4", // violet
        "#939473", "#fdfdf4", // grey
    ];
    var i = ((act-1)*2) % colors.length;
    return {
        wallFillColor: colors[i],
        wallStrokeColor: colors[i+1],
        pelletColor: "#ffb8ae",
    };
};

var setNextCookieMap = function() {
    // cycle the colors
    var i;
    var act = getLevelAct(level);
    if (!map || level == 1 || act != getLevelAct(level-1)) {
        map = mapgen();
        var colors = getCookieActColor(act);
        map.wallFillColor = colors.wallFillColor;
        map.wallStrokeColor = colors.wallStrokeColor;
        map.pelletColor = colors.pelletColor;
    }
};

// Ms. Pac-Man map 1

var getMsPacActColor = function(act) {
    act -= 1;
    var mapIndex = (act <= 1) ? act : (act%2)+2;
    var maps = [mapMsPacman1, mapMsPacman2, mapMsPacman3, mapMsPacman4];
    var map = maps[mapIndex];
    if (act >= 4) {
        return [
            {
                wallFillColor: "#ffb8ff",
                wallStrokeColor: "#FFFF00",
                pelletColor: "#00ffff",
            },
            {
                wallFillColor: "#FFB8AE",
                wallStrokeColor: "#FF0000",
                pelletColor: "#dedeff",
            },
            {
                wallFillColor: "#de9751",
                wallStrokeColor: "#dedeff",
                pelletColor: "#ff0000",
            },
            {
                wallFillColor: "#2121ff",
                wallStrokeColor: "#ffb851",
                pelletColor: "#dedeff",
            },
        ][act%4];
    }
    else {
        return {
            wallFillColor: map.wallFillColor,
            wallStrokeColor: map.wallStrokeColor,
            pelletColor: map.pelletColor,
        };
    }
};

var setNextMsPacMap = function() {
    var maps = [mapMsPacman1, mapMsPacman2, mapMsPacman3, mapMsPacman4];

    // The third and fourth maps repeat indefinitely after the second map.
    // (i.e. act1=map1, act2=map2, act3=map3, act4=map4, act5=map3, act6=map4, ...)
    var act = getLevelAct(level)-1;
    var mapIndex = (act <= 1) ? act : (act%2)+2;
    map = maps[mapIndex];
    if (act >= 4) {
        var colors = getMsPacActColor(act+1);
        map.wallFillColor = colors.wallFillColor;
        map.wallStrokeColor = colors.wallStrokeColor;
        map.pelletColor = colors.pelletColor;
    }
};

var mapMsPacman1 = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "||||||||||||||||||||||||||||" +
    "|......||..........||......|" +
    "|o||||.||.||||||||.||.||||o|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|..........................|" +
    "|||.||.|||||.||.|||||.||.|||" +
    "__|.||.|||||.||.|||||.||.|__" +
    "|||.||.|||||.||.|||||.||.|||" +
    "   .||.......||.......||.   " +
    "|||.||||| |||||||| |||||.|||" +
    "__|.||||| |||||||| |||||.|__" +
    "__|.                    .|__" +
    "__|.||||| |||--||| |||||.|__" +
    "__|.||||| |______| |||||.|__" +
    "__|.||    |______|    ||.|__" +
    "__|.|| || |______| || ||.|__" +
    "|||.|| || |||||||| || ||.|||" +
    "   .   ||          ||   .   " +
    "|||.|||||||| || ||||||||.|||" +
    "__|.|||||||| || ||||||||.|__" +
    "__|.......   ||   .......|__" +
    "__|.|||||.||||||||.|||||.|__" +
    "|||.|||||.||||||||.|||||.|||" +
    "|............  ............|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|.||||.||....||....||.||||.|" +
    "|o||||.||.||||||||.||.||||o|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|..........................|" +
    "||||||||||||||||||||||||||||" +
    "____________________________" +
    "____________________________"));

mapMsPacman1.name = "Ms. Pac-Man 1";
mapMsPacman1.wallFillColor = "#FFB8AE";
mapMsPacman1.wallStrokeColor = "#FF0000";
mapMsPacman1.pelletColor = "#dedeff";
mapMsPacman1.fruitPaths = {
             "entrances": [
                 { "start": { "y": 164, "x": 228 }, "path": "<<<<vvv<<<<<<<<<^^^" }, 
                 { "start": { "y": 164, "x": -4 }, "path": ">>>>vvvvvv>>>>>>>>>>>>>>>^^^<<<^^^" }, 
                 { "start": { "y": 92, "x": -4 }, "path": ">>>>^^^^>>>vvvv>>>vvv>>>>>>>>>vvvvvv<<<" }, 
                 { "start": { "y": 92, "x": 228 }, "path": "<<<<vvvvvvvvv<<<^^^<<<vvv<<<" }
             ], 
             "exits": [
                 { "path": "<vvv>>>>>>>>>^^^>>>>" }, 
                 { "path": "<<<<vvv<<<<<<<<<^^^<<<<" }, 
                 { "path": "<<<<<<<^^^^^^<<<<<<^^^<<<<" }, 
                 { "path": "<vvv>>>>>>>>>^^^^^^^^^^^^>>>>" }
             ]
         };

// Ms. Pac-Man map 2

var mapMsPacman2 = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "||||||||||||||||||||||||||||" +
    "       ||..........||       " +
    "|||||| ||.||||||||.|| ||||||" +
    "|||||| ||.||||||||.|| ||||||" +
    "|o...........||...........o|" +
    "|.|||||||.||.||.||.|||||||.|" +
    "|.|||||||.||.||.||.|||||||.|" +
    "|.||......||.||.||......||.|" +
    "|.||.|||| ||....|| ||||.||.|" +
    "|.||.|||| |||||||| ||||.||.|" +
    "|......|| |||||||| ||......|" +
    "||||||.||          ||.||||||" +
    "||||||.|| |||--||| ||.||||||" +
    "|......|| |______| ||......|" +
    "|.||||.|| |______| ||.||||.|" +
    "|.||||.   |______|   .||||.|" +
    "|...||.|| |||||||| ||.||...|" +
    "|||.||.||          ||.||.|||" +
    "__|.||.|||| |||| ||||.||.|__" +
    "__|.||.|||| |||| ||||.||.|__" +
    "__|.........||||.........|__" +
    "__|.|||||||.||||.|||||||.|__" +
    "|||.|||||||.||||.|||||||.|||" +
    "   ....||...    ...||....   " +
    "|||.||.||.||||||||.||.||.|||" +
    "|||.||.||.||||||||.||.||.|||" +
    "|o..||.......||.......||..o|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|..........................|" +
    "||||||||||||||||||||||||||||" +
    "____________________________" +
    "____________________________"));

mapMsPacman2.name = "Ms. Pac-Man 2";
mapMsPacman2.wallFillColor = "#47b8ff";
mapMsPacman2.wallStrokeColor = "#dedeff";
mapMsPacman2.pelletColor = "#ffff00";
mapMsPacman2.fruitPaths = {
             "entrances": [
                 { "start": { "y": 212, "x": 228 }, "path": "<<<<^^^<<<<<<<<^^^<" }, 
                 { "start": { "y": 212, "x": -4 }, "path": ">>>>^^^>>>>>>>>vvv>>>>>^^^^^^<" }, 
                 { "start": { "y": 36, "x": -4 }, "path": ">>>>>>>vvv>>>vvvvvvv>>>>>>>>>vvvvvv<<<" }, 
                 { "start": { "y": 36, "x": 228 }, "path": "<<<<<<<vvv<<<vvvvvvvvvvvvv<<<" }
             ], 
             "exits": [
                 { "path": "vvv>>>>>>>>vvv>>>>" }, 
                 { "path": "vvvvvv<<<<<^^^<<<<<<<<vvv<<<<" }, 
                 { "path": "<<<<<<<^^^^^^^^^^^^^<<<^^^<<<<<<<" }, 
                 { "path": "vvv>>>>>^^^^^^^^^^>>>>>^^^^^^<<<<<^^^>>>>>>>" }
             ]
         };

// Ms. Pac-Man map 3

var mapMsPacman3 = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "||||||||||||||||||||||||||||" +
    "|.........||....||.........|" +
    "|.|||||||.||.||.||.|||||||.|" +
    "|o|||||||.||.||.||.|||||||o|" +
    "|.||.........||.........||.|" +
    "|.||.||.||||.||.||||.||.||.|" +
    "|....||.||||.||.||||.||....|" +
    "||||.||.||||.||.||||.||.||||" +
    "||||.||..............||.||||" +
    " ....|||| |||||||| ||||.... " +
    "|.|| |||| |||||||| |||| ||.|" +
    "|.||                    ||.|" +
    "|.|||| || |||--||| || ||||.|" +
    "|.|||| || |______| || ||||.|" +
    "|.     || |______| ||     .|" +
    "|.|| |||| |______| |||| ||.|" +
    "|.|| |||| |||||||| |||| ||.|" +
    "|.||                    ||.|" +
    "|.|||| ||||| || ||||| ||||.|" +
    "|.|||| ||||| || ||||| ||||.|" +
    "|......||....||....||......|" +
    "|||.||.||.||||||||.||.||.|||" +
    "|||.||.||.||||||||.||.||.|||" +
    "|o..||.......  .......||..o|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|......||....||....||......|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|......||..........||......|" +
    "||||||||||||||||||||||||||||" +
    "____________________________" +
    "____________________________"));

mapMsPacman3.name = "Ms. Pac-Man 3";
mapMsPacman3.wallFillColor = "#de9751";
mapMsPacman3.wallStrokeColor = "#dedeff";
mapMsPacman3.pelletColor = "#ff0000";
mapMsPacman3.fruitPaths = {
             "entrances": [
                 { "start": { "y": 100, "x": 228 }, "path": "<<<<<vv<<<<<vvvvvv<<<" }, 
                 { "start": { "y": 100, "x": -4 }, "path": ">>>>>vv>>>>>>>>>>>>>>vvvvvv<<<" }, 
                 { "start": { "y": 100, "x": -4 }, "path": ">>>>>vv>>>>>>>>>>>>>>vvvvvv<<<" }, 
                 { "start": { "y": 100, "x": 228 }, "path": "<<vvvvv<<<vvv<<<<<<<<" }
             ], 
             "exits": [
                 { "path": "<vvv>>>vvv>>>^^^>>>>>^^^^^^^^^^^>>" }, 
                 { "path": "<<<<vvv<<<vvv<<<^^^<<<<<^^^^^^^^^^^<<" }, 
                 { "path": "<<<<vvv<<<vvv<<<^^^<<<<<^^^^^^^^^^^<<" }, 
                 { "path": "<vvv>>>vvv>>>^^^^^^<<<^^^^^^>>>>>^^>>>>>" }
             ]
         };
mapMsPacman3.constrainGhostTurns = function(tile,openTiles,dirEnum) {
    // prevent ghost from turning down when exiting tunnels
    if (tile.y == 12) {
        if ((tile.x == 1 && dirEnum == DIR_RIGHT) || (tile.x == 26 && dirEnum == DIR_LEFT)) {
            openTiles[DIR_DOWN] = false;
        }
    }
};

// Ms. Pac-Man map 4

var mapMsPacman4 = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "||||||||||||||||||||||||||||" +
    "|..........................|" +
    "|.||.||||.||||||||.||||.||.|" +
    "|o||.||||.||||||||.||||.||o|" +
    "|.||.||||.||....||.||||.||.|" +
    "|.||......||.||.||......||.|" +
    "|.||||.||.||.||.||.||.||||.|" +
    "|.||||.||.||.||.||.||.||||.|" +
    "|......||....||....||......|" +
    "|||.|||||||| || ||||||||.|||" +
    "__|.|||||||| || ||||||||.|__" +
    "__|....||          ||....|__" +
    "||| ||.|| |||--||| ||.|| |||" +
    "    ||.|| |______| ||.||    " +
    "||||||.   |______|   .||||||" +
    "||||||.|| |______| ||.||||||" +
    "    ||.|| |||||||| ||.||    " +
    "||| ||.||          ||.|| |||" +
    "__|....||||| || |||||....|__" +
    "__|.||.||||| || |||||.||.|__" +
    "__|.||....   ||   ....||.|__" +
    "__|.|||||.|| || ||.|||||.|__" +
    "|||.|||||.|| || ||.|||||.|||" +
    "|.........||    ||.........|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|.||...||..........||...||.|" +
    "|o||.|||||||.||.|||||||.||o|" +
    "|.||.|||||||.||.|||||||.||.|" +
    "|............||............|" +
    "||||||||||||||||||||||||||||" +
    "____________________________" +
    "____________________________"));

mapMsPacman4.name = "Ms. Pac-Man 4";
mapMsPacman4.wallFillColor = "#2121ff";
mapMsPacman4.wallStrokeColor = "#ffb851";
mapMsPacman4.pelletColor = "#dedeff";
mapMsPacman4.fruitPaths = {
             "entrances": [
                 { "start": { "y": 156, "x": 228 }, "path": "<<<<vv<<<vv<<<<<<^^^" }, 
                 { "start": { "y": 156, "x": -4 }, "path": ">>>>vv>>>vv>>>>>>vvv>>>^^^^^^" }, 
                 { "start": { "y": 132, "x": -4 }, "path": ">>>>^^^^^>>>^^^>>>vvv>>>vvv>>>>>>vvvvvv<<<" }, 
                 { "start": { "y": 132, "x": 228 }, "path": "<<<<^^<<<vvv<<<vvv<<<" }
             ], 
             "exits": [
                 { "path": "<vvv>>>>>>^^>>>^^>>>>" }, 
                 { "path": "<<<<vvv<<<<<<^^<<<^^<<<<" }, 
                 { "path": "<<<<<<<^^^<<<^^^<<<vv<<<<" }, 
                 { "path": "<vvv>>>>>>^^^^^^^^^>>>vv>>>>" }
             ]
         };
//@line 1 "src/vcr.js"
//////////////////////////////////////////////////////////////////////////////////////
// VCR
// This coordinates the recording, rewinding, and replaying of the game state.
// Inspired by Braid.

var VCR_NONE = -1;
var VCR_RECORD = 0;
var VCR_REWIND = 1;
var VCR_FORWARD = 2;
var VCR_PAUSE = 3;

var vcr = (function() {

    var mode;

    // controls whether to increment the frame before recording.
    var initialized;

    // current time
    var time;

    // tracking speed
    var speedIndex;
    var speeds = [-8,-4,-2,-1,0,1,2,4,8];
    var speedCount = speeds.length;
    var speedColors = [
        "rgba(255,255,0,0.25)",
        "rgba(255,255,0,0.20)",
        "rgba(255,255,0,0.15)",
        "rgba(255,255,0,0.10)",
        "rgba(0,0,0,0)",
        "rgba(0,0,255,0.10)",
        "rgba(0,0,255,0.15)",
        "rgba(0,0,255,0.20)",
        "rgba(0,0,255,0.25)",
    ];

    // This is the number of "footprint" frames to display along the seek direction around a player
    // to create the rewind/forward blurring.  
    // This is also inversely used to determine the number of footprint frames to display OPPOSITE the seek direction
    // around a player.
    //
    // For example: 
    //   nextFrames = speedPrints[speedIndex];
    //   prevFrames = speedPrints[speedCount-1-speedIndex];
    var speedPrints = [
        18,// -8x
        13,// -4x
        8, // -2x
        3, // -1x
        3, //  0x
        10,//  1x
        15,//  2x
        20,//  4x
        25,//  8x
    ];

    // The distance between each footprint used in the rewind/forward blurring.
    // Step size grows when seeking speed increases to show emphasize time dilation.
    var speedPrintStep = [
        6,  // -8x
        5,  // -4x
        4,  // -2x
        3,  // -1x
        3,  //  0x
        3,  //  1x
        4,  //  2x
        5,  //  4x
        6,  //  8x
    ];

    // current frame associated with current time
    // (frame == time % maxFrames)
    var frame;

    // maximum number of frames to record
    var maxFrames = 15*60;

    // rolling bounds of the recorded frames
    var startFrame; // can't rewind past this
    var stopFrame; // can't replay past this

    // reset the VCR
    var reset = function() {
        time = 0;
        frame = 0;
        startFrame = 0;
        stopFrame = 0;
        states = {};
        startRecording();
    };

    // load the state of the current time
    var load = function() {
        var i;
        for (i=0; i<5; i++) {
            actors[i].load(frame);
        }
        elroyTimer.load(frame);
        energizer.load(frame);
        fruit.load(frame);
        powerups.load(frame);
        ghostCommander.load(frame);
        ghostReleaser.load(frame);
        map.load(frame,time);
        loadGame(frame);
        if (state == deadState) {
            deadState.load(frame);
        }
        else if (state == finishState) {
            finishState.load(frame);
        }
    };

    // save the state of the current time
    var save = function() {
        var i;
        for (i=0; i<5; i++) {
            actors[i].save(frame);
        }
        elroyTimer.save(frame);
        energizer.save(frame);
        fruit.save(frame);
        powerups.save(frame);
        ghostCommander.save(frame);
        ghostReleaser.save(frame);
        map.save(frame);
        saveGame(frame);
        if (state == deadState) {
            deadState.save(frame);
        }
        else if (state == finishState) {
            finishState.save(frame);
        }
    };

    // erase any states after the current time
    // (only necessary for saves that do interpolation)
    var eraseFuture = function() {
        map.eraseFuture(time);
        stopFrame = frame;
    };

    // increment or decrement the time
    var addTime = function(dt) {
        time += dt;
        frame = (frame+dt)%maxFrames;
        if (frame < 0) {
            frame += maxFrames;
        }
    };

    // measures the modular distance if increasing from x0 to x1 on our circular frame buffer.
    var getForwardDist = function(x0,x1) {
        return (x0 <= x1) ? x1-x0 : x1+maxFrames-x0;
    };

    // caps the time increment or decrement to prevent going over our rolling bounds.
    var capSeekTime = function(dt) {
        if (!initialized || dt == 0) {
            return 0;
        }
        var maxForward = getForwardDist(frame,stopFrame);
        var maxReverse = getForwardDist(startFrame,frame);
        return (dt > 0) ? Math.min(maxForward,dt) : Math.max(-maxReverse,dt);
    };

    var init = function() {
        mode = VCR_NONE;
    };

    // seek to the state at the given relative time difference.
    var seek = function(dt) {
        if (dt == undefined) {
            dt = speeds[speedIndex];
        }
        if (initialized) {
            addTime(capSeekTime(dt));
            load();
        }
    };

    // record a new state.
    var record = function() {
        if (initialized) {
            addTime(1);
            if (frame == startFrame) {
                startFrame = (startFrame+1)%maxFrames;
            }
            stopFrame = frame;
        }
        else {
            initialized = true;
        }
        save();
    };

    var startRecording = function() {
        mode = VCR_RECORD;
        initialized = false;
        eraseFuture();
        seekUpBtn.disable();
        seekDownBtn.disable();
        seekToggleBtn.setIcon(function(ctx,x,y,frame) {
            drawRewindSymbol(ctx,x,y,"#FFF");
        });
        seekToggleBtn.setText();
    };

    var refreshSeekDisplay = function() {
        seekToggleBtn.setText(speeds[speedIndex]+"x");
    };

    var startSeeking = function() {
        speedIndex = 3;
        updateMode();
        seekUpBtn.enable();
        seekDownBtn.enable();
        seekToggleBtn.setIcon(undefined);
        refreshSeekDisplay();
    };

    var nextSpeed = function(di) {
        if (speeds[speedIndex+di] != undefined) {
            speedIndex = speedIndex+di;
        }
        updateMode();
        refreshSeekDisplay();
    };

    var x,y,w,h;
    var pad = 5;
    x = mapWidth+1;
    h = 25;
    w = 25;
    y = mapHeight/2-h/2;
    var seekUpBtn = new Button(x,y-h-pad,w,h,
        function() {
            nextSpeed(1);
        });
    seekUpBtn.setIcon(function(ctx,x,y,frame) {
        drawUpSymbol(ctx,x,y,"#FFF");
    });
    var seekDownBtn = new Button(x,y+h+pad,w,h,
        function() {
            nextSpeed(-1);
        });
    seekDownBtn.setIcon(function(ctx,x,y,frame) {
        drawDownSymbol(ctx,x,y,"#FFF");
    });
    var seekToggleBtn = new ToggleButton(x,y,w,h,
        function() {
            return mode != VCR_RECORD;
        },
        function(on) {
            on ? startSeeking() : startRecording();
        });
    seekToggleBtn.setIcon(function(ctx,x,y,frame) {
        drawRewindSymbol(ctx,x,y,"#FFF");
    });
    seekToggleBtn.setFont((tileSize-1)+"px ArcadeR", "#FFF");
    var slowBtn = new ToggleButton(-w-pad-1,y,w,h,
        function() {
            return executive.getFramePeriod() == 1000/15;
        },
        function(on) {
            executive.setUpdatesPerSecond(on ? 15 : 60);
        });
    slowBtn.setIcon(function(ctx,x,y) {
        atlas.drawSnail(ctx,x,y,1);
    });

    var onFramePeriodChange = function() {
        if (slowBtn.isOn()) {
            slowBtn.setIcon(function(ctx,x,y) {
                atlas.drawSnail(ctx,x,y,0);
            });
        }
        else {
            slowBtn.setIcon(function(ctx,x,y) {
                atlas.drawSnail(ctx,x,y,1);
            });
        }
    };

    var onHudEnable = function() {
        if (practiceMode) {
            if (mode == VCR_NONE || mode == VCR_RECORD) {
                seekUpBtn.disable();
                seekDownBtn.disable();
            }
            else {
                seekUpBtn.enable();
                seekDownBtn.enable();
            }
            seekToggleBtn.enable();
            slowBtn.enable();
        }
    };

    var onHudDisable = function() {
        if (practiceMode) {
            seekUpBtn.disable();
            seekDownBtn.disable();
            seekToggleBtn.disable();
            slowBtn.disable();
        }
    };

    var isValidState = function() {
        return (
            !inGameMenu.isOpen() && (
            state == playState ||
            state == finishState ||
            state == deadState));
    };

    var draw = function(ctx) {
        if (practiceMode) {
            if (isValidState() && vcr.getMode() != VCR_RECORD) {
                // change the hue to reflect speed
                renderer.setOverlayColor(speedColors[speedIndex]);
            }

            if (seekUpBtn.isEnabled) {
                seekUpBtn.draw(ctx);
            }
            if (seekDownBtn.isEnabled) {
                seekDownBtn.draw(ctx);
            }
            if (seekToggleBtn.isEnabled) {
                seekToggleBtn.draw(ctx);
            }
            if (slowBtn.isEnabled) {
                slowBtn.draw(ctx);
            }
        }
    };

    var updateMode = function() {
        var speed = speeds[speedIndex];
        if (speed == 0) {
            mode = VCR_PAUSE;
        }
        else if (speed < 0) {
            mode = VCR_REWIND;
        }
        else if (speed > 0) {
            mode = VCR_FORWARD;
        }
    };

    return {
        init: init,
        reset: reset,
        seek: seek,
        record: record,
        draw: draw,
        onFramePeriodChange: onFramePeriodChange,
        onHudEnable: onHudEnable,
        onHudDisable: onHudDisable,
        eraseFuture: eraseFuture,
        startRecording: startRecording,
        startSeeking: startSeeking,
        nextSpeed: nextSpeed,
        isSeeking: function() {
            return (
                mode == VCR_REWIND ||
                mode == VCR_FORWARD ||
                mode == VCR_PAUSE);
        },
        getTime: function() { return time; },
        getFrame: function() { return frame; },
        getMode: function() { return mode; },

        drawHistory: function(ctx,callback) {
            if (!this.isSeeking()) {
                return;
            }

            // determine start frame
            var maxReverse = getForwardDist(startFrame,frame);
            var start = (frame - Math.min(maxReverse,speedPrints[speedIndex])) % maxFrames;
            if (start < 0) {
                start += maxFrames;
            }

            // determine end frame
            var maxForward = getForwardDist(frame,stopFrame);
            var end = (frame + Math.min(maxForward,speedPrints[speedCount-1-speedIndex])) % maxFrames;

            var backupAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.2;
            
            var t = start;
            var step = speedPrintStep[speedIndex];
            if (start > end) {
                for (; t<maxFrames; t+=step) {
                    callback(t);
                }
                t %= maxFrames;
            }
            for (; t<end; t+=step) {
                callback(t);
            }

            ctx.globalAlpha = backupAlpha;
        },
    };
})();
//@line 1 "src/main.js"
//////////////////////////////////////////////////////////////////////////////////////
// Entry Point

window.addEventListener("load", function() {
  // wait for the custom sprite images before starting
  customSprites.load(function() {
    loadHighScores();
    legend.init(); // before the renderer, so the maze is sized to the space the legend leaves
    initRenderer();
    atlas.create();
    initSwipe();
	var anchor = window.location.hash.substring(1);
	if (anchor == "learn") {
		switchState(learnState);
	}
	else if (anchor == "cheat_pac" || anchor == "cheat_mspac") {
		gameMode = (anchor == "cheat_pac") ? GAME_PACMAN : GAME_MSPACMAN;
		practiceMode = true;
        switchState(newGameState);
		for (var i=0; i<4; i++) {
			ghosts[i].isDrawTarget = true;
			ghosts[i].isDrawPath = true;
		}
	}
	else {
		switchState(homeState);
	}
    executive.init();
  });
});
})();
