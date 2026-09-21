/* 戦闘演出の終了。
   state・three.js・シーンに一切依存しないので tests/unit/ から直接呼べる
   (core/combat-stance.js / core/weapon-state.js と同じ切り出し方)。

   ■ 何のために要るのか
   ボスを倒した瞬間、ゲームは「戦闘」から「イベント演出」へ移る。ところが
   演出中のフレームループ(14-hud-boot.js の cutscene 分岐)は updatePlayer も
   updateSwingVFX も呼ばない ―― プレイヤーの入力を取り上げるのが目的の分岐で、
   攻撃の後始末までは面倒を見ていなかった。

   結果、最後の一撃の斬撃エフェクト・魔法陣・飛んでいる矢が「その場で時間ごと
   止まって」画面に残り続ける。フェードで消える仕組みはあるのに、フェードを
   進める関数が呼ばれない、というのが実機で報告された残留の正体。

   ■ ここが持つのは「状態」だけ
   メッシュの取り外し(斬撃・魔法陣・火花・軌跡・飛び道具)は three.js を
   触るので legacy 側に残る。このファイルが持つのは「撃破の瞬間に落とす
   べき state のキーはどれか」という一覧だけで、そこだけは表として外に
   出しておく ―― 取りこぼしはこの手の後始末でいちばん起きやすい。 */

/* 保留している判定・SE。どれも「少し後に効く」ように置かれたもので、
   戦闘が終わったあとに効いてよい理由が無い。
   (11-combat-actions.js の updatePendingSwing 等が消費する) */
export const PENDING_COMBAT_KEYS = [
  'pendingSwing',     // 戦騎士のHitタイミング同期
  'pendingUlt',       // 必殺技の一撃が届く瞬間
  'pendingSkill2',    // 崩し斬りの刃が前を通過する瞬間
  'pendingMoveSfx',   // 刃の通過へ同期させた攻撃SE
];

/* 再生中の攻撃アニメーション。演出へ移る時点で振り切っていなければ、
   もう振り切る機会は来ない。 */
export const ATTACK_ANIM_KEYS = [
  'skillAnim',        // 旋回する必殺技などの再生状態
  'attackLunge',      // 踏み込みのスライド
  'ultSweep',         // 薙ぎ払う必殺技の進行
  'ultBurst',         // 多段必殺技の残りの段
  'berserkerLock',    // バーサーカーのソフトロック
];

/* 処刑(executeT / executeTarget / pendingExecution)はここに載せていない。
   撃破そのものが処刑から来ている場合があり、処刑側の完了処理と噛み合わなく
   なる ―― そして演出中は updatePlayer が回らないので、残っていても何も
   起きない(次の世界構築で disposeWorld が畳む)。触らないのが安全側。 */

/* 撃破 → イベント演出 の境界で落とす state。呼び出し側(legacy)が
   メッシュの取り外しと合わせて使う。渡されたオブジェクトを破壊的に
   更新して返す(state の扱い方と揃えてある)。 */
export function clearTransientCombatState(s){
  if(!s) return s;
  PENDING_COMBAT_KEYS.forEach(k=>{ s[k] = null; });
  ATTACK_ANIM_KEYS.forEach(k=>{ s[k] = null; });
  s.swinging = false;
  s.swingT = 0;
  s.skillCharging = false;
  s.skillChargeT = 0;
  s.ultAiming = false;
  s.moveClip = null;
  return s;
}

/* 落とし終わったか。テストと、将来「本当に消えたか」を実機で見たいときの
   ための読み取り専用の判定 ―― 何も書き換えない。 */
export function hasTransientCombat(s){
  if(!s) return false;
  if(PENDING_COMBAT_KEYS.some(k=> s[k])) return true;
  if(ATTACK_ANIM_KEYS.some(k=> s[k])) return true;
  return !!(s.swinging || s.skillCharging || s.ultAiming);
}
