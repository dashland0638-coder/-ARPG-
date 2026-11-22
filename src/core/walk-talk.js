/* 歩きながらの掛け合い(共通。DEC-029、docs/WALK_TALK.md)。
   最初の実装は道(新)の宿場(ROAD-VISUAL-003 R3-1)。第一章の他のシナリオへの横展開(WALK-TALK-CH1、DEC-033)で
   名前から road を外し、止める条件をここへ集めた(表示は legacy の walkTalkElement 一つ)。

   会話の窓を開かず、画面の下に一行ずつ流す。2〜3 行。終わると消える。
   会話・演出の間と戦闘の緊張が高い間は止めて隠す(重ならない)。同じ話題はその出撃で 1 回だけ。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

export const BANTER_LINE_SEC = 2.8;   // 一行を出しておく秒数(ゲーム内)
export const BANTER_GAP_SEC = 0.35;   // 行と行のあいだ
export const WALK_TALK_COMBAT_BLOCK = 0.35;   // 戦闘の緊張(combatIntensity)がこれ以上の間は止める
/* 会話の窓・演出(重要な出来事)でこれだけ止められた話題は、続きを流さずに捨てる(横展開のシナリオだけ。道は従来どおり続きから)。
   戦闘で止まった間は数えない(戦いの後に続きを流す) */
export const WALK_TALK_STALE_SEC = 3;

/* opts.staleSec: 会話・演出で止まった秒数がこれを超えたら、今の話題の残りを捨てる(省略 = 捨てない。道の従来の動き) */
export function newBanterState(opts){
  const st = {queue: [], cur: null, t: 0, seen: {}, hardT: 0};
  if(opts && Number.isFinite(opts.staleSec)) st.staleSec = opts.staleSec;
  return st;
}

/* 話題を足す(その出撃で 1 回だけ)。足したら true */
export function queueBanter(st, id, lines){
  if(!lines || !lines.length || st.seen[id]) return false;
  st.seen[id] = true;
  lines.forEach(([name, text])=> st.queue.push({id, name, text}));
  return true;
}

/* 今の話題(流している行と同じ id の残り)を捨てる */
export function dropCurrentBanter(st){
  const id = st.cur ? st.cur.id : (st.queue.length ? st.queue[0].id : null);
  if(id === null) return false;
  st.cur = null; st.t = 0;
  st.queue = st.queue.filter(q=> q.id !== id);
  return true;
}

/* 1 フレーム進める。blocked の間は止めて隠す。戻り値は今出す行(無ければ null)。
   hard: 止めている理由が会話の窓・演出(重要な出来事)か。staleSec を持つ状態だけが使う */
export function stepBanter(st, dt, blocked, hard){
  const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
  if(blocked){
    if(st.staleSec !== undefined && hard && (st.cur || st.queue.length)){
      st.hardT = (st.hardT || 0) + d;
      if(st.hardT > st.staleSec){ dropCurrentBanter(st); st.hardT = 0; }
    }
    return null;
  }
  st.hardT = 0;
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

/* 止める理由。hard = 会話の窓・演出(話題を古くする)。どれも無ければ null */
export function walkTalkBlock({dialogue, cutscene, paused, combat}){
  if(dialogue || cutscene) return 'hard';
  if(paused) return 'pause';
  if(Number.isFinite(combat) && combat >= WALK_TALK_COMBAT_BLOCK) return 'combat';
  return null;
}

/* 話題を出してよい顔ぶれか。topic.lead = 操作している主人公の職業、topic.guest = 同行している支援の職業。
   party = {lead, guest, guestHere}(guestHere: 支援が今そばにいる。合流待ちの間は偽) */
export function walkTalkPartyOk(topic, party){
  if(!topic || !party) return false;
  if(topic.lead && topic.lead !== party.lead) return false;
  if(topic.guest && (topic.guest !== party.guest || !party.guestHere)) return false;
  return true;
}

/* 出す行。retry(同じ出撃先へもう一度出た)で retryLines があればそちら。speakerName(classKey) → 表示名 */
export function walkTalkLines(topic, retry, speakerName){
  const src = retry && topic.retryLines ? topic.retryLines : topic.lines;
  return (src || []).map(([who, text])=> [speakerName ? speakerName(who) : who, text]);
}
