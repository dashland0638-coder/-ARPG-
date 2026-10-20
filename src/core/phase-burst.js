/* ボスの段階移行の爆発の予兆(CH1-COMP W2-4a。設計 .ai/reports/CH1-COMBAT-PROTO-design.md §5.1)。

   いままで段階移行の爆発は、段階が変わった瞬間に予兆なしで起きていた
   (07-ai-combat.js triggerBossPhaseSkill)。宵待ちの村のボス「村の残響」だけ、
   爆発の前に足元の円が満ちていく予兆を出し、満ちきった瞬間に爆発させる。

   変えるのは「いつ爆発するか」だけ。半径・ダメージ・当たりの判定(ボスとの距離)は
   爆発の処理をそのまま使う。円の大きさは爆発の半径と同じ。

   ■ 1 体のボスに予兆は同時に 1 つだけ
   段階 1 → 3 を一気に削ると、段階 2 と段階 3 の爆発が続けて起きる。2 つの予兆を重ねて
   出すと円が二重になる。予兆が出ている間に来た次の爆発は「待ち」に数え、前の爆発が
   起きた瞬間に次の予兆を始める(爆発の回数は今までと同じ)。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

// 予兆の長さ(秒)。設計 §5.1「体が光る 0.8 秒の予兆＋足元の円」
export const PHASE_BURST_TELEGRAPH_SEC = 0.8;

// 予兆を出すボス。ほかのボスの段階移行は今までどおり即時(一括で広げない)
export const PHASE_BURST_TELEGRAPH_BOSSES = ['duskEcho'];

/** このボスの段階移行の爆発に予兆を出すか */
export function phaseBurstTelegraphed(bossKey) {
  return PHASE_BURST_TELEGRAPH_BOSSES.indexOf(bossKey) >= 0;
}

/** 空の待ち行列。active は進行中の予兆({t})、pending は後に控えている爆発の数 */
export function createPhaseBurstQueue() {
  return { active: null, pending: 0 };
}

/** 爆発を 1 つ足す。予兆が無ければすぐ始めて 'start'、進行中なら 'queued' */
export function enqueuePhaseBurst(queue) {
  if (!queue.active) { queue.active = { t: 0 }; return 'start'; }
  queue.pending++;
  return 'queued';
}

/** 予兆の進み具合(0〜1)。予兆が無ければ null */
export function phaseBurstProgress(queue, dur = PHASE_BURST_TELEGRAPH_SEC) {
  if (!queue.active) return null;
  return Math.max(0, Math.min(1, queue.active.t / dur));
}

/* 1 フレーム進める。
   返り値:
     fired   … このフレームで予兆が満ちた(呼び出し側が爆発を 1 回起こす)
     started … 爆発の直後に、待っていた次の予兆を始めた
     progress… 進行中の予兆の進み具合(0〜1)。予兆が無ければ null
   1 フレームで起きる爆発は多くても 1 回。dt が予兆より長くても 2 回は起こさない
   (次の予兆は 0 から数え直す)。 */
export function advancePhaseBurst(queue, dt, dur = PHASE_BURST_TELEGRAPH_SEC) {
  const out = { fired: false, started: false, progress: null };
  if (!queue.active) return out;
  queue.active.t += Math.max(0, dt || 0);
  if (queue.active.t >= dur) {
    out.fired = true;
    if (queue.pending > 0) {
      queue.pending--;
      queue.active = { t: 0 };
      out.started = true;
    } else {
      queue.active = null;
    }
  }
  out.progress = phaseBurstProgress(queue, dur);
  return out;
}

/** 予兆と待ちをすべて捨てる(ボスの撃破・戦闘の仕切り直し・場所の移動)。捨てた爆発の数を返す */
export function cancelPhaseBurst(queue) {
  const n = (queue.active ? 1 : 0) + queue.pending;
  queue.active = null;
  queue.pending = 0;
  return n;
}
