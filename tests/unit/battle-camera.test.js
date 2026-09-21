/* 戦闘 / 非戦闘カメラ(core/battle-camera.js)。

   ここが固定するのは「関係」であって、距離の数値そのものではない ――
   7.0 / 8.6 / 6.0 / 8.0 は実機で詰める前提の初期値。縛るのは:

     ・非戦闘の方が引いていて、寝ていること
     ・戦闘カメラが現行値(camDist 6 / camHeight 8)のままであること
       = 既に調整済みの戦闘の手触りを変えていないこと
     ・途中反転しても跳ばないこと
     ・敵が遠くても +1.2m で頭打ちになること(無制限に引かない)
     ・camAutoOn(向きの設定)とは無関係であること
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPLORE_CAMERA, COMBAT_CAMERA, stepCombatCamBlend, cameraProfileAt,
  targetDistanceBonus, stepDistanceBonus, cameraTierParams, CAMERA_TIER,
  COMBAT_CAM_IN_RATE, COMBAT_CAM_OUT_RATE,
  COMBAT_DIST_BONUS_MAX, COMBAT_DIST_NEAR, COMBAT_DIST_FAR,
  COMBAT_DIST_MAX_SPEED,
} from '../../src/core/battle-camera.js';

const deg = (h, d) => Math.atan2(h, d) * 180 / Math.PI;

test('2つのプロファイルの関係', async t=>{
  await t.test('戦闘カメラは現行値のまま ―― 手触りを変えない', ()=>{
    // src/core/state.js の camDist:6 / camHeight:8
    assert.equal(COMBAT_CAMERA.dist, 6.0);
    assert.equal(COMBAT_CAMERA.height, 8.0);
  });

  await t.test('非戦闘の方が引いている(約1m)', ()=>{
    assert.ok(EXPLORE_CAMERA.dist > COMBAT_CAMERA.dist);
    const a = Math.hypot(EXPLORE_CAMERA.dist, EXPLORE_CAMERA.height);
    const b = Math.hypot(COMBAT_CAMERA.dist, COMBAT_CAMERA.height);
    assert.ok(a - b > 0.8 && a - b < 1.5, `引き幅 ${a-b}m は狙い(約1m)から外れている`);
  });

  await t.test('非戦闘の方が俯角が寝ている ―― 背中の武器が見える角度', ()=>{
    const explore = deg(EXPLORE_CAMERA.height, EXPLORE_CAMERA.dist);
    const combat  = deg(COMBAT_CAMERA.height,  COMBAT_CAMERA.dist);
    assert.ok(explore < combat, `探索 ${explore}° が戦闘 ${combat}° より寝ていない`);
    // 寝かせすぎると被弾テレグラフの視認性が落ちる。2〜4度に留める
    assert.ok(combat - explore > 1.5 && combat - explore < 4,
      `俯角の差 ${combat-explore}° が想定(2〜4度)の外`);
  });
});

test('EXPLORE ↔ COMBAT の補間(仕様 13)', async t=>{
  const step = (from, want, sec, dt=1/60)=>{
    let b = from;
    for(let i=0;i<Math.round(sec/dt);i++) b = stepCombatCamBlend(b, want, dt);
    return b;
  };

  await t.test('探索 → 戦闘は約0.30秒で寄り切る', ()=>{
    assert.ok(step(0, true, 0.30) > 0.93, '0.30秒で寄り切っていない');
    assert.ok(step(0, true, 0.05) < 0.5, '一瞬で飛んでいる');
  });

  await t.test('戦闘 → 探索は約0.40秒 ―― 入りより遅い', ()=>{
    assert.ok(step(1, false, 0.40) < 0.07);
    assert.ok(COMBAT_CAM_OUT_RATE < COMBAT_CAM_IN_RATE,
      '抜けの方が速い ―― 戦闘終わりが慌ただしく見える');
  });

  await t.test('途中で敵に再遭遇しても跳ばない(途中反転)', ()=>{
    const dt = 1/60;
    let b = 1, prev = 1, maxJump = 0;
    // 戦闘 → 抜けかけ → また戦闘 → また抜け、を細かく切り替える
    const script = [[0.15,false],[0.08,true],[0.05,false],[0.30,true],[0.50,false]];
    for(const [sec, want] of script){
      for(let i=0;i<Math.round(sec/dt);i++){
        b = stepCombatCamBlend(b, want, dt);
        maxJump = Math.max(maxJump, Math.abs(b - prev));
        prev = b;
        assert.ok(b >= 0 && b <= 1, `blend=${b}`);
      }
    }
    // 1フレームで動ける上限は 1-exp(-10/60) ≒ 0.154
    assert.ok(maxJump < 0.17, `1フレームで ${maxJump} 動いた ―― 飛んでいる`);
  });

  await t.test('dt 0 では動かない', ()=>{
    assert.equal(stepCombatCamBlend(0.3, true, 0), 0.3);
  });

  await t.test('範囲外の入力でも 0..1 に収まる', ()=>{
    assert.ok(stepCombatCamBlend(5, true, 0.1) <= 1);
    assert.ok(stepCombatCamBlend(-5, false, 0.1) >= 0);
  });
});

test('プロファイルの合成', async t=>{
  await t.test('blend 0 は探索、1 は戦闘そのもの', ()=>{
    assert.deepEqual(cameraProfileAt(0), {dist:EXPLORE_CAMERA.dist, height:EXPLORE_CAMERA.height});
    assert.deepEqual(cameraProfileAt(1), {dist:COMBAT_CAMERA.dist, height:COMBAT_CAMERA.height});
  });

  await t.test('途中は単調に寄る', ()=>{
    let prev = cameraProfileAt(0).dist;
    for(let i=1;i<=10;i++){
      const d = cameraProfileAt(i/10).dist;
      assert.ok(d <= prev, `blend ${i/10} で距離が戻った`);
      prev = d;
    }
  });

  await t.test('追加距離は足されるが、高さには効かない', ()=>{
    const p = cameraProfileAt(1, 1.2);
    assert.ok(Math.abs(p.dist - (COMBAT_CAMERA.dist + 1.2)) < 1e-9);
    assert.equal(p.height, COMBAT_CAMERA.height);
  });

  await t.test('負の追加距離は無視する(寄りすぎない)', ()=>{
    assert.equal(cameraProfileAt(1, -5).dist, COMBAT_CAMERA.dist);
  });

  await t.test('ユーザーのカメラ高さ設定はここでは足さない(二重加算を作らない)', ()=>{
    // 足すのは applyCameraProfile()(13-update-loop.js)ただ1箇所
    assert.equal(cameraProfileAt(1).height, COMBAT_CAMERA.height);
  });
});

test('ターゲット距離による追加距離(仕様 14)', async t=>{
  await t.test('近ければ足さない', ()=>{
    assert.equal(targetDistanceBonus(0), 0);
    assert.equal(targetDistanceBonus(COMBAT_DIST_NEAR), 0);
    assert.equal(targetDistanceBonus(1.5), 0);
  });

  await t.test('3〜7m は線形', ()=>{
    const mid = (COMBAT_DIST_NEAR + COMBAT_DIST_FAR)/2;
    assert.ok(Math.abs(targetDistanceBonus(mid) - COMBAT_DIST_BONUS_MAX/2) < 1e-9);
  });

  await t.test('7m 以上は +1.2m で頭打ち', ()=>{
    assert.equal(targetDistanceBonus(COMBAT_DIST_FAR), COMBAT_DIST_BONUS_MAX);
    assert.equal(targetDistanceBonus(8), COMBAT_DIST_BONUS_MAX);
    assert.equal(targetDistanceBonus(40), COMBAT_DIST_BONUS_MAX);
    assert.equal(targetDistanceBonus(9999), COMBAT_DIST_BONUS_MAX,
      '遠くへ逃げた敵を無制限に追っている');
  });

  await t.test('単調 ―― 離れるほど引く、近づくほど寄る', ()=>{
    let prev = -1;
    for(let d=0; d<=12; d+=0.25){
      const b = targetDistanceBonus(d);
      assert.ok(b >= prev, `${d}m で引きが戻った`);
      prev = b;
    }
  });

  await t.test('ターゲットが居なければ 0', ()=>{
    assert.equal(targetDistanceBonus(null), 0);
    assert.equal(targetDistanceBonus(undefined), 0);
    assert.equal(targetDistanceBonus(-1), 0);
  });
});

test('追加距離の追従(仕様 14・17)', async t=>{
  await t.test('1秒あたり 0.8m を超えて動かない', ()=>{
    const dt = 1/60;
    let cur = 0;
    for(let i=0;i<120;i++){
      const next = stepDistanceBonus(cur, COMBAT_DIST_BONUS_MAX, dt);
      assert.ok(Math.abs(next - cur) <= COMBAT_DIST_MAX_SPEED*dt + 1e-9,
        `1フレームで ${Math.abs(next-cur)}m 動いた`);
      cur = next;
    }
  });

  await t.test('急にズームしない ―― 0.3秒では上限まで届かない', ()=>{
    const dt = 1/60;
    let cur = 0;
    for(let i=0;i<18;i++) cur = stepDistanceBonus(cur, COMBAT_DIST_BONUS_MAX, dt);
    assert.ok(cur < COMBAT_DIST_BONUS_MAX * 0.6,
      `0.3秒で ${cur}m まで引いた ―― 速すぎる(カメラ酔い)`);
  });

  await t.test('放っておけば目標へ収束する', ()=>{
    const dt = 1/60;
    let cur = 0;
    for(let i=0;i<300;i++) cur = stepDistanceBonus(cur, COMBAT_DIST_BONUS_MAX, dt);
    assert.ok(Math.abs(cur - COMBAT_DIST_BONUS_MAX) < 0.02);
  });

  await t.test('戦闘が終われば 0 へ戻る', ()=>{
    const dt = 1/60;
    let cur = COMBAT_DIST_BONUS_MAX;
    for(let i=0;i<300;i++) cur = stepDistanceBonus(cur, 0, dt);
    assert.ok(Math.abs(cur) < 0.02);
  });

  await t.test('敵が瞬間移動しても、引きは滑らかなまま', ()=>{
    const dt = 1/60;
    let cur = 0, prev = 0, maxJump = 0;
    // 目標を毎フレーム 0 と上限で振り回す(最悪ケース)
    for(let i=0;i<180;i++){
      cur = stepDistanceBonus(cur, (i%2) ? COMBAT_DIST_BONUS_MAX : 0, dt);
      maxJump = Math.max(maxJump, Math.abs(cur - prev));
      prev = cur;
    }
    assert.ok(maxJump <= COMBAT_DIST_MAX_SPEED*dt + 1e-9);
  });

  await t.test('dt 0 では動かない', ()=>{
    assert.equal(stepDistanceBonus(0.5, 1.2, 0), 0.5);
  });
});

/* 仕様 17。camAutoOn は「向きを自動で回すか」の設定であって、距離の
   設定ではない ―― このファイルの関数はどれも camAutoOn を引数に
   取らない。取らないこと自体が「独立している」の実体。 */
test('距離の切り替えは camAutoOn と独立している(仕様 17)', async t=>{
  await t.test('向きに関わるものを一切公開していない', async ()=>{
    const mod = await import('../../src/core/battle-camera.js');
    const names = Object.keys(mod);
    ['auto','yaw','rotate','invert'].forEach(word=>{
      const hit = names.filter(n=> n.toLowerCase().includes(word));
      assert.deepEqual(hit, [], `向きの語 "${word}" を含む輸出がある: ${hit}`);
    });
    // 距離と高さだけを扱っていること
    assert.ok(names.includes('cameraProfileAt'));
    assert.ok(names.includes('stepCombatCamBlend'));
  });

  await t.test('同じ入力なら同じ結果 ―― 外の設定に左右されない', ()=>{
    const a = stepCombatCamBlend(0.2, true, 1/60);
    const b = stepCombatCamBlend(0.2, true, 1/60);
    assert.equal(a, b);
    assert.deepEqual(cameraProfileAt(0.4, 0.3), cameraProfileAt(0.4, 0.3));
  });
});

test('階層別カメラの拡張余地(仕様 19)', async t=>{
  await t.test('4階層すべてに表がある', ()=>{
    ['normal','elite','named','boss'].forEach(k=>{
      assert.ok(CAMERA_TIER[k], `${k} が無い`);
    });
  });

  await t.test('Chapter 1 では通常敵・強モブ・ネームドが同じ値 ―― 過剰な演出を入れない', ()=>{
    assert.deepEqual(cameraTierParams('elite'), cameraTierParams('normal'));
    assert.deepEqual(cameraTierParams('named'), cameraTierParams('normal'));
  });

  await t.test('知らない階層は通常敵扱い(安全側)', ()=>{
    assert.equal(cameraTierParams('nope'), CAMERA_TIER.normal);
    assert.equal(cameraTierParams(), CAMERA_TIER.normal);
  });

  await t.test('階層ごとに上限を差し替えられる形になっている', ()=>{
    const half = targetDistanceBonus(99, cameraTierParams('normal').distBonusMax/2);
    assert.ok(Math.abs(half - COMBAT_DIST_BONUS_MAX/2) < 1e-9);
  });
});
