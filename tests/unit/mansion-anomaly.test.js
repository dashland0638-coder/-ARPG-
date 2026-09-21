/* 森の洋館の空間異常(D-01)と鍛冶屋との分離(D-02)の判定。

   ここが固定するのは「順番と段階」であって、部屋の座標ではない ――
   座標は MANSION_ROOMS(03-dungeons-mansion-temple.js)が唯一の情報源で、
   世界が実際に組み上がることは tests/mansion-scenario.spec.js が見ている。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANOMALY, ESCORT, ROOM_ANOMALY_STAGE,
  roomAnomalyStage, isAnomalyRoom, anomalyLampMods, coolShift,
  shouldSeparate, shouldReunite, escortFollows, escortFollowStep,
  ESCORT_STOP_DIST, ESCORT_RUN_DIST, ESCORT_WARP_DIST,
} from '../../src/core/mansion-anomaly.js';

test('異変は段階的に強くなる(仕様 5)', async t=>{
  await t.test('前半の洋館は普通の建物', ()=>{
    ['mEntry','mFoyer','mDining','mKitchen','mCor1','mHall','mStair'].forEach(id=>{
      assert.equal(roomAnomalyStage(id), ANOMALY.NORMAL, id);
    });
  });

  await t.test('二階は痕跡、一階奥は歪み ―― 前半より強い', ()=>{
    assert.equal(roomAnomalyStage('uCor'), ANOMALY.TRACES);
    assert.equal(roomAnomalyStage('sQuart'), ANOMALY.WARPED);
    assert.ok(roomAnomalyStage('uCor') > roomAnomalyStage('mFoyer'));
    assert.ok(roomAnomalyStage('sQuart') > roomAnomalyStage('uCor'));
  });

  await t.test('異常空間が最も強い', ()=>{
    ['xFoyer','xCor','xHall'].forEach(id=>{
      assert.equal(roomAnomalyStage(id), ANOMALY.BROKEN, id);
    });
    assert.ok(roomAnomalyStage('xFoyer') > roomAnomalyStage('sQuart'));
  });

  await t.test('プレイヤーが通る順に段階が下がらない', ()=>{
    const route = ['mEntry','mFoyer','mCor1','mHall','mStair',
                   'uLand','uCor','uWork',
                   'sLand','sCor','sQuart','sDown',
                   'xFoyer','xCor','xHall'];
    let prev = -1;
    route.forEach(id=>{
      const s = roomAnomalyStage(id);
      assert.ok(s >= prev, `${id} で段階が下がった (${prev} → ${s})`);
      prev = s;
    });
  });

  await t.test('知らない部屋は正常扱い(安全側)', ()=>{
    assert.equal(roomAnomalyStage('nope'), ANOMALY.NORMAL);
    assert.equal(roomAnomalyStage(undefined), ANOMALY.NORMAL);
  });

  await t.test('異常空間の部屋は id の頭文字で判る', ()=>{
    assert.equal(isAnomalyRoom('xFoyer'), true);
    assert.equal(isAnomalyRoom('mFoyer'), false);
    assert.equal(isAnomalyRoom(null), false);
    // 表の x* は全部 BROKEN
    Object.keys(ROOM_ANOMALY_STAGE).filter(isAnomalyRoom).forEach(id=>{
      assert.equal(ROOM_ANOMALY_STAGE[id], ANOMALY.BROKEN, id);
    });
  });
});

test('照明の狂いと、ボス撃破後の正常化(仕様 10)', async t=>{
  await t.test('段階が上がるほど暗く、狭く、冷たくなる', ()=>{
    for(let s=1; s<=ANOMALY.BROKEN; s++){
      const a = anomalyLampMods(s-1, false), b = anomalyLampMods(s, false);
      assert.ok(b.intensity < a.intensity, `stage ${s} の明るさ`);
      assert.ok(b.dist < a.dist, `stage ${s} の届く距離`);
      assert.ok(b.cool > a.cool, `stage ${s} の冷たさ`);
    }
  });

  await t.test('正常段階は等倍(元の見た目のまま)', ()=>{
    const m = anomalyLampMods(ANOMALY.NORMAL, false);
    assert.equal(m.intensity, 1);
    assert.equal(m.dist, 1);
    assert.equal(m.cool, 0);
  });

  await t.test('normalized なら、どの段階でも等倍へ戻る', ()=>{
    [0,1,2,3].forEach(s=>{
      assert.deepEqual(anomalyLampMods(s, true), anomalyLampMods(ANOMALY.NORMAL, false));
    });
  });

  await t.test('範囲外の段階でも落ちない', ()=>{
    assert.ok(anomalyLampMods(99, false));
    assert.ok(anomalyLampMods(-5, false));
  });

  await t.test('cool=0 は色をそのまま返す', ()=>{
    assert.equal(coolShift(0xffcf8a, 0), 0xffcf8a);
  });

  await t.test('cool を上げるほど暖色が青灰へ寄る', ()=>{
    const warm = 0xffcf8a;
    const red = c => (c >> 16) & 0xff;
    const blue = c => c & 0xff;
    const mid = coolShift(warm, 0.5), full = coolShift(warm, 1);
    assert.ok(red(mid) < red(warm));
    assert.ok(red(full) < red(mid));
    assert.ok(blue(full) > blue(warm));
  });
});

test('鍛冶屋との分離(D-02)', async t=>{
  await t.test('同行中に扉へ着いたときだけ分離する', ()=>{
    assert.equal(shouldSeparate({escort:ESCORT.JOINED, atSplitDoor:true}), true);
  });

  await t.test('出会う前に扉へ行っても分離しない', ()=>{
    assert.equal(shouldSeparate({escort:ESCORT.NONE, atSplitDoor:true}), false);
  });

  await t.test('分離済みなら二度は起きない', ()=>{
    assert.equal(shouldSeparate({escort:ESCORT.SEPARATED, atSplitDoor:true}), false);
  });

  await t.test('扉に着いていなければ起きない', ()=>{
    assert.equal(shouldSeparate({escort:ESCORT.JOINED, atSplitDoor:false}), false);
  });

  await t.test('引数なしでも落ちない', ()=>{
    assert.equal(shouldSeparate(), false);
    assert.equal(shouldReunite(), false);
  });
});

test('ボス撃破後の再会(仕様 10)', async t=>{
  await t.test('分離したままボスを倒したときだけ再会する', ()=>{
    assert.equal(shouldReunite({bossDefeated:true, escort:ESCORT.SEPARATED}), true);
  });

  await t.test('ボスを倒す前は再会しない', ()=>{
    assert.equal(shouldReunite({bossDefeated:false, escort:ESCORT.SEPARATED}), false);
  });

  await t.test('再会済みなら二度は起きない', ()=>{
    assert.equal(shouldReunite({bossDefeated:true, escort:ESCORT.REUNITED}), false);
  });
});

/* 実機レビュー 4: 作業室で合流する前の場所(森の入口・二階入口)に
   鍛冶屋が立っていた。原因は repositionAlliesToPlayer() が世界へ入る
   たびに鍛冶屋をプレイヤーの後ろへ引きずっていたことで、同行状態を
   見ていなかったため。「どの状態なら動かしてよいか」はここが決める。 */
test('作業室で合流するまで、鍛冶屋は動かない(実機レビュー 4)', async t=>{
  await t.test('出会う前は付いて歩かない', ()=>{
    assert.equal(escortFollows(ESCORT.NONE), false);
  });

  await t.test('分離後も付いて歩かない ―― 無理に同行NPCとして維持しない', ()=>{
    assert.equal(escortFollows(ESCORT.SEPARATED), false);
  });

  await t.test('再会後も付いて歩かない(そこで洋館は終わる)', ()=>{
    assert.equal(escortFollows(ESCORT.REUNITED), false);
  });

  await t.test('同行中だけが true ―― 置き直してよいのもこの状態だけ', ()=>{
    const all = [ESCORT.NONE, ESCORT.JOINED, ESCORT.SEPARATED, ESCORT.REUNITED];
    assert.deepEqual(all.filter(escortFollows), [ESCORT.JOINED]);
  });
});

test('同行の追従(鍛冶屋は戦闘に関与しない)', async t=>{
  await t.test('付いて歩くのは同行中だけ', ()=>{
    assert.equal(escortFollows(ESCORT.JOINED), true);
    assert.equal(escortFollows(ESCORT.NONE), false);
    assert.equal(escortFollows(ESCORT.SEPARATED), false);
    assert.equal(escortFollows(ESCORT.REUNITED), false);
  });

  await t.test('近ければ止まる', ()=>{
    const r = escortFollowStep({dx:0, dz:ESCORT_STOP_DIST - 0.5, dt:1/60});
    assert.equal(r.moving, false);
    assert.equal(r.dx, 0);
    assert.equal(r.dz, 0);
  });

  await t.test('離れていれば詰める', ()=>{
    const r = escortFollowStep({dx:0, dz:6, dt:1/60});
    assert.equal(r.moving, true);
    assert.ok(r.dz > 0);
  });

  await t.test('止まる距離を割り込むほど行き過ぎない', ()=>{
    const start = ESCORT_STOP_DIST + 0.2;
    const r = escortFollowStep({dx:0, dz:start, dt:1});   // 大きなdtでも
    assert.ok(start - r.dz >= ESCORT_STOP_DIST - 1e-9,
      `行き過ぎている: 残り ${start - r.dz}`);
  });

  await t.test('遠いほど速い(駆け足)', ()=>{
    const near = escortFollowStep({dx:0, dz:ESCORT_RUN_DIST - 0.5, dt:1/60});
    const far  = escortFollowStep({dx:0, dz:ESCORT_RUN_DIST + 4, dt:1/60});
    assert.ok(far.dz > near.dz);
  });

  await t.test('階段テレポートのように離れたら、追わずに飛ぶ', ()=>{
    const r = escortFollowStep({dx:0, dz:ESCORT_WARP_DIST + 10, dt:1/60});
    assert.equal(r.warp, true);
    assert.equal(r.moving, false);
  });

  await t.test('進む向きを返す', ()=>{
    const r = escortFollowStep({dx:5, dz:0, dt:1/60});
    assert.ok(Math.abs(r.facing - Math.atan2(5,0)) < 1e-9);
  });

  await t.test('dt が 0 でも落ちない', ()=>{
    const r = escortFollowStep({dx:0, dz:10, dt:0});
    assert.equal(r.moving, false);
  });
});
