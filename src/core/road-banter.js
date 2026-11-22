/* 歩きながらの掛け合い(ROAD-VISUAL-003 R3-1、設計 §5.1「新しく作る表示。操作を止めない」)。

   会話の窓を開かず、画面の下に一行ずつ流す。2〜3 行。終わると消える。
   会話・演出の間と戦闘の緊張が高い間は止めて隠す(重ならない)。同じ話題はその出撃で 1 回だけ。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

export const BANTER_LINE_SEC = 2.8;   // 一行を出しておく秒数(ゲーム内)
export const BANTER_GAP_SEC = 0.35;   // 行と行のあいだ

export function newBanterState(){ return {queue: [], cur: null, t: 0, seen: {}}; }

/* 話題を足す(その出撃で 1 回だけ)。足したら true */
export function queueBanter(st, id, lines){
  if(!lines || !lines.length || st.seen[id]) return false;
  st.seen[id] = true;
  lines.forEach(([name, text])=> st.queue.push({id, name, text}));
  return true;
}

/* 1 フレーム進める。blocked の間は止めて隠す。戻り値は今出す行(無ければ null) */
export function stepBanter(st, dt, blocked){
  if(blocked) return null;
  const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
  if(!st.cur){
    if(!st.queue.length) return null;
    st.t += d;
    if(st.t < BANTER_GAP_SEC) return null;
    st.cur = st.queue.shift(); st.t = 0;
    return st.cur;
  }
  st.t += d;
  if(st.t >= BANTER_LINE_SEC){ st.cur = null; st.t = 0; return null; }
  return st.cur;
}
