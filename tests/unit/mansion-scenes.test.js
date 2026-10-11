/* 森の洋館の間取りと、合流・分離・異常空間の場面(CM-02)。

   判定(合流・分離・再会の成立条件、異変の段階、同行の追従)は
   tests/unit/mansion-anomaly.test.js が見ている。ここで固定するのは、その判定が
   **実際の間取りと場面に正しく繋がっているか**:

     1. MANSION_ROOMS の表の静的な検算(25部屋、重なり、出入口の噛み合い、
        階段の出発点・到着点)。tests/mansion-scenario.spec.js が「静的な検算で
        確認できる」と書いていた検算の実体
     2. 作業室での合流(イベントの置き場所と、合流前は鍛冶屋が動かないこと)
     3. 地下入口の扉での分離(実物の playMansionSplitScene を stub 付きで動かす)
     4. 異常空間の道筋(入口 → 番人 → 地下への階段)

   この環境(software rendering)では洋館を歩いて通せないので、場面は
   chapter1-no-anomaly.test.js と同じく「実物のソースを stub 付きで動かす」。
   台詞の文面は固定しない(演出の調整で変わってよい)。固定するのは順番と結果。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ESCORT, ANOMALY, ROOM_ANOMALY_STAGE, escortFollows, shouldSeparate, ESCORT_STOP_DIST,
} from '../../src/core/mansion-anomaly.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/legacy/parts/03-dungeons-mansion-temple.js'), 'utf8');
const combat = fs.readFileSync(path.join(root, 'src/legacy/parts/07-ai-combat.js'), 'utf8');
const world = fs.readFileSync(path.join(root, 'src/legacy/parts/02-world-common.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/legacy/parts/12-progression-ui.js'), 'utf8');

/* ---- 表と座標をソースから読む(書き写さない) ---- */
const ROOMS = (()=>{
  const a = src.indexOf('const MANSION_ROOMS = [');
  assert.ok(a >= 0, 'MANSION_ROOMS');
  const b = src.indexOf('\n  ];', a);
  const body = src.slice(src.indexOf('[', a), b + 4).replace(/\/\*[\s\S]*?\*\//g, '');
  return new Function(`return ${body}`)();
})();
const byId = Object.fromEntries(ROOMS.map(r => [r.id, r]));
const roomAt = (x, z) => ROOMS.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);

function vec(name){
  const m = src.match(new RegExp(`const ${name} = new THREE\\.Vector3\\((-?[\\d.]+), *0, *(-?[\\d.]+)\\)`));
  assert.ok(m, name);
  return { x: +m[1], z: +m[2] };
}
const SPLIT_DOOR = vec('MANOR_SPLIT_DOOR');
const ANOMALY_ENTRY = vec('MANOR_ANOMALY_ENTRY');

/* 洋館の階段(数値で書かれているもの)。周回の隠し部屋(★3、cx/cz)と屋根裏(★4)は
   第一章では出ないので対象外 */
const STAIRS = (()=>{
  const sec = src.slice(src.indexOf('const MANSION_ROOMS'));
  const re = /buildStairs\(new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\), new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\),\s*'[^']*', 0x[0-9a-f]+, '(up|down)'(?:, '([A-Za-z]+)')?\)/g;
  const out = []; let m;
  while ((m = re.exec(sec))) out.push({ from: { x: +m[1], z: +m[2] }, to: { x: +m[3], z: +m[4] }, dir: m[5], gate: m[6] || null });
  return out;
})();
const STAIR_RADIUS = (()=>{
  const m = world.match(/label, radius:([\d.]+), gateKey/);
  assert.ok(m, 'buildStairs の判定半径');
  return +m[1];
})();

function side(r, s){
  if (s === 'N') return { v: r.z1, lo: r.x0, hi: r.x1 };
  if (s === 'S') return { v: r.z0, lo: r.x0, hi: r.x1 };
  if (s === 'E') return { v: r.x1, lo: r.z0, hi: r.z1 };
  return { v: r.x0, lo: r.z0, hi: r.z1 };
}
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const span = (r, s, g) => g === 'full' ? [side(r, s).lo, side(r, s).hi] : g;

/* ソースから関数を1つ切り出す(chapter1-no-anomaly.test.js と同じ作法) */
function fn(text, signature){
  const a = text.indexOf(signature);
  assert.ok(a >= 0, signature);
  return text.slice(a, text.indexOf('\n  }\n', a) + 4);
}

test('間取り: 25部屋(通常22 + 異常空間3)。id は重複せず、寸法は正', () => {
  assert.equal(ROOMS.length, 25);
  assert.equal(new Set(ROOMS.map(r => r.id)).size, 25);
  assert.equal(ROOMS.filter(r => r.id.startsWith('x')).length, 3);
  for (const r of ROOMS) {
    assert.ok(r.x0 < r.x1 && r.z0 < r.z1, r.id);
    assert.ok(r.name, r.id);
  }
});

test('間取り: どの2部屋も床が重ならない(壁を共有するのはよい)', () => {
  for (let i = 0; i < ROOMS.length; i++) for (let j = i + 1; j < ROOMS.length; j++) {
    const p = ROOMS[i], q = ROOMS[j];
    const overlap = p.x0 < q.x1 && q.x0 < p.x1 && p.z0 < q.z1 && q.z0 < p.z1;
    assert.ok(!overlap, `${p.id} と ${q.id}`);
  }
});

test('間取り: 出入口は壁の内側にあり、向かいの部屋にも出入口がある(外への出口は正面玄関だけ)', () => {
  const exterior = [];
  for (const r of ROOMS) for (const [s, g] of Object.entries(r.gaps || {})) {
    const sd = side(r, s), sp = span(r, s, g);
    assert.ok(sp[0] < sp[1] && sp[0] >= sd.lo && sp[1] <= sd.hi, `${r.id}.${s} は壁の範囲内`);
    const facing = ROOMS.filter(o => {
      if (o === r) return false;
      const os = side(o, OPP[s]);
      if (os.v !== sd.v || os.lo > sp[0] || os.hi < sp[1]) return false;
      const og = (o.gaps || {})[OPP[s]];
      if (!og) return false;
      const ospan = span(o, OPP[s], og);
      return ospan[0] < sp[1] && ospan[1] > sp[0];
    });
    if (!facing.length) exterior.push(`${r.id}.${s}`);
  }
  // 正面玄関の北(前庭・森へ出る口)だけが、向かいに部屋を持たない
  assert.deepEqual(exterior, ['mEntry.N']);
});

test('間取り: 全部屋に異変の段階が明示されている(既定値に頼らない)', () => {
  for (const r of ROOMS) {
    assert.ok(Object.prototype.hasOwnProperty.call(ROOM_ANOMALY_STAGE, r.id), r.id);
  }
  for (const id of ['xFoyer', 'xCor', 'xHall']) assert.equal(ROOM_ANOMALY_STAGE[id], ANOMALY.BROKEN, id);
});

test('階段: 出発点も到着点も部屋の中。到着点はどの階段の判定圏の外', () => {
  assert.equal(STAIRS.length, 8);
  for (const s of STAIRS) {
    const rf = roomAt(s.from.x, s.from.z), rt = roomAt(s.to.x, s.to.z);
    assert.ok(rf, `出発点 (${s.from.x},${s.from.z})`);
    assert.ok(rt, `到着点 (${s.to.x},${s.to.z})`);
    const margin = Math.min(s.to.x - rt.x0, rt.x1 - s.to.x, s.to.z - rt.z0, rt.z1 - s.to.z);
    assert.ok(margin >= 1, `到着点 (${s.to.x},${s.to.z}) は ${rt.id} の壁から 1 以上内側`);
    for (const o of STAIRS) {
      const d = Math.hypot(o.from.x - s.to.x, o.from.z - s.to.z);
      assert.ok(d > STAIR_RADIUS, `到着点 (${s.to.x},${s.to.z}) が (${o.from.x},${o.from.z}) の判定圏(${STAIR_RADIUS})に入る`);
    }
  }
});

test('階段: 本筋の順に部屋が繋がっている(一階 → 二階 → 一階奥 → 異常空間 → 地下 → 主の間)', () => {
  const fwd = STAIRS.filter(s => s.dir === 'down' || roomAt(s.from.x, s.from.z).id === 'mStair')
    .map(s => `${roomAt(s.from.x, s.from.z).id}>${roomAt(s.to.x, s.to.z).id}`);
  for (const step of ['mStair>uLand', 'uWork>sLand', 'xHall>bCellar', 'bDeep>bAnte']) {
    assert.ok(fwd.includes(step), step);
  }
  // 地下入口(sDown)には階段が無い。地下へは分離の後、異常空間からしか降りられない
  assert.ok(!STAIRS.some(s => roomAt(s.from.x, s.from.z).id === 'sDown'));
  // 異常空間から地下へ降りる階段は、鍵束の番人を倒すまで開かない
  const down = STAIRS.find(s => roomAt(s.from.x, s.from.z).id === 'xHall');
  assert.equal(down.gate, 'manorWarden');
});

test('合流: 作業室で出会い、そのときから同行が始まる', () => {
  // 作業室のイベントが合流の会話になっている
  assert.match(src, /registerRoomEvent\(mansionRoomById\('uWork'\), 0, '鍛冶士', \[[\s\S]*?\], \{inset:1\.2, kind:'mansionEscortJoin'\}\);/);
  // 会話を閉じたら JOINED になり、プレイヤーの後ろへ置き直す
  const branch = ui.slice(ui.indexOf("state.dialogueKind==='mansionEscortJoin'"), ui.indexOf("state.dialogueKind==='mansionFarewell'"));
  assert.match(branch, /state\.smithEscort = ESCORT\.JOINED;/);
  assert.match(branch, /repositionManorSmith\(\);/);
});

test('合流: 出会う前と分離の後は、鍛冶屋をプレイヤーの後ろへ引きずらない(実機レビュー 4)', () => {
  const code = [
    'let manorSmith = smith, manorSmithBob = 0;',
    fn(src, 'function repositionManorSmith(){'),
    'return repositionManorSmith;',
  ].join('\n');
  const run = escort => {
    const smith = { position: { x: 70, y: 0, z: -30, set(x, y, z){ this.x = x; this.y = y; this.z = z; } }, rotation: { y: 0 } };
    const state = { smithEscort: escort, facing: 0, pos: { x: 10, z: 10 } };
    new Function('smith', 'state', 'escortFollows', 'ESCORT_STOP_DIST', code)(smith, state, escortFollows, ESCORT_STOP_DIST)();
    return smith.position;
  };
  for (const e of [ESCORT.NONE, ESCORT.SEPARATED]) {
    const p = run(e);
    assert.deepEqual([p.x, p.z], [70, -30], e);
  }
  const p = run(ESCORT.JOINED);
  // 向きの反対側(facing=0 → -z)へ止まる距離ぶん
  assert.ok(Math.abs(p.x - 10) < 1e-9);
  assert.ok(Math.abs(p.z - (10 - ESCORT_STOP_DIST)) < 1e-9);
});

test('分離: 扉は使用人区画と地下入口の境の出入口にあり、くぐった先(地下入口)で成立する', () => {
  const q = byId.sQuart, d = byId.sDown;
  assert.equal(SPLIT_DOOR.z, q.z1);
  assert.equal(SPLIT_DOOR.z, d.z0);
  assert.ok(SPLIT_DOOR.x > q.gaps.N[0] && SPLIT_DOOR.x < q.gaps.N[1]);
  assert.match(src, /registerRoomEvent\(mansionRoomById\('sDown'\), 0, '', \(\)=>\{\s*playMansionSplitScene\(\);\s*return null;\s*\}, \{inset:2\.0,\s*condition:\(\)=> shouldSeparate\(\{escort:state\.smithEscort, atSplitDoor:true\}\)\}\);/);
  // 同行していないときは扉をくぐっても起きない(二重発火・合流前の誤爆)
  assert.equal(shouldSeparate({ escort: ESCORT.NONE, atSplitDoor: true }), false);
  assert.equal(shouldSeparate({ escort: ESCORT.SEPARATED, atSplitDoor: true }), false);
});

/* playMansionSplitScene を実物のまま動かす。playCutscene は手順を順に走らせ、
   fadeTransition はその場で中身を呼ぶ。何が、どの順で起きたかを記録する */
function runSplitScene(){
  const log = [];
  const state = {
    smithEscort: ESCORT.JOINED, dialogueActive: false, facing: 0, camYaw: 0, routeNode: 'servant',
    pos: { x: 76, y: 0, z: 90, copy(v){ this.x = v.x; this.y = v.y; this.z = v.z; } },
    vel: { set(){} },
  };
  let smithRemoved = false;
  const smith = { position: { set(){} }, rotation: { y: 0 } };
  let totalT = 0;
  const deps = {
    state,
    ESCORT,
    MANOR_ANOMALY_ENTRY: { x: ANOMALY_ENTRY.x, y: 0, z: ANOMALY_ENTRY.z },
    scene: { remove(o){ if (o === smith) smithRemoved = true; } },
    camera: { position: { copy(){ return { add(){} }; } } },
    getCamOffset: () => ({}),
    playCutscene: steps => {
      state.dialogueActive = true;          // 実物の playCutscene と同じく、走っている間は操作を止める
      for (const st of steps) { totalT += st.t || 0; st.run(); }
    },
    fadeTransition: f => { log.push('fade'); f(); },
    cutsceneTurnTo: (yaw, dur, cam) => log.push(`turn:${yaw.toFixed(2)}:${cam === undefined ? '-' : cam.toFixed(2)}`),
    cutsceneLine: text => log.push(`line:${text}`),
    cutsceneHideLine: () => log.push('hideLine'),
    sfx: name => log.push(`sfx:${name}`),
    repositionAlliesToPlayer: () => log.push('allies'),
    clearMovementInput: () => log.push('input'),
  };
  const code = [
    'let manorSmith = smith;',
    fn(src, 'function playMansionSplitScene(){'),
    'playMansionSplitScene();',
    'return { smithAfter: manorSmith };',
  ].join('\n');
  const out = new Function('smith', ...Object.keys(deps), code)(smith, ...Object.values(deps));
  return { log, state, smithRemoved, smithAfter: out.smithAfter, totalT };
}

test('分離の場面: 暗転の向こうは異常空間の玄関ホール……? で、鍛冶屋はいない', () => {
  const r = runSplitScene();
  assert.equal(r.state.smithEscort, ESCORT.SEPARATED);
  assert.equal(r.smithRemoved, true);
  assert.equal(r.smithAfter, null);
  assert.equal(roomAt(r.state.pos.x, r.state.pos.z).id, 'xFoyer');
  assert.equal(r.state.routeNode, 'anomaly');
  // 異常空間に着いた直後は鍛冶屋が付いてこない
  assert.equal(escortFollows(r.state.smithEscort), false);
});

test('分離の場面: 扉 → 暗転 → 振り返る(カメラも回る) → 一言 → 向き直る → 操作が戻る', () => {
  const r = runSplitScene();
  const order = r.log.filter(e => /^(sfx:door|fade|turn:|line:|hideLine|input)/.test(e));
  assert.deepEqual(order.map(e => e.replace(/^line:.*/, 'line').replace(/^turn:([^:]+):.*/, 'turn:$1')), [
    'sfx:door', 'fade', `turn:${Math.PI.toFixed(2)}`, 'line', 'hideLine', 'turn:0.00', 'input',
  ]);
  // 振り返るときはカメラも反対側へ、向き直るときは元へ(片方だけだと何が無いのかが映らない)
  assert.ok(r.log.includes(`turn:${Math.PI.toFixed(2)}:0.00`));
  assert.ok(r.log.includes(`turn:0.00:${Math.PI.toFixed(2)}`));
  // 台詞は一言だけ。状況を説明しない
  assert.equal(r.log.filter(e => e.startsWith('line:')).length, 1);
  // 最後に操作が戻る
  assert.equal(r.state.dialogueActive, false);
  // 演出は短い(合計 6 秒未満)
  assert.ok(r.totalT > 0 && r.totalT < 6, `${r.totalT}`);
});

test('異常空間: 入口 → 見覚えのない廊下 → 大広間……?(鍵束の番人)と一本道で繋がる', () => {
  assert.equal(roomAt(ANOMALY_ENTRY.x, ANOMALY_ENTRY.z).id, 'xFoyer');
  // xFoyer の出口は北だけ(玄関の扉があるはずの南は塞がっている)
  assert.deepEqual(Object.keys(byId.xFoyer.gaps), ['N']);
  assert.deepEqual(Object.keys(byId.xHall.gaps), ['S']);
  // 番人は大広間……? の中に立つ
  const m = combat.match(/spawnTaggedGroup\('manorWarden', \[[\s\S]*?new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\)/);
  assert.ok(m);
  assert.equal(roomAt(+m[1], +m[2]).id, 'xHall');
  // 異常空間は通常の館と離れていて、どの通常の部屋とも壁を共有しない
  for (const x of ['xFoyer', 'xCor', 'xHall']) for (const r of ROOMS.filter(o => !o.id.startsWith('x'))) {
    const a = byId[x];
    const touch = a.x0 <= r.x1 && r.x0 <= a.x1 && a.z0 <= r.z1 && r.z0 <= a.z1;
    assert.ok(!touch, `${x} と ${r.id}`);
  }
});
