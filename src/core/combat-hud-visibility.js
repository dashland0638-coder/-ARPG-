/* 戦闘 HUD の表示条件(UI-002-D WI-D1、HD-D18)。

   「どの HUD 要素を、いつ表示するか」を 1 か所に集めた純粋関数。
   DOM の更新は legacy 側(14-hud-boot.js / 10-input.js)がこの結果を
   見て行う。state・THREE・DOM に依存しない(ARCHITECTURE.md の core/ の作法)。

   ここで決めるのは表示・非表示だけで、位置・大きさ・見た目(D2〜D6 /
   C2・V)とゲームロジック(スタミナの消費・回復、MP など)は扱わない。

   本編とテストモードは入力の testMode で区別する(本編に旧成長系の
   XP / Skill 3 / Lv を出さない UI-002-A の決定を、ここでも混同しない)。 */
import { legacyGrowthEnabled } from './chapter1-rules.js';
import { hasSkill2 } from './chapter1-skills.js';

/** PC 操作ヒントを出しておく秒数(HD-D24) */
export const PC_HINT_DURATION_SEC = 5;
/** 最後にスタミナを使ってから、満タンでも表示を続ける秒数(HD-D25) */
export const STAMINA_SHOW_AFTER_USE_SEC = 3;

/* 操作ヒントの「新しい操作」の単位。基本操作と、あとから解禁される
   Skill 2 / Skill 3。ヒントの文言そのものは index.html のまま変えない */
export const PC_HINT_OPS = Object.freeze(['basic', 'skill2', 'skill3']);

/** 旧成長系(XP バー・Skill 3・操作ヒントの Skill 3 表記)を出すか。本編 Chapter 1 は出さない(UI-002-A) */
export function legacyHudVisible(input){
  return legacyGrowthEnabled(!!(input && input.testMode));
}

/** Skill 2 ボタン: 閃くまで出さない(テストモードは常に持つ) */
export function skill2ButtonVisible(input){
  const o = input || {};
  return hasSkill2({ learnedSkill2: o.learnedSkill2, testMode: o.testMode });
}

/** Skill 3 ボタン: テストモードだけ(UI-002-A WI-A2) */
export function skill3ButtonVisible(input){
  return legacyHudVisible(input);
}

/* 常時表示(HD-D09): 名前・肖像・HP・武器バッジは HUD が有効な間は表示。
   画面上の位置・大きさ・重なりは D2 / D4 の範囲で、ここでは扱わない */
export function alwaysOnHudVisible(input){
  const on = !!(input && input.hudActive);
  return { name: on, portrait: on, hp: on, weaponBadge: on };
}

/* ミニマップ(HD-D21): 現行の条件(開始済み・非ポーズ・非会話・
   オーバーレイなし)を維持する。「必要な状態」は未決定なので、
   入力口 needed だけ用意し、指定が無ければ現行どおり(true 扱い) */
export function minimapPanelVisible(input){
  const o = input || {};
  const base = !!o.started && !o.paused && !o.dialogueActive && o.activeOverlay === 'none';
  return base && o.needed !== false;
}

/* タッチ操作パッドの状態(現行の refreshTouchControls と同じ結果)。
   active … タッチ端末でパッド未接続: スティック・全ボタン・カメラ回転
   gamepadMin … それ以外のプレイ中(PC・パッド接続中): 能力ボタンだけを表示専用で */
export function touchControlsMode(input){
  const o = input || {};
  const playing = !!o.started;
  const active = playing && !!o.isTouchDevice && !o.gamepadConnected;
  return { active, gamepadMin: playing && !active, cameraButtons: active };
}

/* PC(タッチ以外)でのタッチ用ボタンの表示(HD-D08 / HD-D22)。
   D1 では現行の表示結果を条件として書き表すだけで、実際の非表示化は
   D3 で行う(ここを変えても DOM は変わらない。DOM の表示は CSS の
   .gamepad-min による) */
export function touchActionButtonsVisible(input){
  const mode = touchControlsMode(input);
  if(!mode.active && !mode.gamepadMin) return { attack: false, skill1: false, ultimate: false, jump: false, dodge: false };
  return { attack: true, skill1: true, ultimate: true, jump: mode.active, dodge: mode.active };
}

/* スタミナ(HD-D11 / HD-D25): 満タンで直近の消費が無ければ隠す。
   消費中・回復中(満タン未満)と、最後の消費から 3 秒間は出す。
   sinceLastUseSec は最後に減ってからの秒数(一度も減っていなければ Infinity / null)。
   スタミナのゲームロジックは変えない(値を読むだけ) */
export function staminaVisible(input){
  const o = input || {};
  const max = Number(o.maxStamina) || 0;
  if(max <= 0) return false;
  if(Number(o.stamina) < max) return true;
  const since = o.sinceLastUseSec;
  return typeof since === 'number' && since >= 0 && since < STAMINA_SHOW_AFTER_USE_SEC;
}

/** いま解禁されている操作(PC 操作ヒントの単位) */
export function unlockedPcHintOps(input){
  const ops = ['basic'];
  if(skill2ButtonVisible(input)) ops.push('skill2');
  if(skill3ButtonVisible(input)) ops.push('skill3');
  return ops;
}

/* PC 操作ヒント(HD-D07 / D23 / D24): 初回と新しい操作の解禁時に 5 秒だけ出す。
   seen は「このセッションでもうヒントを出した操作」。セーブには入れない(HD-D23)。
   戻り値: { visible, seen, shownAtSec }(seen / shownAtSec は呼び出し側が次回へ渡す) */
export function stepPcHint(input){
  const o = input || {};
  const seen = Array.isArray(o.seen) ? o.seen.slice() : [];
  let shownAtSec = typeof o.shownAtSec === 'number' ? o.shownAtSec : null;
  const now = Number(o.nowSec) || 0;
  if(o.isTouchDevice) return { visible: false, seen, shownAtSec };
  const unlocked = Array.isArray(o.unlocked) ? o.unlocked : [];
  const fresh = unlocked.filter(op => !seen.includes(op));
  if(fresh.length){
    seen.push(...fresh);
    shownAtSec = now;
  }
  const visible = shownAtSec !== null && now >= shownAtSec && now - shownAtSec < PC_HINT_DURATION_SEC;
  return { visible, seen, shownAtSec };
}
