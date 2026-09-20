/* 森の洋館の敵のプロファイル(Phase 5-A〜5-D)。

   ■ 位置づけ
   このファイルは「森の洋館の数値と判断」だけを持つ純粋モジュールで、
   state / three.js / scene には一切依存しない(core/guardian-break.js・
   core/punish-window.js と同じ切り出し方)。実際に敵を動かす副作用は
   07-ai-combat.js 側にあり、そちらは以下の関数が返した結果どおりに
   en を書き換えるだけにしてある。

   ■ 器は core/enemy-profiles.js にある
   「攻撃表をどう引くか」「予兆の進行度をどう出すか」「variant をどう
   組み立てるか」という**ダンジョン非依存の器**は core/enemy-profiles.js
   へ切り出した。このファイルが持つのは洋館の数値と、その器への登録だけ。
   他のダンジョン(幽霊船・水路・時計塔・神殿・宵待ちの村)も、同じ
   defineMeleeProfile / defineEnemyProfiles を呼べば同じ方式で敵を
   登録できる ―― 洋館を特別扱いしている箇所はもう無い。

   meleeProfile / meleeAttackPlan / meleeAttackChoice / meleeWindupProgress /
   meleeHeavyCooldown / MELEE_PROFILES は、呼び出し側とテストが Phase 5-A
   から使っている名前を保つためにここから再輸出している(実体は器の側)。

   ■ 監査して分かった既存の形(作り直さないために)
   雑魚の攻撃タイプは既に6種あり、それぞれ専用AIを持つ:

     charge  updateChargerAI     idle → telegraph → dash → cooldown
     fire    updateFireEnemyAI   据え置き、溜め(fireCharging)→ 射撃
     kite    updateKiteAI        間合いを保ちながら 溜め → 射撃
     turret  updateTurretAI      台座固定
     jumper  updateJumperAI      跳躍
     ghost   updateGhostAI       消えて背後へ

   予兆(パニッシュ窓)の定義は core/punish-window.js が一手に持ち、
   振り抜いた直後の隙は全タイプ共通の en.postAtkRecoveryT。体幹・大怯み・
   ダウン・Execution Window も敵タイプを一切見ていない。つまり
   **3種を足すのに新しい戦闘基盤は要らない** ―― 必要なのは
   「どの間合いで、どれだけの予兆を見せて、どれだけ隙を晒すか」だけ。

     館の猟犬   : 既存の charge をそのまま使う(溜めと硬直の長さだけ差し替え)
     顔のない侍女: 既存の kite をそのまま使う(撃った直後の足止めだけ追加)
     影に侵された使用人: 近接2択(通常打撃 / 影腕薙ぎ)。ここだけ既存AIに
                  相当するものが無い ―― charge は「突進して通過する」型で、
                  「その場で振る」型の雑魚AIは存在しなかった ―― ので
                  最小の状態機械を1つ足す。予兆・隙・体幹は既存の共通経路に
                  そのまま乗せる。

   ■ 3種の役割差(数値で保証したいこと)
     使用人: 2種類の攻撃でリーチが違う。「近いから安全」ではなく
             「影腕は届く」を、予兆の長さと射程の差で学ばせる
     侍女  : 撃った直後だけ動けない。遠距離敵は撃たせてから詰める
     猟犬  : 突進の溜めが通常の突進型より長く、見てから避けられる
   どれも HP を盛らない ―― tests/unit/mansion-enemies.test.js が
   「難易度を体力ではなく読みで作っている」ことを固定する。 */
import {
  MELEE_PROFILES,
  defineMeleeProfile,
  setFallbackMeleeKind,
  meleeProfile,
  meleeAttackPlan,
  meleeHeavyCooldown,
  meleeAttackChoice,
  meleeWindupProgress,
  defineEnemyProfiles,
  enemyProfile,
  enemyVariant,
  isProfileMeleeWindup,
} from './enemy-profiles.js';

export {
  MELEE_PROFILES,
  meleeProfile,
  meleeAttackPlan,
  meleeHeavyCooldown,
  meleeAttackChoice,
  meleeWindupProgress,
};

// ---- 使用人の近接2択 ----------------------------------------------------
/* telegraph : 振りかぶり(この間はパニッシュ窓が開く=体幹1.6倍)
   active    : 実際に判定が出ている時間
   recovery  : 振り抜いた後、次の行動へ移るまで動けない時間
               (これとは別に全タイプ共通の postAtkRecoveryT が立つ)
   reach     : 敵の原点から測った射程 */
export const SERVANT_ATTACKS = {
  // 通常打撃: 短い予兆・短い隙。「見てから避ける」より「間合いを外す」攻撃
  strike: { key:'strike', telegraph:0.34, active:0.14, recovery:0.40, reach:2.05,
            damageMul:1.0, halfAngle:1.00, hold:0, sfx:'swing',  shake:0.10 },
  // 影腕薙ぎ: 引く → 一瞬止まる → 大きく薙ぐ。リーチが通常打撃より1.4倍以上
  // 長く、振り抜いた後の隙も倍以上。ここが使用人の「読ませどころ」
  sweep:  { key:'sweep',  telegraph:0.84, active:0.22, recovery:0.88, reach:3.30,
            damageMul:1.2, halfAngle:1.60, hold:0.28, sfx:'slashHeavy', shake:0.16 },
};

/* 影腕薙ぎの「一瞬止まる」タメ。予兆の最後のこの割合だけ、腕を引ききった
   ところで静止する ―― 動きが止まることそのものを合図にするため。 */
export const SERVANT_SWEEP_HOLD_RATIO = 0.28;

// 影腕薙ぎの再使用間隔。連発させると通常打撃を覚える機会が無くなる
export const SERVANT_SWEEP_COOLDOWN_SEC = 3.4;
// 攻撃を終えてから次の攻撃判断までの間(recovery とは別の呼吸)
export const SERVANT_ATTACK_COOLDOWN_SEC = 0.85;
// 索敵距離。既存の charge(6) と fire(13) の中間で、近接らしく短い
export const SERVANT_DETECT_RANGE = 8.5;

/* いま出す攻撃を選ぶ。副作用なし。

   dist      : プレイヤーまでの水平距離
   sweepCD   : 影腕薙ぎの残りクールダウン(秒)
   atkCD     : 次の攻撃までの残り時間(秒)

   返り値は SERVANT_ATTACKS のキー、または null(まだ攻撃しない)。

   選び方の意図:
     ・通常打撃の間合いに入っていれば、まず通常打撃(近接の基本を先に見せる)
     ・通常打撃が届かないが影腕なら届く距離では、影腕薙ぎ
       → プレイヤーから見ると「半歩下がったのに届いた」になる
     ・影腕がクールダウン中なら、その距離では何も出さずに詰める
   「至近距離で必ず影腕が出る」ようにはしない ―― 密着していれば通常打撃
   だけを捌けばよい、という読みを残しておきたいため。 */
/* 使用人向けの別名。中身は下の汎用版(meleeAttackChoice / meleeAttackPlan)
   そのもので、Phase 5-A から呼び出し側とテストが使っている名前を保つための
   薄いラッパー。番人(Phase 5-B)が同じ状態機械を共有できるよう、判断の実体は
   プロファイル指定の汎用版へ移してある。 */
export function servantAttackChoice({ dist, sweepCD = 0, atkCD = 0 } = {}) {
  return meleeAttackChoice('servant', { dist, heavyCD: sweepCD, atkCD });
}
export function servantAttackPlan(kind) {
  return meleeAttackPlan('servant', kind);
}

/* 予兆の進行度(0 → 1)。呼び出し側(見た目)が影腕をどこまで引いたかを
   これ1つで決められるようにしてある。薙ぎは最後の SERVANT_SWEEP_HOLD_RATIO
   のあいだ 1 に張り付く = 引ききったまま静止する。 */
export function servantWindupProgress(kind, remainT) {
  return meleeWindupProgress('servant', kind, remainT);
}

/* ======================================================================
   鍵束の番人(Strong Mob / Phase 5-B)

   ■ 監査してそのまま使うと決めたもの(新しい仕組みを足さない)
     Super Armor      core/enemy-tier.js。ELITE は大怯みで行動が中断しない
                      (通常敵だけが中断される)。「永続」ではなく、
                      体幹100%のダウンでは通常どおり完全に止まる
     正面耐性         core/guardian-break.js。正面±45度からの被ダメージ×0.2、
                      側面・背面は等倍。ノックバックも既存どおり無効
     Guard Break      core/guardian-break.js。対峙したまま4秒 → 長い予兆の
                      一撃へ移行。潰されれば guardBreakCancel で完全に消える
     体幹上限         core/stagger-math.js。strongMob 130 × guardian 1.3 = 169
     Break→Execution  core/break-window.js。ELITE の処刑は最大HPの55%で頭打ち
                      ―― 一撃では沈まないが、二度崩せば決着する
   このファイルが足すのは「番人がどの間合いで、どれだけの予兆を見せて、
   どれだけ隙を晒すか」という数値だけ。

   ■ 使用人との作り分け
   状態機械(idle → windup → strike → recover)は使用人と同じものを使う
   (07-ai-combat.js の updateShadowServantAI)。違うのは攻撃表と
   strongMob/guardian フラグ、そして旋回の遅さ ―― 「同じ敵の強化版」では
   なく「同じ間合いの取り方が通用しない敵」にするための差。
====================================================================== */
export const WARDEN_ATTACKS = {
  /* 鍵束叩き: 巨大な鍵束を振り上げて前方へ叩きつける。近距離・前方。
     通常敵より広いが、横にも後ろにも大きくは届かない(halfAngle 1.05)。
     叩きつけた後の隙は 0.62 秒 ―― 仕様の 0.5〜0.8 秒の中央。 */
  slam:  { key:'slam',  telegraph:0.78, active:0.20, recovery:0.62, reach:2.95,
           damageMul:1.35, halfAngle:1.05, hold:0.30, sfx:'gsOverhead', shake:0.20 },
  /* 影腕薙ぎ(番人版): 巨大な影腕を横へ薙ぐ。中距離・横に長い。
     使用人の薙ぎ(予兆0.84 / 射程3.30 / 隙0.88)より重く、遅く、広い。
     正面に居続けると必ず捕まるが、振り抜いた後の隙も一番長い。 */
  sweep: { key:'sweep', telegraph:0.95, active:0.26, recovery:0.98, reach:3.90,
           damageMul:1.15, halfAngle:1.85, hold:0.26, sfx:'slashHeavy', shake:0.24 },
};

// 影腕薙ぎ(番人)の再使用間隔。叩きだけ・薙ぎだけの戦闘にしない
export const WARDEN_SWEEP_COOLDOWN_SEC = 4.2;
/* 攻撃を終えてから次の攻撃判断までの間。使用人(0.85)より長い ――
   重い身体が振り抜いた後の「向き直り」を体感させるための一拍 */
export const WARDEN_ATTACK_COOLDOWN_SEC = 1.15;
// 索敵距離。使用人(8.5)より広い。番人は先に気づいて構える
export const WARDEN_DETECT_RANGE = 10;
/* 旋回速度(rad/秒)。既定の雑魚は 9.5 ―― ほぼ瞬時に向き直るので、
   側面へ回る意味がほとんど無かった。番人だけ明確に鈍くして
   「正面を外して回り込む」を有効な選択肢にする。
   既存の core/enemy-facing.js resolveTurnRate(en.turnRate) をそのまま
   使うだけで、新しい旋回の仕組みは足していない。 */
export const WARDEN_TURN_RATE = 2.6;

/* Chapter 1 の森の洋館に置く前提の基準値。

   HPで強さを表現しない(仕様4/14)。参考値:
     洋館の通常敵(戦闘③)  HP 92
     洋館の中ボス(戦闘④)  HP 190(ネームド)
   番人はその間に置く。正面耐性(×0.2)と体幹169のぶん、実戦の体感は
   HP以上に重いので、HPそのものは通常敵の2倍弱に留める。 */
export const WARDEN_BASE_STATS = { hp:170, atk:23, xp:55, goldBonus:[18,26] };

/* 黒衣の執事の基準値。**地下奥の中ボス枠に元から置かれていた仮実装
   (「燭台を提げた影」)の数値をそのまま引き継ぐ** ―― 今回変えたのは
   正体と戦い方だけで、シナリオの難易度曲線には手を触れていない。 */
export const BUTLER_BASE_STATS = { hp:190, atk:26, xp:58, goldBonus:[18,26] };


/* ======================================================================
   黒衣の執事(Midboss / Phase 5-C)

   ■ 監査してそのまま使うと決めたもの(新しい仕組みを足さない)
     階層          core/enemy-tier.js。midbossName が付いた個体は NAMED。
                   大怯みで行動が中断されない(中断されるのは NORMAL だけ)
     体幹          core/stagger-math.js。strongMob 130。ガード持ちではないので
                   ×1.3 は掛からない ―― 番人(169)より崩しやすい
     Break         core/break-window.js。ダウン3.0秒 → 猶予0.25 → 窓1.60。
                   起き上がり直後の postureGraceT 1.5秒がループ崩しを止める
     Execution     同上。NAMED の処刑は最大HPの45%で頭打ち(ELITE 55% / 通常 100%)
     予兆/隙       core/punish-window.js。windup が midWindup、振り抜き後は
                   全タイプ共通の postAtkRecoveryT
     近接の状態機械 07-ai-combat.js の updateShadowServantAI
                   (使用人 Phase 5-A / 番人 Phase 5-B と共有)
   このファイルが足すのは「どの相で、どの間合いから、どれだけの予兆で
   何を振るか」という数値と、HP閾値によるフェーズ判定だけ。

   ■ フェーズ
   ボスのフェーズ(updateBossAI の en.phase + HP閾値)と同じ考え方を、
   ボス専用の演出(dialogueName / spawnUltimateVFX / 範囲バースト)抜きで
   使う。Midboss は最終ボスではないので、フェーズは2つまでに留める(仕様14)。

     Phase 1「執事」  燭台の近接が主。影腕は長いクールダウンで時々だけ
     Phase 2「影が露出」影腕が主武器になり(クールダウン半減)、リーチが伸び、
                       影移動(短距離の転移)が解禁される
   速度やクールダウンの倍率だけでフェーズを作らない(仕様6)。上の3つは
   どれも「間合いの取り方そのもの」が変わる差にしてある。
====================================================================== */

/* フェーズ2へ移るHP割合。ボスの第2段階(0.65)より遅らせてあるのは、
   Midboss は総HPが小さく、早すぎると Phase 1 を学ぶ前に切り替わるため。 */
export const BUTLER_PHASE2_HP_RATIO = 0.55;

/* フェーズ移行の演出にかける時間(秒)。この間は完全に停止する ――
   「止まる」こと自体が合図になるので、UIで説明する必要がない(仕様7/19)。
   内訳: 燭台の炎が弱まる → 影が身体から離れる → 影が戻る */
export const BUTLER_PHASE_SHIFT_SEC = 1.5;

export const BUTLER_ATTACKS = {
  /* 燭台打撃: 近距離。腕を引き、燭台が上がり、一瞬止まってから打つ。
     使用人の通常打撃(予兆0.34 / 射程2.05)より正確で長い予兆を持つが、
     番人の鍵束叩き(0.78 / 2.95)ほど重くはない ―― 「軽快だが正確」。 */
  candle: {
    key:'candle', telegraph:0.62, active:0.16, recovery:0.44, reach:2.55,
    damageMul:1.10, halfAngle:1.00, hold:0.24, sfx:'slashHeavy', shake:0.13,
  },
  /* 影腕: 中距離。影側の腕が伸びる。Phase 1 では長いクールダウンで
     「時々しか出ない厄介な手」、Phase 2 でリーチが伸びて主武器になる。
     使用人の影腕薙ぎ(予兆0.84 / 射程3.30)より速く、番人の薙ぎ(0.95 /
     3.90)より軽い ―― 単なる射程増加ではなく「速くて細い」差にしてある。 */
  lash: {
    key:'lash', telegraph:0.72, active:0.20, recovery:0.56, reach:3.60,
    damageMul:1.00, halfAngle:1.25, hold:0.22, sfx:'cast', shake:0.11,
    // Phase 2 の差し替え(リーチが伸び、予兆と隙がわずかに詰まる)
    phase2: { telegraph:0.66, recovery:0.52, reach:4.60, halfAngle:1.35 },
  },
};

// 影腕の再使用間隔。Phase 1 は長く(限定的)、Phase 2 で半分以下になる
export const BUTLER_LASH_COOLDOWN_SEC = 6.0;
export const BUTLER_LASH_COOLDOWN_P2_SEC = 2.4;
// 攻撃を終えてから次の判断までの呼吸。軽快なので使用人(0.85)より短い
export const BUTLER_ATTACK_COOLDOWN_SEC = 0.70;
// 索敵距離。Midboss なので広い(番人10 / 使用人8.5)
export const BUTLER_DETECT_RANGE = 12;

/* ---- 影移動(Phase 2 専用) ----
   突然の転移にはしない(仕様8)。4拍に分ける:
     fade    影に溶ける。身体が薄くなり、離れた影が行き先へ伸びる
     (移動) 行き先へ現れる
     emerge  実体化しきるまでの短い停止 ―― ここが差し返しどころ
     windup  そこから通常どおり予兆を見せて攻撃する
   「今から何か起こる」は必ず分かり、「どこへ出るか」は影が示す。 */
export const BUTLER_FADE_SEC = 0.55;
export const BUTLER_EMERGE_SEC = 0.40;
export const BUTLER_STEP_COOLDOWN_SEC = 7.0;
/* 出現位置: プレイヤーからこの距離、正面から外した角度へ。
   真後ろ固定にはしない ―― 既存の幽霊(ghost)が既に「真後ろへ回り込む」
   型を持っているので、Midboss はそれと重ならない斜め後方にする。 */
export const BUTLER_STEP_DISTANCE = 2.4;
export const BUTLER_STEP_ANGLE = Math.PI * 0.72;   // 約130度(斜め後方)
/* 影移動を使う間合い。近すぎる時は使わない ―― 密着からの転移は
   理不尽に見えるだけで、「間合いを操作する」ことにならない。 */
export const BUTLER_STEP_MIN_DIST = 3.2;

/* HP割合から今いるべきフェーズを返す。副作用なし。
   ボスの `if(phase===1 && hpRatio<=0.65) phase=2` と同じ形を、
   閾値だけ差し替えて純粋関数にしたもの。 */
export function butlerPhaseFor(hpRatio) {
  return (hpRatio <= BUTLER_PHASE2_HP_RATIO) ? 2 : 1;
}

/* いまフェーズ移行を始めるべきか。後戻り(回復でPhase1へ戻る)はしない。 */
export function butlerShouldShiftPhase(en) {
  if (!en || en.dead) return false;
  const max = en.hpMax > 0 ? en.hpMax : 0;
  if (max <= 0) return false;
  const cur = en.butlerPhase || 1;
  return cur < butlerPhaseFor(en.hp / max);
}

/* 影移動を使ってよいか。Phase 2 限定・クールダウン・間合いの3条件だけ。

   攻撃の呼吸(atkCD)は条件に入れない ―― 入れると、呼吸が明けるまでの
   コンマ数秒で執事が歩いて間合いを詰めてしまい、条件が揃った頃には
   もう影移動の間合い(3.2)を割っている。実機で実際にそうなった。
   「間合いを開けられたら回り込む」が成立しないので、呼吸より
   影移動を優先する。連発は7秒のクールダウンが止める。
   呼び出し側は待機(idle)からしかここへ来ないので、攻撃を振っている
   最中に割り込む心配はない。 */
export function butlerCanShadowStep({ phase = 1, stepCD = 0, dist = 0 } = {}) {
  if (phase < 2) return false;
  if (stepCD > 0) return false;
  return dist >= BUTLER_STEP_MIN_DIST;
}

/* 影移動の行き先(プレイヤー中心の極座標)。呼び出し側が THREE の
   ベクトルへ直す。side は -1 / +1 で、同じ側へ続けて回らないよう
   呼び出し側が交互に渡す。 */
export function butlerStepTarget(playerPos, playerToEnemyYaw, side) {
  const a = playerToEnemyYaw + (side >= 0 ? BUTLER_STEP_ANGLE : -BUTLER_STEP_ANGLE);
  return {
    x: playerPos.x + Math.sin(a) * BUTLER_STEP_DISTANCE,
    z: playerPos.z + Math.cos(a) * BUTLER_STEP_DISTANCE,
  };
}

/* ---- 近接2択のプロファイル(使用人・番人・執事で共有) ----
   light : 近距離の基本攻撃  heavy : 中距離の大振り(クールダウン付き)

   器(引き方・フェーズ差分の解決・予兆の進行度)は core/enemy-profiles.js。
   ここでは洋館の3体の数値を登録するだけ。表の各フィールドの意味は
   enemy-profiles.js の冒頭にまとめてある。 */
defineMeleeProfile('servant', {
  attacks: SERVANT_ATTACKS, light:'strike', heavy:'sweep',
  heavyCooldown: SERVANT_SWEEP_COOLDOWN_SEC,
  attackCooldown: SERVANT_ATTACK_COOLDOWN_SEC,
  detectRange: SERVANT_DETECT_RANGE,
  // 間合いを詰めるのをやめる距離(light の射程に対する割合)
  approachFactor: 0.75,
});
defineMeleeProfile('warden', {
  attacks: WARDEN_ATTACKS, light:'slam', heavy:'sweep',
  heavyCooldown: WARDEN_SWEEP_COOLDOWN_SEC,
  attackCooldown: WARDEN_ATTACK_COOLDOWN_SEC,
  detectRange: WARDEN_DETECT_RANGE,
  /* 番人は密着しない ―― 密着されると巨体で画面が埋まり、
     何をしているのか読めなくなる(仕様16)。light の射程の
     9割まで詰めたら止まり、そこから振る */
  approachFactor: 0.90,
});
defineMeleeProfile('butler', {
  attacks: BUTLER_ATTACKS, light:'candle', heavy:'lash',
  heavyCooldown: BUTLER_LASH_COOLDOWN_SEC,
  heavyCooldownByPhase: { 2: BUTLER_LASH_COOLDOWN_P2_SEC },
  attackCooldown: BUTLER_ATTACK_COOLDOWN_SEC,
  detectRange: BUTLER_DETECT_RANGE,
  approachFactor: 0.85,
  // フェーズを持つのは執事だけ。他のプロファイルは phase を無視する
  phases: 2,
});
/* 未知のキーを引いた時の落とし先。近接の状態機械(updateShadowServantAI)が
   meleeKind 無しで呼ばれた場合に使用人として扱う、という Phase 5-A からの
   挙動をそのまま保つ(登録順にも依存させないよう明示しておく)。 */
setFallbackMeleeKind('servant');

// ---- 顔のない侍女(既存 kite AI + 撃った直後の足止め) --------------------
/* 影を手元に集める溜め。kite の既定(0.6秒)より長い ―― 「腕を上げる →
   影が集まる → 撃つ」を目で追えるようにするため。 */
export const MAID_SHOT_WINDUP_SEC = 0.75;
/* 撃った直後に動けない時間。パニッシュ窓(0.45秒)より少しだけ長く取り、
   「撃たせてから詰める」が確実に間に合うようにする。極端に長くはしない
   ―― 一発撃つたびに無防備な置物になってしまうため。 */
export const MAID_SHOT_ROOT_SEC = 0.55;

// ---- 館の猟犬(既存 charge AI の溜め/硬直だけ差し替え) -------------------
/* 通常の突進型は溜め0.65秒・硬直1.5秒。猟犬は速い代わりに溜めを長く取り、
   「見てから横へ避けられる」ことを最優先にする。硬直はわずかに長くして
   短いパニッシュの一拍を作るが、数秒殴り放題にはしない。 */
export function houndChargePlan() {
  return { telegraphSec: 0.85, cooldownSec: 1.6 };
}


/* ======================================================================
   館の主(Boss / Phase 5-D)

   ■ 監査してそのまま使うと決めたもの(新しい仕組みを足さない)
     フェーズ管理   07-ai-combat.js updateBossAI の en.phase + HP閾値。
                    閾値も既存のボス共通値(0.65 / 0.30)をそのまま使う
     体幹           core/stagger-math.js bossPostureMax()。HP620 → 180。
                    通常敵55 / 番人169 / 執事130 の上に自然に乗る
     Break          既存のまま。ボスのダウンは2.2秒(雑魚3.0秒より短い)
     Execution      core/execution.js isFinishable() が isBoss を弾くので、
                    崩しても即死しない。処刑ダメージも BOSS の cap 0.18。
                    **ボス専用の処刑ルールは足していない**
     Projectile     spawnEnemyFireball()(影弾に流用)
     HP/攻撃力/報酬 既存の buildBoss('mansionBoss') の値をそのまま
                    (HP620 / atk26 / xp150 / 主の袖飾り)。フェーズが3つ
                    あるぶん戦闘時間は伸びるので、HPは増やさない(仕様21)

   ■ このファイルが足すもの
   「どのフェーズで、どの間合いから、何を振るか」という数値だけ。
   影の位置計算も、部屋からはみ出さないためのクランプも純粋関数にして
   ある(仕様25。NavMesh は作らない)。

   ■ 本体と影のHP(仕様23)
   影は独立したHPを持たない。敵オブジェクトは最後までひとつで、
   Phase 2 では **en.group(=当たり判定・ターゲット・HPバーの基準)が
   影のほうへ移る**。本体はその場に残る見た目だけの分身になる。
   これで「影を殴ってもボスのHPが減る」「本体を殴ってもボスのHPが減る」が
   新しいターゲットUIもダメージ経路も足さずに成立する(仕様24)。
====================================================================== */

// フェーズ閾値。既存のボス共通値をそのまま使う(仕様8/14)
export const LORD_PHASE2_HP_RATIO = 0.65;
export const LORD_PHASE3_HP_RATIO = 0.30;
/* フェーズ移行の演出にかける時間。止まっている時間そのものが合図なので、
   UIテキストは出さない(仕様28)。分離のほうが長いのは、影が足元から
   離れて距離を取るまでを見せる必要があるため */
export const LORD_SPLIT_SEC = 2.2;   // Phase 1 → 2(影が離れる)
export const LORD_MERGE_SEC = 1.8;   // Phase 2 → 3(影が戻る)

/* 攻撃表。telegraph / active / recovery / reach は他の洋館の敵と同じ意味。
   minDist は「これより近いと使わない」下限で、遠距離技が密着で出るのを防ぐ。
   by は誰が振るか ―― 'body'(館の主本人)か 'shadow'(影)。 */
export const LORD_ATTACKS = {
  // --- Phase 1 / 3: 本体 ---
  cane: { key:'cane', by:'body', telegraph:0.70, active:0.20, recovery:0.55,
          minDist:0, reach:3.60, halfAngle:1.05, damageMul:1.00, hold:0.26,
          sfx:'gsOverhead', shake:0.18, cooldown:0 },
  lash: { key:'lash', by:'body', telegraph:0.80, active:0.22, recovery:0.62,
          minDist:2.4, reach:5.40, halfAngle:1.25, damageMul:0.95, hold:0.24,
          sfx:'slashHeavy', shake:0.16, cooldown:7.0 },
  // --- 全フェーズ: 影弾(既存 Projectile) ---
  bolt: { key:'bolt', by:'shadow', telegraph:0.85, active:0.10, recovery:0.55,
          minDist:6.0, reach:18.0, halfAngle:Math.PI, damageMul:0.85, hold:0.22,
          sfx:'cast', shake:0, projectile:true, cooldown:9.0 },
  // --- Phase 2: 影 ---
  sweep: { key:'sweep', by:'shadow', telegraph:0.85, active:0.26, recovery:0.85,
           minDist:0, reach:5.00, halfAngle:1.70, damageMul:1.00, hold:0.26,
           sfx:'slashHeavy', shake:0.20, cooldown:0 },
  /* 影突進は館の主で最も踏み込みが大きい一撃なので、振り抜いた後の隙も
     洋館で最大にする(番人の影腕薙ぎ0.98より長い)。避けきったプレイヤーが
     確実に差し返せる、が全フェーズ共通の約束(仕様18) */
  rush:  { key:'rush', by:'shadow', telegraph:0.80, active:0.45, recovery:1.05,
           minDist:4.0, reach:14.0, halfAngle:Math.PI, damageMul:1.10, hold:0.24,
           sfx:'jump', shake:0.22, dash:true, dashSpeed:13, hitRadius:1.9, cooldown:6.5 },
};

/* フェーズごとの候補と優先順位。近い間合いのものから順に見て、射程帯と
   クールダウンが合った最初のものを出す ―― ランダムに散らさないのは、
   「この距離ならこれが来る」を学習させたいから(全フェーズ共通の約束)。 */
export const LORD_PHASE_ATTACKS = {
  1: ['cane', 'lash', 'bolt'],            // 人間としての戦い。影は控えめ
  2: ['sweep', 'rush', 'bolt'],           // 影が主敵
  3: ['cane', 'sweep', 'lash', 'bolt'],   // 人間+影の複合
};

/* Phase 1 では影の手を絞る(仕様7)。影腕と影弾のクールダウンにこの倍率を
   掛けて、「たまに混ざる違和感」の頻度に抑える。 */
export const LORD_PHASE1_SHADOW_CD_MUL = 1.6;

/* 攻撃を終えてから次の判断までの呼吸。ボスなので雑魚より長く取り、
   一撃ごとに読む時間を作る。 */
export const LORD_ATTACK_BREATH_SEC = 0.85;

/* Phase 3 の二段攻撃(仕様16)。本体が振り抜いたあと、影が同じ方向へ
   少し遅れて追撃する。遅れの長さは「本体だけ見ていると当たる」が
   「影も見ていれば避けられる」境目に置く。 */
export const LORD_ECHO_DELAY_SEC = 0.42;
export const LORD_ECHO = { reach:5.20, halfAngle:1.55, damageMul:0.80, active:0.22 };

/* 影の移動(仕様25)。主の間(bLord: x58..102 / z146..180)からはみ出さない
   よう、影の基準点(分離した地点)からの半径で縛るだけ。NavMesh は作らない。 */
export const LORD_SHADOW_ROOM_RADIUS = 13;
// 影がプレイヤーに対して取ろうとする間合いと、回り込む角度
export const LORD_SHADOW_STANDOFF = 4.2;
export const LORD_SHADOW_FLANK_ANGLE = Math.PI * 0.55;
// 影が動き直す間隔(秒)。毎フレーム動き回らせない
export const LORD_SHADOW_REPOSITION_SEC = 3.2;
/* Phase 1 の影は足元にいる。HPが減るほど本体から離れ、遅れて付いてくる
   ―― 「この敵の影はおかしい」を、攻撃ではなく影の挙動だけで伝える(仕様3/7)。 */
export const LORD_SHADOW_CREEP_MAX = 0.9;

export function lordPhaseFor(hpRatio) {
  if (hpRatio <= LORD_PHASE3_HP_RATIO) return 3;
  if (hpRatio <= LORD_PHASE2_HP_RATIO) return 2;
  return 1;
}

/* いまフェーズ移行を始めるべきか。後戻りはしない(回復してもフェーズは進んだまま)。 */
export function lordShouldShiftPhase(en) {
  if (!en || en.dead) return false;
  const max = en.hpMax > 0 ? en.hpMax : 0;
  if (max <= 0) return false;
  return (en.phase || 1) < lordPhaseFor(en.hp / max);
}

export function lordAttackPlan(key) {
  return LORD_ATTACKS[key] || LORD_ATTACKS.cane;
}

/* そのフェーズでのクールダウン。Phase 1 だけ影の手が長い間隔になる。 */
export function lordAttackCooldown(key, phase) {
  const a = lordAttackPlan(key);
  const base = a.cooldown || 0;
  if (phase === 1 && a.by === 'shadow') return base * LORD_PHASE1_SHADOW_CD_MUL;
  return base;
}

/* いま出す攻撃を選ぶ。副作用なし。
   cds は {attackKey: 残りクールダウン秒} の表。 */
export function lordAttackChoice({ phase = 1, dist = 0, cds = {}, atkCD = 0 } = {}) {
  if (atkCD > 0) return null;
  if (!(dist >= 0)) return null;
  const list = LORD_PHASE_ATTACKS[phase] || LORD_PHASE_ATTACKS[1];
  for (let i = 0; i < list.length; i++) {
    const a = LORD_ATTACKS[list[i]];
    if (dist < a.minDist || dist > a.reach) continue;
    if ((cds[a.key] || 0) > 0) continue;
    return a.key;
  }
  return null;
}

/* Phase 1 の影が足元からどれだけずれるか(0 → LORD_SHADOW_CREEP_MAX)。
   HPが減るほど大きくなる ―― Phase 2 の分離が唐突に見えないようにするため。 */
export function lordShadowCreep(hpRatio) {
  const r = Math.max(0, Math.min(1, hpRatio));
  const k = (1 - r) / (1 - LORD_PHASE2_HP_RATIO);   // 1.0 → 0.65 を 0 → 1 に
  return Math.max(0, Math.min(1, k)) * LORD_SHADOW_CREEP_MAX;
}

/* Phase 2 の影が次に立つ位置。プレイヤーの斜め前後に一定距離で回り込み、
   主の間からはみ出さないよう分離地点(anchor)からの半径で縛る。 */
export function lordShadowTarget(playerPos, anchorPos, side, radius) {
  const lim = radius != null ? radius : LORD_SHADOW_ROOM_RADIUS;
  const base = Math.atan2(playerPos.x - anchorPos.x, playerPos.z - anchorPos.z);
  const a = base + (side >= 0 ? LORD_SHADOW_FLANK_ANGLE : -LORD_SHADOW_FLANK_ANGLE);
  let x = playerPos.x + Math.sin(a) * LORD_SHADOW_STANDOFF;
  let z = playerPos.z + Math.cos(a) * LORD_SHADOW_STANDOFF;
  // 部屋の外へ出そうなら、分離地点を中心とした円の内側へ引き戻す
  const dx = x - anchorPos.x, dz = z - anchorPos.z;
  const d = Math.hypot(dx, dz);
  if (d > lim && d > 0) {
    x = anchorPos.x + (dx / d) * lim;
    z = anchorPos.z + (dz / d) * lim;
  }
  return { x, z };
}

// ---- 洋館5体のプロファイル ------------------------------------------------
/* atkType / theme は既存の仕組みのキーそのもの。
   hp・atk・xp は配置側(spawnEnemies)が既存の枠の値をそのまま渡すので、
   ここには「その敵らしさ」を決めるものだけを置く。

   器(variant の組み立て)は core/enemy-profiles.js の enemyVariant。
   メタ情報(key / name / role / material / variant)以外のフィールドは
   そのまま variant へ写り、`variant` に書いたものが役割ごとの追加分として
   重なる ―― 基盤側が「maid」「hound」という名前を知らなくて済むように
   するための口で、他のダンジョンの引き撃ち/突進型も同じ書き方で足せる。 */
export const MANSION_ENEMIES = defineEnemyProfiles({
  servant: {
    key: 'servant',
    name: '影に侵された使用人',
    role: 'melee',
    theme: 'servant',
    atkType: 'servant',
    color: 0x3d3a4c,          // 使用人の仕着せ(暗い藍鼠)
    shadowColor: 0x0d0b15,    // 侵食された腕・足元の影
    accentColor: 0xc9c0ad,    // シャツとカフス
    material: 'flesh',        // 被弾/撃破SE(肉+影の重い音)
    speed: 1.9,
  },
  maid: {
    key: 'maid',
    name: '顔のない侍女',
    role: 'ranged',
    theme: 'maid',
    atkType: 'kite',          // 既存の引き撃ちAIをそのまま使う
    color: 0x2f3340,
    shadowColor: 0x07060d,    // 顔の空洞
    accentColor: 0xd8d4c6,    // エプロンとヘッドドレス
    projColor: 0x9a6ae0,
    material: 'ghost',        // 軽い/不気味な音
    speed: 1.5,
    /* 引き撃ち役の追加分。既存の kite AI に「撃った直後だけ動けない」を
       足すためのフィールドで、AI そのものは変えていない */
    variant: {
      shotWindupSec: MAID_SHOT_WINDUP_SEC,
      shotRootSec: MAID_SHOT_ROOT_SEC,
      shotSfx: 'cast',
    },
  },
  hound: {
    key: 'hound',
    name: '館の猟犬',
    role: 'charger',
    theme: 'hound',
    atkType: 'charge',        // 既存の突進AIをそのまま使う
    color: 0x4a3f3a,
    shadowColor: 0x0d0a12,
    accentColor: 0x6b5c50,
    material: 'flesh',        // 獣+突進系
    speed: 3.1,
    /* 突進役の追加分。既存の charge AI の溜め/硬直だけを上書きする
       (値は houndChargePlan。AI そのものは変えていない) */
    variant: {
      chargeTelegraphOverride: houndChargePlan().telegraphSec,
      chargeCooldownOverride: houndChargePlan().cooldownSec,
      dashSfx: 'jump',
    },
  },
  /* 鍵束の番人(Strong Mob / Phase 5-B)。
     使用人と同じ近接の状態機械('servant')に、既存の強モブ基盤
     (strongMob = Super Armor + 体幹130 / guardian = 正面耐性 + Guard Break)
     を重ねただけ ―― 新しい Strong Mob の仕組みは1つも作っていない。 */
  warden: {
    key: 'warden',
    name: '鍵束の番人',
    role: 'guardian',
    theme: 'warden',
    atkType: 'servant',       // 近接2択の状態機械を使用人と共有する
    meleeKind: 'warden',      // ただし攻撃表は番人専用(WARDEN_ATTACKS)
    color: 0x36323f,
    shadowColor: 0x0a0812,
    accentColor: 0xb0a48c,
    keyColor: 0xb9a45c,       // 鍵束の真鍮色(Guardian の防御表示も兼ねる)
    material: 'flesh',
    speed: 1.6,               // 使用人(1.9)より重く遅い
    strongMob: true,          // Super Armor / 体幹130 / ノックバック減衰
    guardian: true,           // 正面±45度の被ダメージ×0.2 / Guard Break
    turnRate: WARDEN_TURN_RATE,
  },
  /* 黒衣の執事(Midboss / Phase 5-C)。
     番人と同じ近接の状態機械('servant')に、既存のネームド枠
     (midbossName → NAMED / strongMob → 体幹130)を重ね、HP閾値で
     フェーズが1つだけ切り替わる。guardian は**付けない** ――
     番人の上位版にしないため(仕様13)。正面耐性に頼らず、
     攻撃の種類とフェーズでのルール変化で戦わせる。 */
  butler: {
    key: 'butler',
    name: '黒衣の執事',
    role: 'midboss',
    theme: 'butler',
    atkType: 'servant',       // 近接の状態機械を使用人/番人と共有する
    meleeKind: 'butler',      // 攻撃表は執事専用(BUTLER_ATTACKS)
    color: 0x1b1a24,          // 黒衣
    shadowColor: 0x07060c,
    accentColor: 0xe2ded2,    // 白いシャツと手袋
    candleColor: 0xffc978,    // 燭台の炎(Phase 1)
    candleColorP2: 0x9a7ae0,  // 影が露出したあとの、冷たい炎(Phase 2)
    material: 'flesh',
    speed: 2.2,               // 軽快(番人1.6 / 使用人1.9 / 猟犬3.1)
    strongMob: true,          // 体幹130 + ノックバック減衰(ネームドの既定)
    // guardian は立てない(正面耐性・ガードブレイクは番人の役割)
    midbossName: '黒衣の執事',
    midbossFlavor: '燭台の火が消えた。執事だったものは、主の名を最後まで口にしなかった。',
  },
});

export function mansionEnemyProfile(key) {
  // 洋館の台帳に無いキーは null(他ダンジョンの敵まで引いてしまわないよう、
  // 汎用の enemyProfile ではなく MANSION_ENEMIES を見る)
  return MANSION_ENEMIES[key] ? enemyProfile(key) : null;
}

/* buildEnemy() へ渡す variant を組み立てる。
   stats(hp/atk/xp/goldBonus/roomTag…)は呼び出し側がそのまま重ねる ――
   既存の配置の数値を1つも動かさずに見た目とAIだけ差し替えられるように
   するため(難易度を体力で作らない、という今回の方針そのもの)。 */
export function mansionEnemyVariant(key, stats) {
  if (!MANSION_ENEMIES[key]) return Object.assign({}, stats);
  return enemyVariant(key, stats);
}

/* この敵が「まだ振り抜いていない予兆」の最中か。
   実体は core/enemy-profiles.js の isProfileMeleeWindup ―― 判定は
   プロファイル方式の近接敵すべてに共通で、洋館固有のものではない。
   Phase 5-A から呼び出し側とテストが使っている名前をここで保つ。 */
export const isServantWindup = isProfileMeleeWindup;
