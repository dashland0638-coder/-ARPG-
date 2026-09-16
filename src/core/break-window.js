/* Break → Execution Window の純粋計算。
   state・three.js・シーンに一切依存しないので tests/unit/ から直接呼べる
   (core/execution.js / core/stagger-math.js と同じ切り出し方)。

   ■ 調べて分かった既存の形(作り直さないために)
   「敵の姿勢を崩す」仕組みはとっくに在る。体幹(en.posture)が上限へ達すると
   applyStaggerResult() → triggerKnockdown() が走り、en.knockedDown が立って
   通常AIが 3.0 秒(ボス 2.2 秒)完全に止まる。崩れた姿勢・盾が落ちる演出・
   体幹バーの橙・トースト・SE・追撃ダメージ 1.4 倍まで揃っている。
   つまり **BREAK そのものは実装済み** で、triggerKnockdown は
   canGainPosture() が knockedDown を弾くので二重発火もしない。

   欠けていたのはその先だった:

     1. 「崩れている」と「今なら決められる」が区別されていない
        ダウン中はずっと追撃 1.4 倍で、特別な瞬間が無い
     2. 処刑(core/execution.js)が体幹ではなく **HP 10% 以下** で開くので、
        「崩す」と「決める」が因果で繋がっていない
     3. 処刑はプレイヤーの専用入力ではなく、dealDamageToEnemy の中で
        条件が揃ったときに勝手に乗る倍率だった ―― 押した覚えが無い

   このファイルが足すのは、その3つを埋める最小限:
   ダウンの先頭に短い**猶予(lead)**と**Execution Window**を敷き、
   「崩れた → 今だ → 押す」の1拍を作る。新しいステートマシンは作らず、
   既存の en.knockedDown / knockdownT の内側に時間を切るだけ。

   ■ 状態の読み方
   breakState() は既存フィールドから **導出するだけ** で何も書かない。
   NORMAL / BREAK / EXECUTION_WINDOW / EXECUTION / RECOVERY の5つは
   資料の語彙で、実装側に同名のフィールドは増やしていない
   (core/motion-preview.js の motionStateLabel と同じ考え方)。 */

import { enemyTier, TIER } from './enemy-tier.js';
import { isFinishable } from './execution.js';

export const BREAK_STATE = {
  NORMAL:           'NORMAL',
  BREAK:            'BREAK',
  EXECUTION_WINDOW: 'EXECUTION_WINDOW',
  EXECUTION:        'EXECUTION',
  RECOVERY:         'RECOVERY',
};

/* 崩れてから「今だ」が出るまでの間。
   崩れた瞬間に EXECUTE を出すと、プレイヤーは崩したことに気づく前に
   プロンプトを読むことになる ―― 「崩れた」を見せてから誘う。
   ヒットストップ(0.028秒)とトーストがちょうどこの間に収まる。 */
export const BREAK_LEAD_SEC = 0.25;

/* Execution Window の長さ。
   短すぎると押せず、長すぎると「ダウン中はいつでも処刑できる」になって
   ただの追撃ボーナスに退化する。ダウンの長さ(通常 3.0 / ボス 2.2 秒)の
   内側に収める必要があるので、0.25 + 1.60 = 1.85 秒 ―― ボスでも
   0.35 秒ぶんの RECOVERY が残る。実機での手触りは最終レポート参照。 */
export const EXECUTION_WINDOW_SEC = 1.60;

/* 崩した瞬間の手応え(資料15章の「小さなHitstop」)。

   共有の hitStop() は上限 0.022 秒・不応期 0.26 秒つきで、**崩した一撃
   そのもの**が直前に不応期を消費しているため、何も指定しないと Break の
   ヒットストップは必ず無視される(実際に無視されていた)。必殺技・処刑と
   同じ force/max の指定で、その1回だけ通す。

   値は既存の階層の隙間に置く:
     通常ヒット 0.022 < Break 0.034 < 必殺技 0.050 < 処刑 0.060〜0.085
   「崩した」は決め手ではないので必殺技より必ず小さく、しかし通常の
   一撃とは区別が付く大きさにする。tests/unit/break-window.test.js が
   この順序を固定している。 */
export const BREAK_HITSTOP = 0.034;
export const BREAK_HITSTOP_MAX = 0.040;

/* 処刑が届く距離。近接職は踏み込んで decisive に、遠隔職は
   間合いを保ったまま決める(資料12章)。既存の攻撃間合い
   (剣士 3.2 / 盗賊 2.6)よりわずかに広く取ってあるのは、
   1.6 秒のあいだに間合いを詰め切れずに窓を落とすのを避けるため。 */
export const EXECUTION_RANGE = {
  warrior: 4.0, rogue: 3.6, mage: 9.0, archer: 11.0,
};
export function executionRange(classKey){
  const r = EXECUTION_RANGE[classKey];
  return r != null ? r : EXECUTION_RANGE.warrior;
}

/* 狙っていると見なす角度(片側・ラジアン)。背後や画面外の敵を
   勝手に処刑しないための条件。

   値の根拠: 既存の近接攻撃で一番広い扇(剣士 meleeAngle = PI/2.1 ≒
   片側 85.7 度)より必ず広く取る ―― 「殴って崩せた相手は必ず決められる」
   を保証するため。実機で最初に 75 度にしたところ、崩した直後に相手が
   ノックバックで横へ滑っただけで窓を押せない状況が出た。
   一方 90 度を超えると背後の敵まで拾い始めるので、ここで止める。 */
export const EXECUTION_AIM_ANGLE = Math.PI * 0.5;   // 90 度(真横まで)

/* ダウンした敵に窓を開く。triggerKnockdown() から1回だけ呼ぶ。

   多重発火の防波堤はここ1箇所に置く ―― 呼び出し側(マルチヒット・
   オートコンボ・AoE・弾・サポートAI)が同じフレームに何度体幹を
   満たしても、既に窓が開いている/使い終わった敵には何もしない。
   戻り値は「実際に開いたか」で、Break 演出を鳴らす側がこれを見る。 */
export function openExecutionWindow(en){
  if(!en || en.dead) return false;
  if(en.execBreakId && (en.execLeadT > 0 || en.execWindowT > 0 || en.execConsumed)) return false;
  en.execBreakId = (en.execBreakId || 0) + 1;   // この崩しの通し番号(多重防止の印)
  en.execLeadT = BREAK_LEAD_SEC;
  en.execWindowT = EXECUTION_WINDOW_SEC;
  en.execConsumed = false;
  en.executing = false;
  return true;
}

/* ダウン中の敵に毎フレーム。lead → window → 期限切れ、まで進める。
   処刑の再生中(executing)はタイマーを止める ―― 演出の途中で窓が
   切れて「処刑したのに逃した」判定になるのを防ぐ。 */
export function stepExecutionWindow(en, dt){
  if(!en || !(dt > 0)) return;
  if(en.executing) return;
  if(en.execLeadT > 0){
    en.execLeadT = Math.max(0, en.execLeadT - dt);
    return;
  }
  if(en.execWindowT > 0) en.execWindowT = Math.max(0, en.execWindowT - dt);
}

/* ダウンから立ち上がった / 死んだ / ダンジョンを出た時の後始末。
   窓が閉じた後に finishable が残り続けないようにする(資料19章)。 */
export function clearExecutionWindow(en){
  if(!en) return;
  en.execLeadT = 0;
  en.execWindowT = 0;
  en.execConsumed = false;
  en.executing = false;
  en.execBreakId = 0;
}

/* 今この敵を処刑できるか(距離・向きは呼び出し側が見る)。
   ここが見るのは「窓が開いているか」だけ ―― 資料7章のとおり、
   既存の処刑条件(HP 10% 以下)を **追加** の関門にはしない。
   HP 条件側は今までどおり別経路(canExecute)で生き続ける。 */
export function isExecutable(en){
  if(!en || en.dead || en.dormant) return false;
  if(!en.knockedDown) return false;
  if(en.executing || en.execConsumed) return false;
  return (en.execLeadT || 0) <= 0 && (en.execWindowT || 0) > 0;
}

/* 資料の語彙へ写す。既存フィールドから導出するだけで何も書かない。 */
export function breakState(en){
  if(!en || en.dead || en.dormant) return BREAK_STATE.NORMAL;
  if(en.executing) return BREAK_STATE.EXECUTION;
  if(en.knockedDown){
    if((en.execLeadT || 0) > 0) return BREAK_STATE.BREAK;
    if(!en.execConsumed && (en.execWindowT || 0) > 0) return BREAK_STATE.EXECUTION_WINDOW;
    return BREAK_STATE.RECOVERY;   // 窓を逃した / 使い終えた。まだ倒れている
  }
  // 起き上がり直後の再ダウン防止(既存の postureGraceT)も RECOVERY
  if((en.postureGraceT || 0) > 0) return BREAK_STATE.RECOVERY;
  return BREAK_STATE.NORMAL;
}

/* 複数の敵が同時に崩れている場合の選択(資料9章)。
   候補は呼び出し側が {en, dist, angle} へ均してから渡す ――
   この関数に THREE を持ち込まないため。

   「プレイヤーが狙っている敵」を最優先にしたいので、まず正面に
   近い順、同じくらい正面なら近い順。角度の刻みを 15 度単位で
   丸めてから比較するのは、ほぼ正面に2体並んでいるときに
   1度の差で遠い方が選ばれるのを避けるため。 */
export const AIM_BUCKET = Math.PI / 12;   // 15度
export function pickExecutionTarget(candidates, opts){
  const { range = EXECUTION_RANGE.warrior, aim = EXECUTION_AIM_ANGLE } = opts || {};
  let best = null, bestBucket = Infinity, bestDist = Infinity;
  for(const c of candidates || []){
    if(!c || !c.en) continue;
    if(!(c.dist <= range)) continue;
    const a = Math.abs(c.angle);
    if(!(a <= aim)) continue;
    const bucket = Math.floor(a / AIM_BUCKET);
    if(bucket < bestBucket || (bucket === bestBucket && c.dist < bestDist)){
      best = c.en; bestBucket = bucket; bestDist = c.dist;
    }
  }
  return best;
}

/* 処刑ダメージ(Break 由来)。

   既存の executionDamage() は「残りHPを必ず削り切る」―― 瀕死の敵を
   締めるための式で、体幹を崩しただけの元気な敵に当てると即死になる。
   ボスを1回の処刑で沈めない(資料16章)ためには別の式が要る。

   方針は3つ:
     mul    通常攻撃の何倍か。「明確に強い」を最低限保証する
     hpFrac 相手の最大HPの何割か。攻撃力が低いうちでも Break の
            見返りが体感できるようにする下支え
     cap    1回の処刑で削れる上限(最大HP比)。ボスの即死を止める

   通常敵の cap は 1.00 ―― 崩して決めたら倒れてよい(資料18章)。
   階層が上がるほど cap を絞り、ボスは 18% でフェーズ設計を壊さない。 */
export const EXECUTION_BREAK_DAMAGE = {
  [TIER.NORMAL]: { mul: 3.0, hpFrac: 0.42, cap: 1.00 },
  [TIER.ELITE]:  { mul: 2.6, hpFrac: 0.26, cap: 0.55 },
  [TIER.NAMED]:  { mul: 2.6, hpFrac: 0.22, cap: 0.45 },
  [TIER.BOSS]:   { mul: 2.2, hpFrac: 0.12, cap: 0.18 },
};

export function executionBreakDamage(en, baseDamage, tier){
  const t = EXECUTION_BREAK_DAMAGE[tier || enemyTier(en)] || EXECUTION_BREAK_DAMAGE[TIER.NORMAL];
  const base = baseDamage > 0 ? baseDamage : 0;
  const hpMax = (en && en.hpMax > 0) ? en.hpMax : 0;
  const raw = Math.max(base * t.mul, hpMax * t.hpFrac);
  // 上限で抑えた結果が通常の一撃を下回るのは本末転倒なので、base を下限にする
  const out = Math.max(base, Math.min(raw, hpMax * t.cap));
  return Math.max(1, Math.round(out));
}

/* 処刑が実際に成立したときの後始末(窓を閉じる)。
   dealDamageToEnemy より前に呼んで、同じ窓で2回処刑が走るのを止める。 */
export function consumeExecutionWindow(en){
  if(!en) return false;
  if(!isExecutable(en)) return false;
  en.execWindowT = 0;
  en.execLeadT = 0;
  en.execConsumed = true;
  en.executing = true;
  return true;
}

/* 処刑の再生が終わったとき。敵はダウンの残り時間を通常どおり過ごす。 */
export function endExecution(en){
  if(!en) return;
  en.executing = false;
}

/* 瀕死の敵に対しては、Break 由来の処刑でも「必ず削り切る」既存の
   約束(core/execution.js)を守る ―― 処刑したのに生き残るのが一番興ざめ、
   という既存コメントの判断をそのまま引き継ぐ。ボスは isFinishable が
   弾くので、上の cap がそのまま効く。 */
export function shouldFinishOff(en){
  return isFinishable(en);
}
