/* 段階的な出現 ―― 「一度に全部出さない」(WORK 5)。

   ■ なぜ要るのか
   商店街では水鏡の影・泡沫・写し身が同じ場所に居合わせる。全部を最初から
   出すと、プレイヤーは見分ける前に囲まれ、判断ではなく反射の戦いになる。
   時間差で出せば、「いま何に注意するか」を1つずつ足していける。

   ■ 難易度を上げる装置ではない
   波は敵の総数を増やすためのものではなく、**読む順番を作るため**のもの。
   だから最後の波まで出し切ったら終わりで、倒しても湧き足さない。

   ■ 正解の順番は決めない
   どの波から手を付けてもよい。ここが決めるのは「いつ現れるか」だけで、
   「何から倒すべきか」には一切関与しない。

   ■ 時間だけに縛らない
   波は「経過時間」か「合図(flag)」のどちらか早いほうで出る。水鏡の影が
   分裂したら次を出す、のように状況へ繋げられるようにしてある ――
   棒立ちでも進み、急いでも進む。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

/* 商店街の波。実機調整前の暫定値(ゲーム内秒)。
   at: 開始からこの秒数で出る / when: この合図が立ったら、時間前でも出る */
export const PROVISIONAL_MARKET_WAVES = [
  {id:'mirror', at:0,    spawn:'mirror', count:1},
  {id:'foam',   at:9.0,  spawn:'foam',   count:3, when:'mirrorEngaged'},
  {id:'copy',   at:20.0, spawn:'copy',   count:1, when:'mirrorSplit'},
];

/* いま出すべき波を返す(まだ出していないものだけ)。
   fired は出し終えた id の配列/Set。flags は {mirrorSplit:true} のような合図。 */
export function dueWaves(waves, elapsed, flags, fired){
  const out = [];
  const has = (id)=> fired && (fired.indexOf ? fired.indexOf(id) >= 0 : fired.has(id));
  for(let i=0;i<(waves||[]).length;i++){
    const w = waves[i];
    if(has(w.id)) continue;
    const byTime = elapsed >= w.at;
    const byFlag = !!(w.when && flags && flags[w.when]);
    if(byTime || byFlag) out.push(w);
  }
  return out;
}

/* 全部出し切ったか。出し切っていて、かつ敵が残っていなければ戦闘は終わり。 */
export function allWavesFired(waves, fired){
  return dueWaves(waves, Infinity, null, fired).length === 0;
}
