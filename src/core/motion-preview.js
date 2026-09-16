/* Debug Motion Preview の純粋部分。
   state・three.js・シーンに一切依存しないので tests/unit/ から直接呼べる
   (core/combat-stance.js / core/look-rig.js と同じ切り出し方)。

   ■ この module が「やらないこと」
   ここにあるのは **表示のための読み取りと文字列化だけ** で、ゲームの
   状態を作らない・変えない。モーションの状態機械を新しく足すものでも
   ない ―― 下の motionStateLabel() は、既にある state(dodging /
   swinging / skillCharging / combatStanceT / postSwingT)を、引き継ぎ
   資料が使っていた語彙へ **後から貼るラベル** に過ぎない。

   ■ なぜラベルを貼るのか
   資料は SOCIAL / EXPLORATION / DRAWING / COMBAT / ATTACK / DODGE /
   POST_COMBAT / SHEATHING という状態機械を前提に書かれているが、この
   実装にその状態機械は無い(13-update-loop.js の updateLookRig の
   コメントに、同じ対応付けが既に書かれている)。実機でモーションを
   見ながら「今どの局面か」を確かめるには、画面に出る語彙が資料と
   揃っている方が速い ―― それだけのための対応表で、分岐はどこにも
   増えていない。 */

import { COMBAT_STANCE_FADE, SETTLE_SECONDS } from './combat-stance.js';

/* 資料の語彙。実装側の state からこの順で判定する(先に来たものが勝つ)。
   順序そのものが仕様なので、表として外へ出しておく。 */
export const MOTION_STATES = [
  'DODGE', 'ATTACK', 'DRAWING', 'POST_COMBAT', 'COMBAT', 'SHEATHING',
  'SOCIAL', 'EXPLORATION',
];

/* 既存 state → 資料のラベル。
   snap は plain object で、以下のキーだけを見る:
     dodging, swinging, skillCharging, ultAiming, dialogueActive,
     combatStanceT, postSwingT
   どれが欠けていても falsy 扱いになるだけで、例外は投げない。 */
export function motionStateLabel(snap){
  const s = snap || {};
  if(s.dodging) return 'DODGE';
  if(s.swinging) return 'ATTACK';
  // 溜め/必殺技の構え = 資料の「武器を抜く・魔法を構える」局面
  if(s.skillCharging || s.ultAiming) return 'DRAWING';
  const stance = s.combatStanceT || 0;
  if(stance > 0){
    /* 振り終わった直後の settle 区間(core/combat-stance.js の
       settleBoost が揺れを大きく取っている間)が資料の POST_COMBAT。 */
    if((s.postSwingT || 0) < SETTLE_SECONDS) return 'POST_COMBAT';
    // 態勢がフェードに入った = 構えを解いていく途中 = SHEATHING
    if(stance <= COMBAT_STANCE_FADE) return 'SHEATHING';
    return 'COMBAT';
  }
  if(s.dialogueActive) return 'SOCIAL';
  return 'EXPLORATION';
}

/* 武器の表示名。サブ武器を握っているかどうかまで出す ―― 「Combat 中に
   杖が右手へ移ったか」のような確認は、構えの名前が見えないと判別が遅い。 */
export function weaponLabel(classKey, altKey, usingAlt){
  const main = classKey || '-';
  if(usingAlt && altKey) return `${altKey} (alt)`;
  return main;
}

const DEG = 180 / Math.PI;
function deg(v){
  const n = Number(v);
  if(!Number.isFinite(n)) return '  -  ';
  const d = n * DEG;
  // 符号の位置が揃っていないと、動いている数字は読めない
  return (d >= 0 ? ' ' : '') + d.toFixed(1);
}

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '-';
}
function vec3(v){
  if(!Array.isArray(v)) return '  -  ';
  return deg(v[0]) + ' /' + deg(v[1]) + ' /' + deg(v[2]);
}

/* パネル本文。textContent へそのまま入れる行の配列を返す。
   数値の整形までここでやるのは、「表示がずれていないこと」まで
   ユニットテストで見られるようにするため。 */
export function motionDebugLines(snap){
  const s = snap || {};
  const lines = [
    'MOTION PREVIEW',
    'JOB    ' + (s.jobKey || s.classKey || '-'),
    'CLASS  ' + (s.classKey || '-'),
    'STATE  ' + motionStateLabel(s),
    'WEAPON ' + weaponLabel(s.classKey, s.altKey, s.usingAlt),
    'ACTION ' + (s.swinging ? (s.moveClip || 'basic') : '-'),
    'FREEZE ' + (s.freeze ? 'ON' : 'off'),
    '',
    'LOOK',
    ' TARGET ' + (s.lookTarget || 'none'),
    ' T.YAW  ' + deg(s.lookYaw),
    ' WAIST  ' + deg(s.waistYaw),
    ' HEAD   ' + deg(s.headYaw) + ' /' + deg(s.headPitch),
    ' EYES   ' + deg(s.eyeYaw) + ' /' + deg(s.eyePitch),
  ];
  /* この確認セッションで一度でも通った局面。パネルは0.5秒に1回しか
     描き直さないので、ATTACK や DODGE のように一瞬しか立たない局面は
     「今の STATE」だけ見ていると取りこぼす ―― 「さっき確かに通った」が
     残らないと、実機で見ながら一通り確認したのかが分からない。
     記録そのものは毎フレーム側(14-hud-boot.js)で行う。 */
  if(s.seen && s.seen.length){
    lines.push('', 'SEEN   ' + MOTION_STATES.filter(k=>s.seen.indexOf(k)>=0).join(' '));
  }
  if(s.idleProfile){
    const p = s.idleProfile;
    lines.push('', s.dedicatedIdle ? 'IDLE (dedicated)' : 'IDLE (base x mul)');
    lines.push(' SPEED  ' + p.rate.toFixed(2));
    lines.push(' STAFF  ' + p.weapon.toFixed(3));
    lines.push(' HAND   ' + (p.handL != null ? p.handL.toFixed(3) : '-'));
    lines.push(' WRIST  ' + (p.wrist != null ? p.wrist.toFixed(3) : '-'));
    lines.push(' WEIGHT ' + p.sway.toFixed(3));
    lines.push(' BREATH ' + p.breath.toFixed(3));
    lines.push(' STANCE ' + (s.stanceWeight != null ? s.stanceWeight.toFixed(2) : '-'));
  }
  /* リグの実測値。Phase 3.5-B の実機確認で必要になった ―― 魔法使い系は
     帽子のつばが真上からの視点で腕と杖を完全に隠すため、非戦闘の腕が
     本当に下りているのかを画面の絵から判定できない。数字で見るしかない。
     読み取り元は playerMixerParts の回転そのもの(05-rendering-rig.js の
     motionRigSnapshot)で、ここも 14-hud-boot.js 側もデバッグモードで
     しか走らない。通常プレイの HUD には何も足していない。 */
  /* 処刑(Phase 4)。敵側の Break / Execution Window と、プレイヤー側の
     フィニッシャー再生を1ブロックにまとめる。デバッグモードでしか
     走らず、通常HUDには何も足していない(資料29章)。 */
  if(s.exec){
    const e = s.exec;
    lines.push('', 'EXECUTION');
    lines.push(' E.TGT  ' + (e.target || 'none'));
    lines.push(' BREAK  ' + (e.breakState || '-'));
    lines.push(' WINDOW ' + (e.windowT != null ? num(e.windowT) + 's' : '-')
      + (e.leadT ? '  (lead ' + num(e.leadT) + 's)' : ''));
    lines.push(' FINISH ' + (e.finishable ? 'yes' : 'no')
      + '   PLAYING ' + (e.executeT != null ? num(e.executeT) + 's' : '-'));
    // 「窓は開いているのに押せない」の切り分け(間合い / 向き / 行動中)
    lines.push(' REACH  ' + (e.reach ? num(e.reach.dist) + 'm /' + deg(e.reach.angle) : '-')
      + '   INPUT ' + (e.canInput ? 'ok' : 'busy'));
  }
  if(s.rig){
    const r = s.rig;
    lines.push('', 'RIG');
    lines.push(' RELAX  ' + num(r.relaxWeight)
      + '  (stop ' + num(r.stopBlend) + ' / combat ' + num(r.combatBlend) + ')');
    lines.push(' SH.L  ' + vec3(r.shL));
    lines.push(' SH.R  ' + vec3(r.shR));
    lines.push(' EL.L  ' + deg(r.elL) + '   EL.R ' + deg(r.elR));
    lines.push(' WEP   ' + vec3(r.wep));
  }
  return lines;
}
