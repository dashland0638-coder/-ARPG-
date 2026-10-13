/* CH1-EXP X-4: 演出中・会話中も主人公の身体を止めない。

   以前は入力を取り上げている間 updatePlayer が回らず、主人公が最後の姿勢のまま
   固まり、演出で歩かせる(state.walkTo)と足を動かさずに滑っていた。
   ここでは実物のソースの配線を確かめる(見た目は E2E と実機):
     1. 演出中・会話中の分岐から updateBodyWhileScripted を呼ぶ
     2. updateBodyWhileScripted は位置を置き直してから updateLocomotion を呼ぶ
        (上下動が積み上がらない)。速さは演出の徒歩(walkTo)だけ
     3. 入力・移動・攻撃・カメラの処理は呼ばない
     4. 村の演出で歩く同行者に、支援 AI と同じ上下の揺れを付ける */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const hud = read('14-hud-boot.js');
const loop = read('13-update-loop.js');
const village = read('14-dungeon-duskvillage.js');
const fnBody = (text, sig) => { const a = text.indexOf(sig); assert.ok(a >= 0, sig); return text.slice(a, text.indexOf('\n  }\n', a)); };

test('演出中・会話中の分岐から、身体の更新を呼ぶ', () => {
  const cut = hud.slice(hud.indexOf('} else if(state.started && cutscene){'), hud.indexOf('} else if(state.started && state.dialogueActive){'));
  assert.match(cut, /updateCutscenePhysics\(dt\);\s*updateBodyWhileScripted\(dt\);/, '物理で位置が決まってから');
  const dlg = hud.slice(hud.indexOf('} else if(state.started && state.dialogueActive){'), hud.indexOf('} else if(state.started && state.paused){'));
  assert.match(dlg, /updateBodyWhileScripted\(dt\);/);
});

test('身体の更新: 位置を置き直し、演出の徒歩の速さで updateLocomotion を呼ぶだけ', () => {
  const body = fnBody(loop, 'function updateBodyWhileScripted(dt){');
  assert.match(body, /player\.position\.copy\(state\.pos\);[\s\S]*updateLocomotion\(dt, w \? Math\.hypot\(w\.vx \|\| 0, w\.vz \|\| 0\) : 0\);/);
  for (const banned of ['updateInput', 'updatePlayer', 'updateCamera', 'executeVariant', 'state.vel', 'state.pos.x =', 'state.pos.z =']) {
    assert.ok(!body.includes(banned), `${banned} を呼ばない・書かない`);
  }
});

test('演出で歩く同行者(村)は、支援 AI と同じ上下の揺れで歩く', () => {
  const walk = fnBody(village, 'function stepDuskGuestWalk(dt){');
  assert.match(walk, /g\.bobT = \(g\.bobT \|\| 0\) \+ dt;\s*g\.group\.position\.set\(g\.pos\.x, Math\.sin\(g\.bobT\*8\)\*0\.015, g\.pos\.z\);/);
  const guest = read('08-loot-equipment.js');
  assert.match(guest, /Math\.sin\(guestCompanion\.bobT\*8\)\*0\.015/, '支援 AI の揺れと同じ式');
});
