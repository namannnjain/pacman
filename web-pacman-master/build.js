const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const publicDirectory = path.join(root, "public");
const sourceFiles = [
  "inherit.js",
  "sound.js",
  "random.js",
  "game.js",
  "direction.js",
  "Map.js",
  "colors.js",
  "mapgen.js",
  "atlas.js",
  "renderers.js",
  "hud.js",
  "galagaStars.js",
  "Button.js",
  "Menu.js",
  "inGameMenu.js",
  "customSprites.js",
  "sprites.js",
  "Actor.js",
  "Ghost.js",
  "Player.js",
  "actors.js",
  "targets.js",
  "ghostCommander.js",
  "ghostReleaser.js",
  "elroyTimer.js",
  "energizer.js",
  "fruit.js",
  "powerups.js",
  "legend.js",
  "executive.js",
  "states.js",
  "input.js",
  "cutscenes.js",
  "maps.js",
  "vcr.js",
  "main.js",
];

const header = `// Copyright 2012 Shaun Williams
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License Version 3 as
// published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

(function () {
`;

const gameScript = sourceFiles
  .map((file) => {
    const sourcePath = path.join(root, "src", file);
    return `\n//#line 1 "src/${file}"\n${fs.readFileSync(sourcePath, "utf8")}`;
  })
  .join("");

fs.mkdirSync(publicDirectory, { recursive: true });

const outputFiles = [
  ["index.html", "index.html"],
  ["font", "font"],
  ["sounds", "sounds"],
  ["icon", "icon"],
];

for (const [source, destination] of outputFiles) {
  const sourcePath = path.join(root, source);
  const destinationPath = path.join(publicDirectory, destination);
  fs.cpSync(sourcePath, destinationPath, { recursive: true });
}

for (const outputPath of [
  path.join(root, "pacman.js"),
  path.join(publicDirectory, "pacman.js"),
]) {
  fs.writeFileSync(outputPath, `${header}${gameScript}\n})();\n`);
}

console.log("Built static game into public/");
