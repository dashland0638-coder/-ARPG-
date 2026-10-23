/* 宵待ちの村の敵の見た目の表(core/dusk-enemies.js、CH1-COMP W3-E)。

   固定すること:
     1. 足元の輪の半径 = 判定の半径(今の値のまま。AI とこの表が同じ定数を読む)
     2. 輪の出し入れ: 溜めの始めに 0、当たる瞬間に満ち、当たった後・倒れている間は出さない
     3. 色: 敵の主な色・差し色は味方(PLAYER_PALETTE・CLASSES)と演出の幽霊の色から ΔE 15 以上、
        敵どうしで 12 以上離れている。残響の色は演出の幽霊と取り違えない
     4. 布はマット(roughness ≥ 0.8、metalness 0)
     5. 姿勢: 水門守・残響は「引ききる」瞬間が当たる瞬間と同じ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VILLAGE_KINDS, MIRROR_STRIKE_RADIUS, MIRROR_STRIKE_SEC, FOAM_CONTACT_RADIUS, BOSS_MELEE_REACH_PAD,
  DUSK_BOSS_ECHO_SCALE, DUSK_BOSS_ECHO_RADIUS, FOAM_SCALE, WARDEN_SCALE, bossMeleeHitRadius,
  RING_COLORS, EXISTING_RING_COLORS, RING_STYLE, VILLAGE_PALETTE, ECHO_FIGURE_COLOR, APPARITION_COLOR,
  ECHO_OPACITY, VILLAGE_FINISH, VILLAGE_PROPORTIONS, FOAM_CLUSTER, foamVisualRadius, foamHitRadius,
  mirrorRingProgress, foamRingVisible, bossMeleeRingProgress, mirrorPose, keeperPose, echoPose,
  copyMimicProgress, hexToLab, deltaE, ALLY_MIN_DELTA_E, KIND_MIN_DELTA_E, DARK_L_MAX, echoRadiusFor,
} from '../../src/core/dusk-enemies.js';
import {
  PROVISIONAL_WINDUP_REAL_SEC, PROVISIONAL_WINDUP_CLONE_SEC, windupPlan,
} from '../../src/core/mirror-shade.js';
import {
  PROVISIONAL_ECHO_RADIUS, KEEPER_STRIKE_FRAC, ECHO_HARM_FRAC, PROVISIONAL_OPERATE_SEC,
} from '../../src/core/warden-echo.js';
import { PLAYER_PALETTE, resolvePalette } from '../../src/render/player-palette.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const ai = read('src/legacy/parts/07-ai-combat.js');
const village = read('src/legacy/parts/14-dungeon-duskvillage.js');
const chars = read('src/legacy/parts/01-character-creation.js');

function fnBody(src, name){
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} がある`);
  let depth = 0, i = src.indexOf('{', start);
  for(; i < src.length; i++){
    if(src[i] === '{') depth++;
    else if(src[i] === '}' && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

test('判定の半径(今の値のまま)と、輪の半径が同じ定数', async (t) => {
  await t.test('値は今のまま', () => {
    assert.equal(MIRROR_STRIKE_RADIUS, 2.4);
    assert.equal(MIRROR_STRIKE_SEC, 0.22);
    assert.equal(FOAM_CONTACT_RADIUS, 1.5);
    assert.equal(BOSS_MELEE_REACH_PAD, 0.4);
    assert.equal(DUSK_BOSS_ECHO_SCALE, 1.5);
    assert.ok(Math.abs(DUSK_BOSS_ECHO_RADIUS - 3.6) < 1e-9);
    assert.ok(Math.abs(echoRadiusFor(DUSK_BOSS_ECHO_SCALE) - 3.6) < 1e-9);
    assert.equal(echoRadiusFor(), PROVISIONAL_ECHO_RADIUS);
    assert.equal(FOAM_SCALE, 0.62);
    assert.equal(WARDEN_SCALE, 1.18);
    // ボスの近接: atkReach 2.2(solidR 2.0 の既定)+ 0.4 = 2.6
    assert.ok(Math.abs(bossMeleeHitRadius(2.2) - 2.6) < 1e-9);
    assert.ok(Math.abs(bossMeleeHitRadius(undefined) - 2.6) < 1e-9);
  });

  await t.test('AI の判定がこの定数を読む(輪と判定が別の数字にならない)', () => {
    const mirror = fnBody(ai, 'updateMirrorShadeAI');
    assert.match(mirror, /distToPlayer < MIRROR_STRIKE_RADIUS/);
    assert.doesNotMatch(mirror, /distToPlayer < 2\.4/);
    assert.match(mirror, /en\.mirrorT = MIRROR_STRIKE_SEC/);
    const foam = fnBody(ai, 'updateFoamAI');
    assert.match(foam, /distToPlayer < FOAM_CONTACT_RADIUS/);
    const boss = fnBody(ai, 'updateBossAI');
    assert.match(boss, /<= bossMeleeHitRadius\(en\.atkReach\)/);
    // 輪はそれぞれ同じ定数で作る
    const rings = fnBody(ai, 'updateVillageTelegraphs');
    assert.match(rings, /MIRROR_STRIKE_RADIUS/);
    assert.match(rings, /FOAM_CONTACT_RADIUS/);
    assert.match(rings, /bossMeleeHitRadius\(en\.atkReach\)/);
    // ボスの段階 3 の残響は印を付けて、判定と同じ大きさで出す
    assert.match(fnBody(ai, 'stepDuskEchoLayer'), /source: BOSS_ECHO_SOURCE/);
    assert.match(fnBody(ai, 'stepDuskEchoLayer'), /scale: DUSK_BOSS_ECHO_SCALE/);
  });
});

test('輪の出し入れ(AI の状態を読むだけ)', async (t) => {
  await t.test('水鏡の影: 溜めで 0 → 1、一撃の窓で当たるまで満ちたまま、当たったら消える', () => {
    for(const isReal of [true, false]){
      const plan = windupPlan(isReal, false);
      assert.equal(plan.dur, isReal ? PROVISIONAL_WINDUP_REAL_SEC : PROVISIONAL_WINDUP_CLONE_SEC);
      const en = {triggered: true, mirrorState: 'windup', mirrorT: plan.dur, mirrorWindupDur: plan.dur};
      assert.equal(mirrorRingProgress(en), 0);
      en.mirrorT = plan.dur / 2;
      assert.ok(Math.abs(mirrorRingProgress(en) - 0.5) < 1e-9);
      en.mirrorT = 0;
      assert.equal(mirrorRingProgress(en), 1);
      // AI と同じ進め方: 溜め → 一撃。一撃の窓で当たったら消える
      Object.assign(en, {mirrorState: 'strike', mirrorT: MIRROR_STRIKE_SEC, mirrorHit: false});
      assert.equal(mirrorRingProgress(en), 1);
      en.mirrorHit = true;
      assert.equal(mirrorRingProgress(en), null);
      Object.assign(en, {mirrorHit: false, mirrorT: 0});
      assert.equal(mirrorRingProgress(en), null);          // 窓が閉じた
      Object.assign(en, {mirrorState: 'chase'});
      assert.equal(mirrorRingProgress(en), null);
    }
  });

  await t.test('水鏡の影: 本体と分身で輪の作りは同じ(違うのは AI の溜めの長さだけ)', () => {
    const real = {triggered: true, mirrorState: 'windup', mirrorT: 0.36, mirrorWindupDur: 0.72};
    const clone = {triggered: true, mirrorState: 'windup', mirrorT: 0.17, mirrorWindupDur: 0.34, mirrorCloneOf: {}};
    assert.equal(mirrorRingProgress(real), mirrorRingProgress(clone));
  });

  await t.test('倒れている・ダウン中・敵対していない・壊れた値では出さない', () => {
    const en = {triggered: true, mirrorState: 'windup', mirrorT: 0.3, mirrorWindupDur: 0.72};
    assert.ok(mirrorRingProgress(en) > 0);
    assert.equal(mirrorRingProgress({...en, dead: true}), null);
    assert.equal(mirrorRingProgress({...en, knockedDown: true}), null);
    assert.equal(mirrorRingProgress({...en, triggered: false}), null);
    assert.equal(mirrorRingProgress({...en, mirrorWindupDur: NaN}), null);
    assert.equal(mirrorRingProgress(null), null);
    assert.equal(foamRingVisible({triggered: true}), true);
    assert.equal(foamRingVisible({triggered: false}), false);
    assert.equal(foamRingVisible({triggered: true, dead: true}), false);
    assert.equal(foamRingVisible({triggered: true, knockedDown: true}), false);
  });

  await t.test('ボスの近接: 振りかぶり(0.55 / 0.4)で 0 → 1、当たった後は出さない', () => {
    for(const dur of [0.55, 0.4]){
      const en = {triggered: true, atkWindup: true, atkWindupDur: dur, atkWindupT: dur};
      assert.equal(bossMeleeRingProgress(en), 0);
      en.atkWindupT = 0;
      assert.equal(bossMeleeRingProgress(en), 1);
      en.atkWindup = false;                                  // 当たる判定の後
      assert.equal(bossMeleeRingProgress(en), null);
      assert.equal(bossMeleeRingProgress({...en, atkWindup: true, knockedDown: true}), null);
    }
  });
});

test('色(味方・演出の幽霊・敵どうしから離す)', async (t) => {
  // 味方の色: プレイヤーの配色表(全行・上位職を展開)の main/sub/accent/hat と、CLASSES の color/trim、
  // 上位職の trim/capeColor(支援 AI・足元のリング・VFX が読む)
  const allies = {};
  for(const k of Object.keys(PLAYER_PALETTE)){
    const p = resolvePalette(k);
    for(const r of ['main', 'sub', 'accent', 'hat']) allies[`${k}.${r}`] = p[r];
  }
  const re = /(color|trim|capeColor):0x([0-9a-f]{6})/g;
  let m; let n = 0;
  while((m = re.exec(chars))){ allies[`CLASSES#${n++}.${m[1]}`] = parseInt(m[2], 16); }
  assert.ok(n >= 14, `CLASSES の色を読めている (${n})`);
  allies.apparition = APPARITION_COLOR;
  allies.mageBolt = 0x9fd8ff;    // 写し身が返す魔法弾(プレイヤーの魔法弾に寄せてある)

  const light = hex => hexToLab(hex)[0] >= DARK_L_MAX;

  await t.test('敵の主な色・差し色は味方の色から ΔE 15 以上', () => {
    for(const kind of VILLAGE_KINDS){
      const pal = VILLAGE_PALETTE[kind];
      assert.ok(pal, kind);
      for(const role of ['main', 'accent']){
        assert.ok(light(pal[role]), `${kind}.${role} は暗色にしない(読める明るさ)`);
        for(const [k, v] of Object.entries(allies)){
          const d = deltaE(pal[role], v);
          assert.ok(d >= ALLY_MIN_DELTA_E, `${kind}.${role} ${pal[role].toString(16)} と ${k} ${v.toString(16)} が近い (ΔE ${d.toFixed(1)})`);
        }
      }
    }
  });

  await t.test('剣士・魔法使いの青から特に離す(水鏡の影・泡沫・写し身)', () => {
    for(const [kind, ally] of [['mirror', 0x263a55], ['mirror', 0x35455e], ['foam', 0x8fb9d6], ['foam', 0x7ec8ff],
                               ['copy', 0x8fb9d6], ['copy', 0x6cc4e8]]){
      assert.ok(deltaE(VILLAGE_PALETTE[kind].main, ally) >= 20, `${kind} ↔ ${ally.toString(16)}`);
    }
  });

  await t.test('敵どうしの主な色は ΔE 12 以上(並べて見分けられる)', () => {
    for(let i = 0; i < VILLAGE_KINDS.length; i++){
      for(let j = i + 1; j < VILLAGE_KINDS.length; j++){
        const a = VILLAGE_PALETTE[VILLAGE_KINDS[i]].main, b = VILLAGE_PALETTE[VILLAGE_KINDS[j]].main;
        assert.ok(deltaE(a, b) >= KIND_MIN_DELTA_E, `${VILLAGE_KINDS[i]} ↔ ${VILLAGE_KINDS[j]} (ΔE ${deltaE(a, b).toFixed(1)})`);
      }
    }
  });

  await t.test('残響の姿は演出の幽霊(青灰)と取り違えない。歩いた跡は薄い', () => {
    for(const ghost of [APPARITION_COLOR, 0x4a5a68, 0x46505c, 0x3f4a58, 0x6a8090, 0x7f98a8]){
      assert.ok(deltaE(ECHO_FIGURE_COLOR, ghost) >= 30, ghost.toString(16));
    }
    assert.ok(ECHO_OPACITY.walk < ECHO_OPACITY.operate);
    // 村のファイルで、演出の幽霊の色(0x7fb0c4)は演出(spawnApparition)にだけ残る
    assert.doesNotMatch(fnBody(ai, 'spawnKeeperEcho'), /0x7fb0c4/);
  });

  await t.test('輪の色: 既存の輪と分け、ボスの近接は分身と同じ色(色で本体が分からない)', () => {
    assert.equal(RING_COLORS.bossMelee, RING_COLORS.mirror);
    assert.equal(RING_COLORS.echo, EXISTING_RING_COLORS.keeperEcho);
    for(const [k, v] of Object.entries(EXISTING_RING_COLORS)){
      if(k === 'keeperEcho') continue;
      assert.ok(deltaE(RING_COLORS.mirror, v) >= 20, `mirror ↔ ${k}`);
      assert.ok(deltaE(RING_COLORS.foam, v) >= 15, `foam ↔ ${k}`);
    }
    assert.ok(deltaE(RING_COLORS.foam, RING_COLORS.mirror) >= 20);
    // 泡沫の輪は薄く、満ちない(時刻を示さない)
    assert.equal(RING_STYLE.foam.noFill, true);
    assert.ok(RING_STYLE.foam.ringOpacity < RING_STYLE.mirror.ringOpacity);
  });
});

test('材質と形', async (t) => {
  await t.test('布はマット(roughness ≥ 0.8、metalness 0)', () => {
    for(const k of ['cloth', 'skin', 'foam', 'rope', 'iron', 'water']){
      assert.ok(VILLAGE_FINISH[k].roughness >= 0.8, k);
      assert.equal(VILLAGE_FINISH[k].metalness, 0, k);
    }
    assert.ok(VILLAGE_FINISH.emissiveIntensity <= 0.1);
  });

  await t.test('体つきが種類ごとに違う(高さ・肩幅)', () => {
    const P = VILLAGE_PROPORTIONS;
    const humans = ['mirror', 'copy', 'fisher', 'warden'];
    const heights = humans.map(k => P[k].height);
    const shoulders = humans.map(k => P[k].shoulderW);
    assert.equal(new Set(heights).size, humans.length);
    assert.equal(new Set(shoulders).size, humans.length);
    assert.ok(P.warden.shoulderW > P.fisher.shoulderW && P.fisher.shoulderW > P.copy.shoulderW);
    assert.ok(P.fisher.armLen > P.mirror.armLen, '漁師は腕が長い');
    assert.ok(P.echoBoss.height > 2 * P.warden.height);
  });

  await t.test('泡沫: 3〜4 個の塊。当たりの半径は見た目の広がり × 0.62', () => {
    assert.ok(FOAM_CLUSTER.length >= 3 && FOAM_CLUSTER.length <= 4);
    const r = foamVisualRadius();
    assert.ok(r > FOAM_CLUSTER[0].r);
    assert.ok(Math.abs(foamHitRadius() - r * FOAM_SCALE) < 1e-9);
    assert.ok(foamHitRadius() > 0.25 && foamHitRadius() < 0.45);
  });
});

test('姿勢(見た目だけ)', async (t) => {
  await t.test('水鏡の影: 引きの深さに比例して引く(本体 > 分身)。一撃で前へ振り抜く', () => {
    const real = windupPlan(true, false), clone = windupPlan(false, false);
    const a = mirrorPose('windup', 1, real.depth).arm, b = mirrorPose('windup', 1, clone.depth).arm;
    assert.ok(a > b && b >= 0, `${a} > ${b}`);
    assert.equal(mirrorPose('windup', 0, real.depth).arm, 0);
    assert.ok(mirrorPose('strike', 1, real.depth).arm < 0);
    assert.deepEqual(mirrorPose('chase', 0.5, 1), {arm: 0, lean: 0, spread: 0});
  });

  await t.test('水門守: 予備動作で腕を上げ、引ききるのは当たる瞬間(引く 45%)', () => {
    assert.deepEqual(keeperPose('windup', 0.55, 0.55), {reach: 0, pull: 0});
    assert.equal(keeperPose('windup', 0, 0.55).reach, 1);
    const atStrike = keeperPose('operate', PROVISIONAL_OPERATE_SEC * (1 - KEEPER_STRIKE_FRAC), PROVISIONAL_OPERATE_SEC);
    assert.ok(Math.abs(atStrike.pull - 1) < 1e-9);
    assert.ok(keeperPose('operate', PROVISIONAL_OPERATE_SEC * 0.9, PROVISIONAL_OPERATE_SEC).pull < 1);
    assert.deepEqual(keeperPose('move', 1, 1), {reach: 0, pull: 0});
  });

  await t.test('残響: 出た瞬間から腕が上がっていて(予備動作が無い)、当たる瞬間に引ききる', () => {
    assert.equal(echoPose(0).reach, 1);
    assert.equal(echoPose(0).pull, 0);
    assert.ok(Math.abs(echoPose(ECHO_HARM_FRAC).pull - 1) < 1e-9);
    assert.ok(echoPose(1).pull < 1e-9);
  });

  await t.test('写し身: 写しの溜めの間だけ 0 → 1', () => {
    assert.equal(copyMimicProgress('watch', 1, 1.25), null);
    assert.equal(copyMimicProgress('mimic', 1.25, 1.25), 0);
    assert.equal(copyMimicProgress('mimic', 0, 1.25), 1);
    assert.equal(copyMimicProgress('mimic', 1, NaN), null);
  });
});

test('作り: 光源を足さない・共有の部品は捨てられない', async (t) => {
  await t.test('村の敵の作りに PointLight が無い(ボスの分身は複製した光を外す)', () => {
    assert.doesNotMatch(fnBody(village, 'dressVillageEnemy'), /PointLight|takeLight/);
    assert.doesNotMatch(fnBody(village, 'buildDuskEchoBody'), /PointLight|takeLight/);
    assert.match(fnBody(ai, 'spawnBossMirrorClone'), /isLight/);
  });
  await t.test('共有のジオメトリは世界の破棄で dispose されない', () => {
    const common = read('src/legacy/parts/02-world-common.js');
    assert.match(fnBody(common, 'sharedGeometries'), /villageGeoCache/);
    assert.match(fnBody(common, 'sharedGeometries'), /groundTelegraphGeoCache/);
  });
});
