/* 試験の補助: 道(新)の入る時の値(02-world-common.js の WORLD_MOOD.road2)を、ファイルの文から読む(legacy は import できない) */
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../src/legacy/parts/02-world-common.js', import.meta.url), 'utf8');
const m = src.match(/road2:\s*\{(sky:[^}]*)\}/);
const obj = {};
m[1].split(',').forEach(kv => { const [k, v] = kv.split(':').map(t => t.trim()); if (k) obj[k] = Number(v); });
export const WORLD_MOOD_ROAD2_FOR_TEST = Object.freeze(obj);
