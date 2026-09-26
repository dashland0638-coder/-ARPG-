// src/render/player-palette.js の単体テスト(CHARACTER-VIS-001 T-5)。
// プレイヤー専用の配色表・質感表の形と、CLASSES(支援AI・VFX・足元リングも
// 読む色)を変えていないことを確認する。色の良し悪しは Human の目視(V-1)で決める。
// Run with `npm run test:unit`(node --test)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PLAYER_ROLES, PLAYER_FINISH, WEAPON_FINISH, PLAYER_PALETTE, paletteKeyFor, resolvePalette,
} from '../../src/render/player-palette.js';

const readPart = name => fs.readFileSync(
  fileURLToPath(new URL('../../src/legacy/parts/' + name, import.meta.url)), 'utf8');

const ALL_KEYS = ['warrior', 'mage', 'archer', 'rogue', 'wanderer',
  'battleKnight', 'archmage', 'hawkEye', 'berserker'];

test('配色表: 9キャラクターすべてで、全 role が有効な色で埋まる', ()=>{
  assert.deepEqual(PLAYER_ROLES, ['main', 'sub', 'accent', 'layer', 'hat', 'trim', 'boot']);
  for(const key of ALL_KEYS){
    const row = resolvePalette(key);
    assert.ok(row, `${key} の行がある`);
    assert.equal(row.inherit, undefined, `${key}: inherit は展開済み`);
    for(const role of PLAYER_ROLES){
      const v = row[role];
      assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffff, `${key}.${role} が色(${v})`);
    }
  }
  assert.equal(resolvePalette('nope'), null);
});

test('配色表: 基礎4職は Human 承認の色(HDR-T5 配色体系 / P-D5 / P-D6)', ()=>{
  const w = resolvePalette('warrior');
  assert.equal(w.main, 0x263a55);
  const m = resolvePalette('mage');
  assert.equal(m.main, 0x8fb9d6);
  assert.equal(m.hat, 0x6f8ca3);
  const a = resolvePalette('archer');
  assert.deepEqual([a.main, a.sub, a.accent, a.trim], [0x315c50, 0x617a82, 0xb99652, 0xe6e4dd]);
  const r = resolvePalette('rogue');
  // パーカーは V-1 第1段階の Human 指定(#5B4B78 → #526A78)
  assert.deepEqual([r.main, r.accent, r.hat], [0x304d45, 0x526a78, 0xd2a83e]);
});

test('配色表: 上位職は基礎職を継承し、バーサーカーだけ独立(HDR-T5-8)', ()=>{
  assert.equal(PLAYER_PALETTE.battleKnight.inherit, 'warrior');
  assert.equal(PLAYER_PALETTE.archmage.inherit, 'mage');
  assert.equal(PLAYER_PALETTE.hawkEye.inherit, 'archer');
  assert.equal(PLAYER_PALETTE.berserker.inherit, undefined);
  // 継承した role は基礎職の値
  assert.equal(resolvePalette('battleKnight').main, resolvePalette('warrior').main);
  // バーサーカーのメインは盗賊と違う
  assert.notEqual(resolvePalette('berserker').main, resolvePalette('rogue').main);
});

test('paletteKeyFor: 影の旅人 / 転身中 / 基礎職', ()=>{
  assert.equal(paletteKeyFor('warrior', null, 'wanderer'), 'wanderer');
  assert.equal(paletteKeyFor('warrior', 'battleKnight', 'wanderer'), 'wanderer');
  assert.equal(paletteKeyFor('mage', 'archmage', undefined), 'archmage');
  assert.equal(paletteKeyFor('rogue', null, undefined), 'rogue');
  assert.equal(paletteKeyFor('rogue', 'unknownJob', undefined), 'rogue');
  assert.equal(paletteKeyFor('unknown', null, undefined), 'warrior');
});

test('質感表: HDR-T5-9 の候補範囲 / 投げナイフは P-D9', ()=>{
  const inRange = (v, lo, hi, what) => assert.ok(v >= lo && v <= hi, `${what} = ${v}(${lo}〜${hi})`);
  for(const k of ['cloth', 'accent', 'layer', 'hat']){
    inRange(PLAYER_FINISH[k].roughness, 0.8, 0.9, `${k}.roughness`);
    assert.equal(PLAYER_FINISH[k].metalness, 0, `${k}.metalness`);
  }
  inRange(PLAYER_FINISH.trim.roughness, 0.55, 0.7, 'trim.roughness');
  inRange(PLAYER_FINISH.trim.metalness, 0.2, 0.3, 'trim.metalness');
  inRange(PLAYER_FINISH.boot.metalness, 0.05, 0.1, 'boot.metalness');
  assert.deepEqual(PLAYER_FINISH.knife, { roughness: 0.75, metalness: 0.45 });
});

test('CLASSES の color / trim と上位職の trim / capeColor は T-5 前の値のまま(HDR-T5-2)', ()=>{
  const src = readPart('01-character-creation.js');
  for(const line of [
    'color:0x35455e, trim:0xc99c47',   // 剣士
    'color:0x3d5350, trim:0x60496c',   // 盗賊
    'color:0x6cc4e8, trim:0x8260ab',   // 魔法使い
    'color:0x3f6080, trim:0x78512d',   // 弓師
    'color:0x1a1622, trim:0x8a5ad6',   // 影の旅人
    'trim:0xffcf6a, capeColor:0x6a1a1a',
    'trim:0xff5a3a, capeColor:0x3a0a10',
    'trim:0x82c6d4, capeColor:0x1c2440',
    'trim:0x6adfc0, capeColor:0x0a3a30',
  ]){
    assert.ok(src.includes(line), `01 に ${line} が残っている`);
  }
});

test('buildPlayer の服の色は配色表から取る(CLASSES の color / trim を直接使わない)', ()=>{
  const src = readPart('06-player-enemy.js');
  assert.ok(!src.includes('makeLeatherTexture(hexStr(classDef.color)'), 'clothMat が classDef.color を使わない');
  assert.ok(!src.includes('makeMetalTexture(hexStr(classDef.trim)'), 'trimMat が classDef.trim を使わない');
  assert.ok(!/const clothAcc = new THREE\.MeshStandardMaterial\(\{color:classDef\.trim/.test(src), 'clothAcc が classDef.trim を使わない');
  assert.match(src, /applyPlayerPalette\(playerMixerParts, palKey\)/);
  // 肌色は T-4 最終確定値のまま(P-D0)
  assert.ok(src.includes('const SKIN_COLOR = { warrior:0xffe6d2, mage:0xffeee5, rogue:0xffe7d4, archer:0xe8bd98, wanderer:0xe8dce0 };'));
});

// 相対輝度(sRGB → 線形、WCAG と同じ式)
function luminance(hex){
  const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * ch((hex >> 16) & 255) + 0.7152 * ch((hex >> 8) & 255) + 0.0722 * ch(hex & 255);
}

test('影の旅人: 衣服の紫は影 VFX の紫と別の値 / 全身黒でない(HDR-T5-6、P-D8)', ()=>{
  const w = resolvePalette('wanderer');
  const SHADOW_VFX = 0x8a5ad6;   // CLASSES.wanderer.trim(影 VFX・足元リング)
  for(const role of ['main', 'sub', 'accent', 'layer', 'trim']){
    assert.notEqual(w[role], SHADOW_VFX, `wanderer.${role} が影 VFX の紫と同じでない`);
  }
  // 全身黒の検出: T-4 の黒ずくめ(0x1a1622)より明るいメイン、明るい白系レイヤーがある
  assert.ok(luminance(w.main) > luminance(0x1a1622) * 2, `main が黒ずくめより明るい(${luminance(w.main).toFixed(3)})`);
  assert.ok(luminance(w.layer) > 0.5, 'Off White のレイヤーがある');
  // マフラーは V-1 第2段階の Human 指定(紫 → シルバーブルー)
  assert.deepEqual([w.main, w.sub, w.accent, w.layer], [0x30323a, 0x403454, 0xa3b1bf, 0xd8d4d0]);
});

test('上位職: 白系レイヤーと専用色(P-D7、HDR-T5 配色体系)', ()=>{
  const k = resolvePalette('battleKnight');
  assert.equal(k.layer, 0x9aa5b1);
  assert.equal(k.steel, 0xc8cdd2);
  const h = resolvePalette('hawkEye');
  assert.equal(h.layer, 0xe5e1d9);
  assert.equal(h.main, 0x315c50);
  assert.equal(h.cape, 0x24463e);
  const a = resolvePalette('archmage');
  assert.deepEqual([a.main, a.sub, a.layer], [0x334a72, 0x514b86, 0xe4e6e3]);
  const b = resolvePalette('berserker');
  assert.deepEqual([b.main, b.accent, b.layer, b.hat], [0x45484d, 0x8a3438, 0xe5e1d9, 0x59483d]);
});

test('上位職は基本 Material を直接書き換えない(HDR-T5-10)', ()=>{
  const src = readPart('06-player-enemy.js');
  const start = src.indexOf('function applyJobPromotionVisual(');
  const end = src.indexOf('\n  }\n', start);
  assert.ok(start > 0 && end > start);
  const body = src.slice(start, end);
  assert.ok(!/const matchRobeLook/.test(body), 'matchRobeLook が無い');
  assert.ok(!/const HAWKEYE_BODY/.test(body), 'HAWKEYE_BODY が無い');
  assert.ok(!/P\.(clothMat|clothMatFlat|trimMat|trimMatFlat|beltMat)\.map\s*=/.test(body), '基本 Material の map を書き換えない');
  assert.ok(!/P\.clothAcc\.color\.set/.test(body), 'clothAcc の色を書き換えない');
  assert.ok(!/P\.rogueHood\.material\.color\.set/.test(body), '盗賊の帽子の色を書き換えない');
  assert.match(body, /applyPlayerPalette\(P, upPalKey\)/);
  // 解除でも基礎職の行へ全 role を戻す
  const clear = src.slice(src.indexOf('function clearJobPromotionVisual('), start);
  assert.match(clear, /applyPlayerPalette\(P, P\.basePaletteKey\)/);
});

test('武器の質感表 WEAPON_FINISH: T-7 の初期候補の範囲(P-D3 / S-2)', ()=>{
  const inRange = (v, lo, hi, what) => assert.ok(v >= lo && v <= hi, `${what} = ${v}(${lo}〜${hi})`);
  assert.deepEqual(Object.keys(WEAPON_FINISH).sort(), ['darkSteel', 'gem', 'steel', 'trim', 'wood']);
  inRange(WEAPON_FINISH.steel.roughness, 0.45, 0.55, 'steel.roughness');
  inRange(WEAPON_FINISH.steel.metalness, 0.45, 0.55, 'steel.metalness');
  assert.deepEqual(WEAPON_FINISH.darkSteel, { roughness: 0.55, metalness: 0.45 });
  assert.deepEqual(WEAPON_FINISH.trim, { roughness: 0.55, metalness: 0.35 });
  inRange(WEAPON_FINISH.gem.emissiveIntensity, 0.2, 0.4, 'gem.emissiveIntensity');
  // 服の表とは別オブジェクト(責務を混ぜない)
  assert.notEqual(WEAPON_FINISH, PLAYER_FINISH);
  assert.equal(PLAYER_FINISH.steel, undefined);
});

/* CHARACTER-VIS-001 T-7(武器・装飾の Material と輪郭線)のソース検査 */
function fnBody(src, name){
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} がある`);
  const end = src.indexOf('\n  }\n', start);
  return src.slice(start, end);
}

test('T-7: 武器の Material は WEAPON_FINISH と配色表の trim から(S-1 / S-2 / S-6)', ()=>{
  const src = readPart('06-player-enemy.js');
  const body = fnBody(src, 'buildWeaponMesh');
  assert.ok(!/color:\s*0xc9a227/.test(body), '固定ゴールド 0xc9a227 の Material が残っていない');
  assert.match(body, /resolvePalette\(paletteKeyFor\(classDef\.key, state\.job, classDef\.charKey\)\)\.trim/);
  for(const k of ['steel', 'darkSteel', 'wood', 'trim', 'gem']){
    assert.ok(body.includes(`WEAPON_FINISH.${k}`), `WEAPON_FINISH.${k} を読む`);
  }
  assert.ok(!/roughness:0\.3, metalness:0\.7|roughness:0\.4, metalness:0\.6|roughness:0\.35, metalness:0\.55/.test(body),
    'steel / darkSteel / goldTrim の旧い直値が残っていない');
  // 生成時と差し替え時で同じ関数・同じ引数の形(呼び出し側で trim Material を渡さない)
  assert.ok(src.includes('function buildWeaponMesh(weaponKey, classDef, bodyR, bodyH, HIP_Y, specialId)'));
  const calls = src.match(/buildWeaponMesh\([^)]*\)/g).filter(c => !c.includes('weaponKey, classDef, bodyR'));
  assert.deepEqual(calls.filter(c => /trimMat/.test(c)), [], '呼び出しで trimMat を渡していない');
});

test('T-7: 武器・上位職の装飾の破棄は共有 Material を dispose しない(S-5)', ()=>{
  const src = readPart('06-player-enemy.js');
  const dispose = fnBody(src, 'disposePlayerPartTree');
  assert.match(dispose, /c\.userData\.isOutline \|\| c\.userData\.isXray/);
  assert.match(dispose, /P\.roleMats/);
  for(const name of ['swapPlayerWeaponVisual', 'clearJobPromotionVisual']){
    const body = fnBody(src, name);
    assert.ok(!/c\.material\.dispose\(\)/.test(body), `${name} が Material を直接 dispose しない`);
    assert.match(body, /disposePlayerPartTree\(/);
  }
});

test('T-7: 持ち替えた武器・上位職の装飾に既存の輪郭線と X 線シェル、エフェクトは対象外(S-3 / S-4 / P-D4)', ()=>{
  const src = readPart('06-player-enemy.js');
  const helper = fnBody(src, 'addPartOutlines');
  assert.match(helper, /addOutline\(r, \{always:true/);
  assert.match(helper, /addXrayShell\(r,/);
  assert.match(fnBody(src, 'swapPlayerWeaponVisual'), /addPartOutlines\(\[weapon, P\.offhandWeapon\]/);
  assert.match(fnBody(src, 'applyJobPromotionVisual'), /addPartOutlines\(meshes\)/);
  // 魔法エフェクト(魔導士の結晶・魔法陣、バーサーカーのオーラ)は noOutline
  const promo = fnBody(src, 'applyJobPromotionVisual');
  for(const v of ['auraRing', 'c', 'circle']){
    assert.ok(new RegExp(`\\b${v}\\.userData\\.noOutline = true`).test(promo), `${v} は輪郭線の対象外`);
  }
  // 輪郭線の方式そのもの(outlineMats / addOutline)は変えない
  const rig = readPart('05-rendering-rig.js');
  assert.match(rig, /_outlineDark = makeOutlineMat\(0\.032, 0x0d0a12\);/);
  assert.match(rig, /_outlineRim  = makeOutlineMat\(0\.014, 0xdcd0b0\);/);
});

test('T-7 S-7: 指の左右位置は手の大きさに比例し、手の球の内側に収まる', ()=>{
  const src = readPart('06-player-enemy.js');
  assert.ok(!src.includes('[-0.16,0,0.16].forEach(fx=>'), '旧 絶対値 ±0.16 の指の位置が残っていない');
  const m = src.match(/\[(-?[0-9.]+), 0, ([0-9.]+)\]\.forEach\(fxMul=>\{[\s\S]*?finger\.position\.set\(fxMul\*B\.forearm,/);
  assert.ok(m, '指の x = fxMul × B.forearm');
  // 指(カプセル半径 forearm×0.16)の外側の端が手の球(半径 forearm×1.12)の内側
  const outer = Math.max(Math.abs(+m[1]), Math.abs(+m[2])) + 0.16;
  assert.ok(outer < 1.12, `指の外端 ${outer} × forearm < 手の半径 1.12 × forearm`);
});
