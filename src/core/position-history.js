/* プレイヤーの位置履歴 ―― 「少し前にどこにいたか」(WORK 5)。

   ■ なぜ要るのか
   記憶漁師は、プレイヤーがいま立っている場所ではなく、少し前に立っていた
   場所へ網を投げる。追尾ではないので、敵側から現在位置を引くだけでは作れない
   ―― 数秒ぶんの足取りをどこかに残しておく必要がある。

   ■ どれだけ残すか
   必要なのは「1秒前後まで遡れること」だけ。無制限に貯めると、長く遊ぶほど
   配列が伸びていくので、保持時間を決めて古いものから捨てる。
   間隔を空けて記録するのは、毎フレーム押すと fps によって同じ1秒の中身の
   密度が変わってしまうため ―― この環境(実測1.6fps)と実機とで、遡れる
   長さが変わらないようにしている。

   ■ 誰のものでもよい
   プレイヤー専用にしていない。位置と時刻の配列を渡せば動くので、将来
   同行者や敵の足取りを追う敵が出ても同じものが使える。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

// 実機調整前の暫定値
export const PROVISIONAL_HISTORY_SEC = 3.0;    // これより古い足取りは捨てる
export const PROVISIONAL_HISTORY_STEP = 0.12;  // 記録の間隔(秒)

/* 履歴へ1点足す。前の記録から step 秒経っていなければ何もしない。
   足したあと、keep 秒より古いものを先頭から捨てる。
   history は呼び出し側が持つ配列(古い順)。戻り値は足したかどうか。 */
export function recordPosition(history, t, x, y, z, opts){
  if(!history) return false;
  opts = opts || {};
  const step = opts.step != null ? opts.step : PROVISIONAL_HISTORY_STEP;
  const keep = opts.keep != null ? opts.keep : PROVISIONAL_HISTORY_SEC;
  const last = history[history.length - 1];
  if(last && t - last.t < step) return false;
  history.push({t, x, y, z});
  pruneHistory(history, t, keep);
  return true;
}

/* keep 秒より古い記録を捨てる。先頭から順に消すだけ(古い順に入っている)。 */
export function pruneHistory(history, t, keep){
  if(!history) return;
  const limit = t - (keep != null ? keep : PROVISIONAL_HISTORY_SEC);
  let drop = 0;
  while(drop < history.length && history[drop].t < limit) drop++;
  if(drop > 0) history.splice(0, drop);
}

/* ago 秒前の位置。ぴったりの記録は無いので、いちばん近い時刻のものを返す。

   まだ ago 秒ぶん歩いていない(履歴が短い)ときは、持っている中で
   いちばん古いものを返す ―― null を返すと「網が飛んでこない敵」に
   なってしまい、出会い頭だけ無力になる。履歴が空のときだけ null。 */
export function positionAt(history, t, ago){
  if(!history || !history.length) return null;
  const want = t - ago;
  let best = history[0], bestD = Math.abs(best.t - want);
  for(let i=1;i<history.length;i++){
    const d = Math.abs(history[i].t - want);
    if(d < bestD){ bestD = d; best = history[i]; }
  }
  return best;
}

/* 履歴の長さ(秒)。まだ短いかどうかを呼び出し側が知りたい時に使う。 */
export function historySpan(history){
  if(!history || history.length < 2) return 0;
  return history[history.length - 1].t - history[0].t;
}
