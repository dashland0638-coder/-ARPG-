import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASS_IDLE, JOB_IDLE_PROFILE, JOB_IDLE_MUL,
  idleProfile, hasDedicatedIdleProfile, combatIdleOffsets, buildCombatIdleTarget,
} from '../../src/core/combat-stance.js';

/* 魔導士(Mage Lord)の Combat Idle。
   魔法使い(Mage)= Focus に対して 魔導士 = Control という差を、
   「数値だけの上位互換」ではない形で付ける ―― という要求の検査。

   05-rendering-rig.js の STANCE.mage と同じ値。魔導士は魔法使いの
   構えをそのまま継承するので、両者の比較はこの1つの構えの上で行う。 */
const MAGE_STANCE = {
  waist:[0.01, 0.04, 0],
  shL:[-0.62, 0.06, 0.34], elL:-0.90,
  shR:[-0.12, 0.00,-0.10], elR:-0.34,
  hipL:0.03, hipR:-0.03, kneeL:0.06, kneeR:0.06,
  grip:'R',
};

const MAGE = idleProfile('mage', null);
const LORD = idleProfile('mage', 'archmage');

/* 1周期を等間隔に刻んで、あるチャンネルの最大振幅を測る。
   sin の位相がチャンネルごとに違うので、1点だけ見ても比較にならない */
function amplitude(profile, pick, samples = 720){
  let max = 0;
  for(let i=0;i<samples;i++){
    // profile.rate が違っても同じ「位相の1周」を見るため、rate で割って渡す
    const phase = (i/samples) * (Math.PI*2/0.55) / (profile.rate || 1);
    const v = pick(combatIdleOffsets(phase, profile, 1, 1));
    const a = Math.abs(v || 0);
    if(a > max) max = a;
  }
  return max;
}

test('魔導士は専用の Idle Profile を持つ', async t=>{
  await t.test('倍率表ではなく専用プロファイルから来ている', ()=>{
    assert.ok(JOB_IDLE_PROFILE.archmage, '専用プロファイルが無い');
    assert.ok(hasDedicatedIdleProfile('archmage'));
    // 倍率表から外れていること ―― 両方に載っていると直す側を間違える
    assert.equal(JOB_IDLE_MUL.archmage, undefined, '倍率表にも魔導士が残っている');
    // 魔法使いの係数そのままでもない = 本当に別のプロファイル
    assert.notEqual(LORD.weapon, CLASS_IDLE.mage.weapon);
    assert.notEqual(LORD.sway, CLASS_IDLE.mage.sway);
    assert.notEqual(LORD.breath, CLASS_IDLE.mage.breath);
  });

  await t.test('他の職は専用プロファイルを持たない(従来どおり倍率表)', ()=>{
    ['battleKnight','berserker','hawkEye', null, undefined, 'unknown'].forEach(job=>{
      assert.equal(hasDedicatedIdleProfile(job), false, `${job} に専用プロファイルが生えている`);
    });
    // 既存4職 + 他の上位職の係数が1つも変わっていないこと
    assert.deepEqual(idleProfile('warrior', null), Object.assign({}, CLASS_IDLE.warrior));
    assert.deepEqual(idleProfile('mage', null), Object.assign({}, CLASS_IDLE.mage));
    assert.deepEqual(idleProfile('archer', null), Object.assign({}, CLASS_IDLE.archer));
    assert.deepEqual(idleProfile('rogue', null), Object.assign({}, CLASS_IDLE.rogue));
    assert.equal(idleProfile('warrior','battleKnight').rate,
                 CLASS_IDLE.warrior.rate * JOB_IDLE_MUL.battleKnight.rate);
    assert.equal(idleProfile('archer','hawkEye').sway,
                 CLASS_IDLE.archer.sway * JOB_IDLE_MUL.hawkEye.sway);
  });
});

test('魔導士は魔法使いより遅い', ()=>{
  assert.ok(LORD.rate < MAGE.rate, `魔導士 ${LORD.rate} が魔法使い ${MAGE.rate} より速い`);
  // 設計の目安: 魔法使いの 0.65〜0.85 倍
  const ratio = LORD.rate / MAGE.rate;
  assert.ok(ratio >= 0.65 && ratio <= 0.85, `速度比が目安の外: ${ratio}`);
});

test('魔導士は魔法使いより重心の振幅が小さい', ()=>{
  assert.ok(LORD.sway < MAGE.sway, '重心の係数が魔法使い以上');
  const ratio = LORD.sway / MAGE.sway;
  assert.ok(ratio >= 0.50 && ratio <= 0.70, `重心比が設計(50〜70%)の外: ${ratio}`);
  // 実際に出てくる腰の roll / 横移動でも小さいこと(係数だけでなく結果で見る)
  assert.ok(amplitude(LORD, o=>o.waistRoll) < amplitude(MAGE, o=>o.waistRoll));
  assert.ok(amplitude(LORD, o=>o.waistShift) < amplitude(MAGE, o=>o.waistShift));
});

test('魔導士は上下する呼吸(vertical lean)を出さない', ()=>{
  assert.equal(LORD.breath, 0, '呼吸チャンネルが残っている');
  assert.equal(amplitude(LORD, o=>o.waistPitch), 0, '腰 pitch が動いている');
  // buildCombatIdleTarget を通しても、腰の前後傾は構えの値のまま
  for(const phase of [0, 0.7, 1.9, 4.4, 9.1]){
    const { target } = buildCombatIdleTarget(MAGE_STANCE, LORD, phase, 1, 2.4, 'archmage');
    assert.equal(target.waist[0], MAGE_STANCE.waist[0],
      `phase=${phase} で腰の pitch が動いた`);
  }
});

test('杖の揺れが設計レンジに収まっている(Staff movement safe)', ()=>{
  assert.ok(LORD.weapon >= 0.015 && LORD.weapon <= 0.025,
    `杖の振幅 ${LORD.weapon} が設計(±0.015〜0.025rad)の外`);
  // 魔法使いより小さい ―― 「制御している」ので先端が泳がない
  assert.ok(LORD.weapon < MAGE.weapon, '杖が魔法使いより揺れている');
  const amp = amplitude(LORD, o=>o.weaponSway);
  assert.ok(amp <= 0.025 + 1e-9, `実測振幅 ${amp} が上限を超えた`);
});

test('左手・手首の専用チャンネル(Left hand movement safe)', async t=>{
  await t.test('魔導士だけが持つ', ()=>{
    assert.ok(LORD.handL > 0 && LORD.wrist > 0);
    const o = combatIdleOffsets(1.3, LORD, 1, 1);
    assert.equal(typeof o.handSway, 'number');
    assert.equal(typeof o.wristSway, 'number');
    // 他の職では生えない = 既存の計算が1ビットも変わらない
    ['warrior','rogue','mage','archer'].forEach(cls=>{
      const p = idleProfile(cls, null);
      const oo = combatIdleOffsets(1.3, p, 1, 1);
      assert.equal(oo.handSway, undefined, `${cls} に左手チャンネルが生えた`);
      assert.equal(oo.wristSway, undefined, `${cls} に手首チャンネルが生えた`);
    });
  });

  await t.test('腕を振るのではなく、微動に留まる', ()=>{
    // 左手は杖より小さく動く(優先順位: 杖 > 手首 > 左手)
    assert.ok(LORD.handL < LORD.weapon, '左手が杖より大きく動く');
    assert.ok(LORD.wrist < LORD.weapon, '手首が杖より大きく動く');
    const hand = amplitude(LORD, o=>o.handSway);
    assert.ok(hand <= 0.02 + 1e-9, `左手の振幅 ${hand} が大きすぎる(腕を振っている)`);
  });

  await t.test('杖と左手が同位相で動かない(腕ごと揺れて見えない)', ()=>{
    /* 同位相なら「揺れが最大になる瞬間」が一致する。ずれていることを、
       1周期ぶんの相関で見る ―― 完全に同位相なら相関は 1 に張り付く */
    let dot = 0, na = 0, nb = 0;
    for(let i=0;i<720;i++){
      const phase = (i/720) * (Math.PI*2/0.90) / LORD.rate;
      const o = combatIdleOffsets(phase, LORD, 1, 1);
      dot += o.weaponSway * o.handSway;
      na += o.weaponSway * o.weaponSway;
      nb += o.handSway * o.handSway;
    }
    const corr = dot / Math.sqrt(na*nb);
    assert.ok(Math.abs(corr) < 0.9, `杖と左手がほぼ同位相(相関 ${corr})`);
  });
});

test('buildCombatIdleTarget: 魔導士でも構えそのものは壊れない', async t=>{
  await t.test('揺れないチャンネルは構えのまま', ()=>{
    const { target } = buildCombatIdleTarget(MAGE_STANCE, LORD, 2.0, 1, 1, 'archmage');
    assert.equal(target.waist[1], MAGE_STANCE.waist[1]);   // yaw は触らない
    assert.equal(target.hipL, MAGE_STANCE.hipL);
    assert.equal(target.hipR, MAGE_STANCE.hipR);
    assert.equal(target.kneeL, MAGE_STANCE.kneeL);
    assert.equal(target.kneeR, MAGE_STANCE.kneeR);
    assert.equal(target.grip, MAGE_STANCE.grip);           // Combat 中も右手杖のまま
  });
  await t.test('ウェイト0なら構えそのもの', ()=>{
    const { target } = buildCombatIdleTarget(MAGE_STANCE, LORD, 2.0, 0, 1, 'archmage');
    assert.deepEqual(target.waist, MAGE_STANCE.waist);
    assert.deepEqual(target.shL, MAGE_STANCE.shL);
    assert.deepEqual(target.shR, MAGE_STANCE.shR);
    assert.equal(target.elL, MAGE_STANCE.elL);
    assert.equal(target.elR, MAGE_STANCE.elR);
    assert.equal(target.drop, 0);
  });
  await t.test('元の構えオブジェクトを書き換えない', ()=>{
    const before = JSON.parse(JSON.stringify(MAGE_STANCE));
    buildCombatIdleTarget(MAGE_STANCE, LORD, 1.0, 1, 2.4, 'archmage');
    assert.deepEqual(MAGE_STANCE, before);
  });

  await t.test('振り終わり直後(settleBoost=2.4)でも肩の変位が小さい', ()=>{
    /* 資料 16 章「魔法発動 → 手・杖 → ゆっくり収束 → Combat Idle」。
       Attack Clip は一切変えず、収束は Combat Idle の側だけで作るので、
       その最大振幅が「大きく動かさない」に収まっているかを見る。 */
    let maxShR = 0, maxShL = 0;
    for(let i=0;i<720;i++){
      const phase = (i/720) * (Math.PI*2/0.55) / LORD.rate;
      const { target } = buildCombatIdleTarget(MAGE_STANCE, LORD, phase, 1, 2.4, 'archmage');
      maxShR = Math.max(maxShR, Math.abs(target.shR[0] - MAGE_STANCE.shR[0]));
      maxShL = Math.max(maxShL, Math.abs(target.shL[0] - MAGE_STANCE.shL[0]));
    }
    assert.ok(maxShR <= 0.07, `杖側の肩が ${maxShR}rad 動く(大きすぎる)`);
    assert.ok(maxShL <= 0.07, `左肩が ${maxShL}rad 動く(大きすぎる)`);
  });
});

/* =========================================================
   Projectile 回帰(資料 21 章)

   過去に「魔法使いの杖の高さを変えたら魔弾が当たらなくなった」という
   事故があった。魔弾の出どころは projectileOrigin()(11-combat-actions.js)
   で、魔法使い/魔導士は P.weaponTip ―― 杖メッシュの先端ノードのワールド
   座標。杖は握っている手に追従するので、肩と肘を動かせば杖先も動く。

   では Combat Idle がその位置に効くのか ―― コードを追うと「効く」。
   applyCombatPose() は

       if(state.swinging)      → クリップのポーズ
       else if(ultAiming)      → …
       else if(skillCharging)  → …
       else if(combatStanceT>0)→ applyCombatIdlePose()

   という排他の if/else なので、振っている最中に Combat Idle は当たらない。
   ところが魔法使い/魔導士は impactFrac に載っていないため hitDelay=0 で、
   swingOnce()(= 弾の生成)は **攻撃入力のフレームでその場で** 走る
   (11-combat-actions.js)。その瞬間リグに乗っているのは、まだ今フレームの
   applyCombatPose を通っていない **前フレームの姿勢** ―― つまり直前まで
   当たっていた Combat Idle のポーズ。コンボ1段目の弾は Combat Idle の
   振幅の影響を受ける。

   だからここでは2つを固定する:
     1. Combat Idle が構えの tip / grip を書き換えないこと(下のテスト)
     2. 新しい魔導士プロファイルの杖側の振幅が、変更前(魔法使いの係数 ×
        JOB_IDLE_MUL.archmage)を上回らないこと(さらに下のテスト)
   実際の当たり判定の回帰は tests/base-class-identity.spec.js と
   tests/character-motion.spec.js が実機で見る。
========================================================= */
test('projectile origin: 構えの tip / grip が変わっていない', ()=>{
  // 05-rendering-rig.js の STANCE.mage 実測値。ここが動いたら杖先も動く
  const MAGE_TIP = 0.46;
  const MAGE_GRIP = 'R';
  assert.equal(MAGE_STANCE.grip, MAGE_GRIP);
  // Combat Idle は tip も grip も出力に含めない = 触りようがない
  const { target } = buildCombatIdleTarget(
    Object.assign({tip:MAGE_TIP}, MAGE_STANCE), LORD, 3.3, 1, 2.4, 'archmage');
  assert.equal(target.tip, MAGE_TIP, 'Combat Idle が tip を書き換えた');
  assert.equal(target.grip, MAGE_GRIP, 'Combat Idle が grip を書き換えた');
});

/* projectileOrigin() は「弾を撃つ瞬間の杖先のワールド座標」を読む。
   swingOnce() は入力フレームで即座に走る(魔法使い/魔導士は
   impactFrac にエントリが無く hitDelay=0 ―― 11-combat-actions.js)ので、
   その時点でリグに乗っているのは **前フレームの姿勢** = 直前まで
   当たっていた Combat Idle のポーズ。つまり Combat Idle の振幅は、
   間接的にではあるが魔弾の出どころに効く。

   ここでは「新しい魔導士プロファイルが、以前の魔導士(魔法使いの係数 ×
   JOB_IDLE_MUL.archmage)より杖側を動かさない」ことを固定する。
   小さくなっているぶんには、過去の事故(杖の高さが変わって当たらなく
   なった)の方向へは決して動かない。 */
test('projectile origin: 杖側の振幅が旧・魔導士プロファイルを上回らない', ()=>{
  /* 変更前の魔導士 = 魔法使いの係数に、当時 JOB_IDLE_MUL にあった
     {weapon:1.35, rate:0.78} を掛けたもの。倍率表からは外したので
     (JOB_IDLE_PROFILE の説明を参照)、ここに当時の値を写してある */
  const PREV = {
    sway:   CLASS_IDLE.mage.sway,
    breath: CLASS_IDLE.mage.breath,
    weapon: CLASS_IDLE.mage.weapon * 1.35,
    rate:   CLASS_IDLE.mage.rate   * 0.78,
    crouch: CLASS_IDLE.mage.crouch,
  };

  /* 杖先の動きに効くチャンネルの、構えからの最大ずれ。
     shR(肩)・elR(肘)・waist(腰)の3つで、settleBoost の最大(2.4)を
     掛けた最悪ケースを見る。前腕・上腕の長さを掛けずに角度のまま
     比べているが、同じ骨格・同じ構えの比較なので大小関係は変わらない。 */
  function staffChannelPeak(profile){
    let peak = {shR:0, elR:0, waistPitch:0, drop:0};
    for(let i=0;i<720;i++){
      const phase = (i/720) * (Math.PI*2/0.55) / profile.rate;
      const { target } = buildCombatIdleTarget(MAGE_STANCE, profile, phase, 1, 2.4, 'archmage');
      // shR は pitch(x)と手首の roll(z)の両方が乗りうるので合算で見る
      const shR = Math.abs(target.shR[0] - MAGE_STANCE.shR[0])
                + Math.abs(target.shR[2] - MAGE_STANCE.shR[2]);
      peak.shR = Math.max(peak.shR, shR);
      peak.elR = Math.max(peak.elR, Math.abs(target.elR - MAGE_STANCE.elR));
      peak.waistPitch = Math.max(peak.waistPitch, Math.abs(target.waist[0] - MAGE_STANCE.waist[0]));
      peak.drop = Math.max(peak.drop, Math.abs(target.drop));
    }
    return peak;
  }

  const prev = staffChannelPeak(PREV);
  const now  = staffChannelPeak(LORD);

  assert.ok(now.shR <= prev.shR,
    `杖側の肩が旧プロファイルより動く: ${now.shR} > ${prev.shR}`);
  assert.ok(now.elR <= prev.elR,
    `杖側の肘が旧プロファイルより動く: ${now.elR} > ${prev.elR}`);
  // 杖先の「高さ」に直結する2つ。呼吸を切ったので腰の前後傾はゼロになる
  assert.equal(now.waistPitch, 0, '腰の前後傾が残っている(杖先の高さが揺れる)');
  assert.ok(now.waistPitch <= prev.waistPitch);
  assert.ok(now.drop <= prev.drop, '沈み込みが旧プロファイルより大きい');
});
