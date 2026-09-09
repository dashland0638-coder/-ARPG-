/* 戦闘以外の立ち姿と、抜刀 / 戦闘終了の余韻 / 納刀のクリップ。

   戦闘の構え(core/combat-stances.js)がこのゲームに元からあった唯一の
   姿勢で、酒場でもダンジョンでも敵の目の前でもそれ1つだった。ここは
   その足りていなかった残りの姿勢 ―― 「人物として立っている」
   「冒険者として警戒している」「武器を抜いている最中」「しまっている
   最中」 ―― をまとめた表。

   書式は core/combat-stances.js と同じで、05-rendering-rig.js の
   sampleClip() / applyPose() がそのまま読める。抜刀・納刀のクリップだけは
   終点に戦闘の構えを必要とするため、構えを引数に取る関数にしてある
   (サブ武器を装備すると構えそのものが変わるため)。

   追加のチャンネル:
     gripW  武器をどちらの手基準で置くか(0=右手, 0.5=両手の中点, 1=左手)。
            魔法使いが両手持ちから右手主体へ持ち替える時、離散的に
            切り替えると杖が 20cm 飛ぶ ―― これを連続値にしてある。

   three.js にも state にも依存しないので、tests/unit/motion-poses.test.js
   から core/pose-geometry.js に掛けて、途中のポーズまで含めて
   関節破綻・武器の身体貫通を測れる。 */

// クリップのキーフレーム(05-rendering-rig.js の F() と同じ)
function F(t, o) { const c = Object.assign({}, o); c.t = t; return c; }

const POSES = (() => {
  const rest = (o) => Object.assign({gripW:0.5, armSwing:1.0, hipL:0, hipR:0, kneeL:0.04, kneeR:0.04}, o);

  /* ---- 剣士: 背中の大剣。慣れた手つきで抜き、右側で構える ---- */
  const wExplore = rest({
    waist:[0.03, 0.00, 0.00],
    shL:[-0.10, 0.02, 0.16], elL:-0.34,
    shR:[-0.10,-0.02,-0.16], elR:-0.34,
    wep:[-0.42,-0.88,-0.22, 0.90,-0.43,0.00],
    hipL:0.02, hipR:-0.02, kneeL:0.07, kneeR:0.07, armSwing:0.85, gripW:0.5,
  });
  const wSocial = rest({
    waist:[0.00, 0.02, 0.00],
    shL:[-0.03, 0.02, 0.10], elL:-0.18,
    shR:[-0.03,-0.02,-0.10], elR:-0.18,
    wep:[-0.42,-0.88,-0.22, 0.90,-0.43,0.00],
    kneeL:0.03, kneeR:0.03, armSwing:1.00, gripW:0.5,
  });
  // 背中の柄を掴んだ形。両手を背へ回す
  const wReach = rest({
    waist:[0.00, 0.30, 0.02],
    shL:[ 1.049, 0.611, 0.506], elL:-0.910,
    shR:[ 2.107,-0.572,-0.292], elR:-2.087,
    wep:[-0.42,-0.88,-0.22, 0.90,-0.43,0.00],
    // 柄に掛かっているのは右手。両手の中点を基準にすると、握り位置が
    // 背骨の内側へ入ってしまう(この体格では両手が背中で近づきすぎる)
    hipL:0.04, hipR:-0.06, kneeL:0.12, kneeR:0.10, armSwing:0.30, gripW:0,
  });
  // 引き抜き。柄が右肩の上を通って前へ出る
  const wPull = rest({
    waist:[0.02, 0.22, 0.03],
    shL:[-1.092, 0.882, 0.588], elL:-0.816,
    shR:[-0.332,-0.571,-0.148], elR:-1.065,
    wep:[0.340,0.700,0.630, -0.870,0.000,0.480],
    hipL:0.05, hipR:-0.07, kneeL:0.14, kneeR:0.11, armSwing:0.25, gripW:0.35,
  });
  /* 引き抜きの頂点。両手が頭の上を通り、刃が背中から完全に離れる瞬間。
     ここを挟まないと、背中の柄を掴んだ手がそのまま胸を突き抜けて前へ
     出る補間になる(経路の問題なので、角度の微修正では直らない)。 */
  const wRaise = rest({
    waist:[0.00, 0.24, 0.02],
    shL:[ 1.105,-0.150, 0.248], elL:-1.851,
    shR:[ 0.763, 0.148,-0.274], elR:-2.427,
    wep:[0.180,0.520,-0.835, -0.560,0.740,0.340],
    hipL:0.05, hipR:-0.07, kneeL:0.14, kneeR:0.12, armSwing:0.25, gripW:0,
  });
  // 慣性で構えの少し先まで流れる。ここから戻って安定する
  const wOver = rest({
    waist:[0.07, 0.12, 0.02],
    shL:[-1.010, 0.760, 0.590], elL:-0.815,
    shR:[-0.458,-0.236,-0.338], elR:-0.730,
    wep:[0.300,0.600,0.740, -0.860,0.000,0.350],
    hipL:0.07, hipR:-0.07, kneeL:0.16, kneeR:0.13, armSwing:0.22, gripW:0.5,
  });
  /* 腕を体の脇から回すための中継ぎ。前で下ろした手をそのまま背中の目標へ
     補間すると、腕が胴体を突き抜けて反対側へ出てしまう ―― 関節の角度を
     いくら詰めても直らない種類の破綻なので、経路そのものを1フレーム足して
     外側を回らせる(tests/unit/motion-poses.test.js がクリップ全域を
     サンプリングしてここを見ている)。

     同じ理由で、引き抜き(wRaise)は右手主導にしてある。この体格では
     両手を背中に付けたまま胸の前まで持ってくる経路が存在せず、必ず
     どちらかの腕が胴を通る ―― 実際の抜き方としても、右手で引き抜いて
     刃が抜け切ってから左手を柄へ添える方が自然なので、gripW を
     0(右手)→0.35→0.5(両手)と連続的に戻して握り直しを表現している。 */
  const wSwing = rest({
    waist:[0.02, 0.16, 0.01],
    shL:[ 1.176, 0.534,-0.448], elL:-1.627,
    shR:[ 1.337,-0.152,-0.020], elR:-1.905,
    wep:[-0.42,-0.88,-0.22, 0.90,-0.43,0.00],
    hipL:0.03, hipR:-0.04, kneeL:0.10, kneeR:0.09, armSwing:0.40, gripW:0,
  });
  // 戦闘直後。刃を落ち着かせ、重心を戻す(納刀の入口でもある)
  const wSettle = rest({
    waist:[0.05, 0.14, 0.02],
    shL:[-0.980, 0.780, 0.600], elL:-0.860,
    shR:[-0.200,-0.400,-0.180], elR:-1.150,
    wep:[0.300,0.700,0.640, -0.860,0.000,0.400],
    hipL:0.04, hipR:-0.04, kneeL:0.09, kneeR:0.08, armSwing:0.30, gripW:0.5,
  });

  /* ---- 盗賊: 左右の腰の短剣。必ず左右同時 ---- */
  // 左右対称にするため、右腕の値を鏡映(x, -y, -z)して左腕に使う
  const mirror = (sh) => [sh[0], -sh[1], -sh[2]];
  const rHipR = [0.352,-0.719, 0.144], rHipEl = -0.971;
  const rPullR = [0.521, 0.381,-0.361], rPullEl = -1.737;
  const rExplore = rest({
    waist:[0.04, 0.00, 0.00],
    shL:[-0.14, 0.04, 0.20], elL:-0.42,
    shR:[-0.14,-0.04,-0.20], elR:-0.42,
    wep:[0.100,-0.900,-0.420, 0.990,0.100,0.000],
    hipL:0.03, hipR:-0.03, kneeL:0.10, kneeR:0.10, armSwing:0.95, gripW:0,
  });
  const rSocial = rest({
    waist:[0.00, 0.03, 0.00],
    shL:[-0.05, 0.03, 0.12], elL:-0.22,
    shR:[-0.05,-0.03,-0.12], elR:-0.22,
    wep:[0.100,-0.900,-0.420, 0.990,0.100,0.000],
    kneeL:0.04, kneeR:0.04, armSwing:1.05, gripW:0,
  });
  // 腰を落として両手を同時に柄へ。ここが盗賊の抜刀の核
  const rCrouch = rest({
    waist:[0.14, 0.00, 0.00],
    shL:mirror(rHipR), elL:rHipEl,
    shR:rHipR,         elR:rHipEl,
    wep:[0.100,-0.900,-0.420, 0.990,0.100,0.000],
    hipL:0.16, hipR:-0.16, kneeL:0.42, kneeR:0.42, armSwing:0.20, gripW:0,
  });
  // 両短剣を同時に、それぞれ外側へ引き抜く(体の前で交差させない)
  const rPull = rest({
    waist:[0.12, 0.00, 0.00],
    shL:mirror(rPullR), elL:rPullEl,
    shR:rPullR,          elR:rPullEl,
    wep:[0.220,0.180,0.958, -0.100,0.980,-0.160],
    hipL:0.14, hipR:-0.14, kneeL:0.36, kneeR:0.36, armSwing:0.20, gripW:0,
  });
  const rSettle = rest({
    waist:[0.08, 0.10, 0.00],
    shL:[-0.60, 0.08, 0.34], elL:-1.05,
    shR:[-0.40,-0.06,-0.26], elR:-0.85,
    wep:[0.140,0.200,0.970, -0.050,0.975,-0.208],
    hipL:0.08, hipR:-0.10, kneeL:0.22, kneeR:0.20, armSwing:0.40, gripW:0,
  });

  /* ---- 魔法使い: 杖はしまわない。両手持ち ↔ 右手主体の持ち替え ---- */
  const mExplore = rest({
    waist:[0.01, 0.04, 0.00],
    shL:[-0.853, 0.729, 0.480], elL:-1.033,
    shR:[-0.249,-0.505,-0.068], elR:-0.872,
    wep:[-0.873,0.480,0.087, 0.440,0.878,0.000],
    hipL:0.02, hipR:-0.02, kneeL:0.05, kneeR:0.05, armSwing:0.30, gripW:0.5,
  });
  const mSocial = rest({
    waist:[0.00, 0.05, 0.00],
    shL:[-0.811, 0.917, 0.381], elL:-1.071,
    shR:[-0.217,-0.457,-0.095], elR:-0.831,
    wep:[-0.899,0.428,0.086, 0.393,0.919,0.000],
    kneeL:0.03, kneeR:0.03, armSwing:0.35, gripW:0.5,
  });
  // 左手が杖から離れる途中。杖はまだ両手の間にある
  const mRelease = rest({
    waist:[0.02, 0.00, 0.00],
    shL:[-1.032, 1.019, 0.350], elL:-0.780,
    shR:[-0.161, 0.013,-0.240], elR:-0.733,
    wep:[-0.480,0.820,0.310, 0.863,0.505,0.000],
    hipL:0.03, hipR:-0.03, kneeL:0.06, kneeR:0.06, armSwing:0.50, gripW:0.24,
  });
  // 集中を解いた直後。左手はまだ前にあるが、力は抜けている
  const mSettle = rest({
    waist:[0.02,-0.03, 0.00],
    shL:[-0.975, 0.850, 0.339], elL:-0.640,
    shR:[-0.104,-0.768, 0.148], elR:-0.846,
    wep:[0.100,0.902,0.421, 0.994,-0.110,0.000],
    hipL:0.03, hipR:-0.03, kneeL:0.06, kneeR:0.06, armSwing:0.70, gripW:0,
  });

  /* ---- 弓師: 収納 ↔ 手。納刀は残心を含む ---- */
  const aExplore = rest({
    waist:[0.03, 0.00, 0.00],
    shL:[-0.12, 0.03, 0.18], elL:-0.38,
    shR:[-0.12,-0.03,-0.18], elR:-0.38,
    wep:[0.380,0.860,-0.340, 0.000,0.000,-1.000],
    hipL:0.03, hipR:-0.03, kneeL:0.07, kneeR:0.07, armSwing:0.90, gripW:1, draw:0,
  });
  const aSocial = rest({
    waist:[0.00, 0.02, 0.00],
    shL:[-0.04, 0.02, 0.11], elL:-0.20,
    shR:[-0.04,-0.02,-0.11], elR:-0.20,
    wep:[0.380,0.860,-0.340, 0.000,0.000,-1.000],
    kneeL:0.03, kneeR:0.03, armSwing:1.00, gripW:1, draw:0,
  });
  // 背中の弓を左手で取る
  const aTake = rest({
    waist:[0.02, 0.14, 0.00],
    shL:[1.181, 0.509, 0.125], elL:-1.109,
    shR:[-0.20,-0.10,-0.24], elR:-0.60,
    wep:[0.380,0.860,-0.340, 0.000,0.000,-1.000],
    hipL:0.04, hipR:-0.06, kneeL:0.09, kneeR:0.08, armSwing:0.35, gripW:1, draw:0,
  });
  // 弓を前へ回し、半身へ入っていく途中
  const aPresent = rest({
    waist:[0.02, 0.30, 0.00],
    shL:[-0.655, 0.326, 0.355], elL:-0.952,
    shR:[-0.700,-0.560,-0.140], elR:-2.200,
    wep:[0.260,0.966,0.000, 0.000,0.000,-1.000],
    hipL:0.05, hipR:-0.10, kneeL:0.11, kneeR:0.09, armSwing:0.45, gripW:1, draw:0.04,
  });
  // 弓を体の脇から前へ回す中継ぎ(剣士の wSwing と同じ理由)
  const aSwing = rest({
    waist:[0.02, 0.22, 0.00],
    shL:[ 0.388,-0.018,-0.240], elL:-1.993,
    shR:[-0.22,-0.30,-0.26], elR:-1.10,
    // 弓の上弦を体の外(左)へ倒す。内へ倒すと、前へ回す途中で上弦が
    // 胸の前を横切ってしまう
    wep:[-0.360,0.900,-0.240, 0.000,0.000,-1.000],
    hipL:0.05, hipR:-0.08, kneeL:0.10, kneeR:0.08, armSwing:0.40, gripW:1, draw:0,
  });
  // 撃ち終えた直後。弓は下ろすが、半身と的への向きは崩さない
  const aSettle = rest({
    waist:[0.02, 0.42, 0.00],
    shL:[-0.900, 0.560, 0.400], elL:-0.700,
    shR:[-0.880,-0.560,-0.140], elR:-2.150,
    wep:[0.320,0.945,0.000, 0.000,0.000,-1.000],
    hipL:0.06, hipR:-0.14, kneeL:0.12, kneeR:0.09, armSwing:0.45, gripW:1, draw:0,
  });
  // 残心。弓は既に収まっているが、半身と的への意識だけが残っている
  const aZanshin = rest({
    waist:[0.02, 0.38, 0.00],
    shL:[-0.30, 0.12, 0.26], elL:-0.55,
    shR:[-0.22,-0.10,-0.22], elR:-0.50,
    wep:[0.380,0.860,-0.340, 0.000,0.000,-1.000],
    hipL:0.05, hipR:-0.11, kneeL:0.10, kneeR:0.08, armSwing:0.40, gripW:1, draw:0,
  });

  // 中間の立ち姿も名前つきで外へ出す ―― 抜刀/納刀の途中のポーズにも
  // 関節破綻や貫通が無いことを tests/unit/motion-poses.test.js が測るため
  const named = {
    'warrior.explore': wExplore, 'warrior.social': wSocial, 'warrior.reach': wReach,
    'warrior.pull': wPull, 'warrior.overshoot': wOver, 'warrior.settle': wSettle,
    'warrior.swing': wSwing, 'warrior.raise': wRaise,
    'rogue.explore': rExplore, 'rogue.social': rSocial, 'rogue.crouch': rCrouch,
    'rogue.pull': rPull, 'rogue.settle': rSettle,
    'mage.explore': mExplore, 'mage.social': mSocial, 'mage.release': mRelease,
    'mage.settle': mSettle,
    'archer.explore': aExplore, 'archer.social': aSocial, 'archer.take': aTake,
    'archer.present': aPresent, 'archer.settle': aSettle, 'archer.zanshin': aZanshin,
    'archer.swing': aSwing,
  };
  return {
    named,
    warrior: {
      social: wSocial, explore: wExplore, settle: wSettle,
      /* 抜刀: 両手を背中へ → 掴む → 引き抜く → 慣性で少し流れる → 構える。
         grabFrac(0.40)の前後で武器が背中から手へ渡るので、手が柄に
         届いていない間に大剣が動き出すことはない。 */
      draw: (combat) => [
        F(0.00, Object.assign({}, wExplore, {e:'slow'})),
        F(0.16, Object.assign({}, wSwing,   {e:'snap'})),
        F(0.36, Object.assign({}, wReach,   {e:'snap'})),
        F(0.50, Object.assign({}, wReach,   {e:'slow', waist:[0.02,0.24,0.02]})),
        F(0.62, Object.assign({}, wRaise,   {e:'snap'})),
        F(0.78, Object.assign({}, wPull,    {e:'settle'})),
        F(0.88, Object.assign({}, wOver,    {e:'settle'})),
        F(1.00, Object.assign({}, combat)),
      ],
      post: (combat) => [
        F(0.00, Object.assign({}, combat, {e:'settle'})),
        F(0.55, Object.assign({}, wOver,   {e:'smooth'})),
        F(1.00, Object.assign({}, wSettle)),
      ],
      sheathe: () => [
        F(0.00, Object.assign({}, wSettle, {e:'smooth'})),
        F(0.30, Object.assign({}, wPull,   {e:'smooth'})),
        F(0.52, Object.assign({}, wRaise,  {e:'smooth'})),
        F(0.70, Object.assign({}, wReach,  {e:'smooth'})),
        F(0.86, Object.assign({}, wSwing,  {e:'settle'})),
        F(1.00, Object.assign({}, wExplore)),
      ],
    },
    rogue: {
      social: rSocial, explore: rExplore, settle: rSettle,
      /* 抜刀: 腰を落とす → 両手同時に腰へ → 両短剣を同時に引き抜く → 構える。
         左右の腕は常に鏡映の値なので、片手だけ先に動くことがない。 */
      draw: (combat) => [
        F(0.00, Object.assign({}, rExplore, {e:'snap'})),
        F(0.34, Object.assign({}, rCrouch,  {e:'snap'})),
        F(0.66, Object.assign({}, rPull,    {e:'settle'})),
        F(1.00, Object.assign({}, combat)),
      ],
      post: (combat) => [
        F(0.00, Object.assign({}, combat, {e:'settle'})),
        F(1.00, Object.assign({}, rSettle)),
      ],
      sheathe: () => [
        F(0.00, Object.assign({}, rSettle, {e:'smooth'})),
        F(0.34, Object.assign({}, rPull,   {e:'smooth'})),
        F(0.66, Object.assign({}, rCrouch, {e:'settle'})),
        F(1.00, Object.assign({}, rExplore)),
      ],
    },
    mage: {
      social: mSocial, explore: mExplore, settle: mSettle,
      /* 「抜刀」ではなく持ち替え: 両手持ち → 左手を離す → 右手片手持ち +
         左手を敵方向へ。gripW が 0.5 から 0 へ連続的に動くので、杖が
         両手の中点から右手へ飛ぶことがない。 */
      draw: (combat) => [
        F(0.00, Object.assign({}, mExplore, {e:'slow'})),
        F(0.42, Object.assign({}, mRelease, {e:'settle'})),
        F(1.00, Object.assign({}, combat)),
      ],
      post: (combat) => [
        F(0.00, Object.assign({}, combat, {e:'settle'})),
        F(1.00, Object.assign({}, mSettle)),
      ],
      // 杖はしまわない。左手を戻し、両手持ちへ、姿勢を正す
      sheathe: () => [
        F(0.00, Object.assign({}, mSettle,  {e:'smooth'})),
        F(0.48, Object.assign({}, mRelease, {e:'settle'})),
        F(1.00, Object.assign({}, mExplore)),
      ],
    },
    archer: {
      social: aSocial, explore: aExplore, settle: aSettle,
      draw: (combat) => [
        F(0.00, Object.assign({}, aExplore,  {e:'slow'})),
        F(0.34, Object.assign({}, aTake,     {e:'snap'})),
        F(0.48, Object.assign({}, aSwing,    {e:'settle'})),
        F(0.70, Object.assign({}, aPresent,  {e:'settle'})),
        F(1.00, Object.assign({}, combat)),
      ],
      post: (combat) => [
        F(0.00, Object.assign({}, combat, {e:'settle'})),
        F(1.00, Object.assign({}, aSettle)),
      ],
      /* 残心。体の向きを先に正面へ戻さない ―― 弓を収め終えた後も
         半身のまま一拍置き、最後にようやく緊張を解く。stowFrac(0.55)で
         弓は既に背中へ収まっているのに、waist.y が 0 に戻るのは
         クリップの最後だけ、というのがこの職の納刀の全て。 */
      sheathe: () => [
        F(0.00, Object.assign({}, aSettle,  {e:'smooth'})),
        F(0.28, Object.assign({}, aSwing,  {e:'smooth', waist:[0.02,0.42,0.00]})),
        F(0.55, Object.assign({}, aTake,    {e:'smooth', waist:[0.02,0.42,0.00]})),
        F(0.78, Object.assign({}, aZanshin, {e:'slow'})),
        F(1.00, Object.assign({}, aExplore)),
      ],
    },
  };
})();

export const MOTION_POSES = POSES;
// 個々の立ち姿(クリップのキーフレームとして使われるもの)を名前つきで
export const MOTION_STANCE_POSES = POSES.named;
