// A Vite plugin, not a game module. See "なぜ concatenation なのか" in
// ARCHITECTURE.md: the ~500 functions in src/legacy/parts/ still share
// roughly 90 top-level mutable variables (scene, camera, renderer, player,
// walls, doors, enemies, currentWorldKey, ...) that are reassigned directly
// from many different parts - not just mutated through a property, which
// ES modules would allow across files, but rebound outright (e.g.
// `currentWorldKey = 'tavern'`), which they don't. Splitting the source
// into ordered files while keeping them concatenated into one shared scope
// at build time sidesteps that without requiring every one of those
// variables to be threaded through a shared object first. Each part is
// still an ordinary chunk of the same script, not an independent module -
// see ARCHITECTURE.md before assuming a part can safely import/export on
// its own.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTS_DIR = path.join(__dirname, 'parts');
const VIRTUAL_SPECIFIER = 'virtual:legacy-core';
// Not the usual '\0'-prefixed opaque id: giving this a path that actually
// sits inside src/legacy/ (even though the file itself doesn't exist) lets
// Vite/Rollup resolve the parts' own relative imports (../core/state.js
// etc.) exactly as if this were legacy-core.js itself.
const RESOLVED_ID = path.join(__dirname, '__legacy-core-concatenated.js');

const HEADER = `// Generated at build/dev time by src/legacy/concat-plugin.js, by
// concatenating src/legacy/parts/*.js (in filename order) into one shared
// scope. Do not edit this output directly - edit the files in parts/.
import * as THREE from 'three';
import { state } from '../core/state.js';
import {
  makePlankTexture, makeMasonryTexture, makeCobbleTexture, makeWallpaperTexture,
  makeStoneTileTexture, makeGrassTexture, applySurfaceDetail, makeNoiseTexture, makeTileTexture,
  getMaxAnisotropy, makeLeatherTexture, makeMetalTexture, applyBump, makeFaceTexture,
} from '../textures/textures.js';
import { initAudio, resumeAudio, setSfxVolume, sfx, setBgmVolume, setBgmIntensity, playBgm, stopBgm } from '../audio/audio.js';
import { groupsFromGraph, allCombos, comboKey, comboKeyFromPath, comboProgress, suggestUnseenCombo } from '../core/route-combos.js';
import { applyIncomingDamage, applyOutgoingDamage } from '../core/damage-math.js';
import { pickWeighted, equipmentStatBonus, equipmentSellPrice } from '../core/loot-math.js';
import { timeLimitForStars } from '../core/scenario-timer.js';
import { makeTrapezoidBox, makeWedge, makePlate, makePrism } from '../render/lowpoly-primitives.js';

`;

function partFiles() {
  return fs.readdirSync(PARTS_DIR).filter(f => f.endsWith('.js')).sort();
}

function concatenatedSource() {
  return HEADER + partFiles().map(f => fs.readFileSync(path.join(PARTS_DIR, f), 'utf8')).join('\n');
}

export default function legacyConcat() {
  return {
    name: 'legacy-concat',
    resolveId(id) {
      if (id === VIRTUAL_SPECIFIER) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      // rebuild (and, in dev, hot-reload) whenever any part file changes
      for (const f of partFiles()) this.addWatchFile(path.join(PARTS_DIR, f));
      return concatenatedSource();
    },
  };
}
