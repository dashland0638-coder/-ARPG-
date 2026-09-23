/* Chapter 1 の進行 ―― 「いま誰が主人公で、次はどこへ行くのか」。

   ■ 新しい進行状態を作らない
   このモジュールは **何も保持しない**。答えはすべて、既にセーブされている
   `scenarioClears`(どのシナリオを何周クリアしたか)から導く:

     洋館を終えていない       → 剣士ひとり、次は洋館
     洋館を終えた             → 魔法使い＋剣士、次は宵待ちの村
     宵待ちの村を終えた       → 弓師＋魔法使い、次は幽霊船
     幽霊船を終えた           → 盗賊＋弓師、次は時計塔
     時計塔を終えた           → 盗賊＋弓師のまま、次は道(5人目とは道の途中で会う)
     道を終えた               → 5人目＋盗賊。Chapter 1 はここで終わる

   だから `state.chapter` のような章の変数は要らないし、セーブにも
   新しい項目が増えない。ロードしたら同じ式で同じ答えが出る。

   ■ 誰が主人公かは CHAPTER_CAST が決める
   キャストの表(01-character-creation.js の CHAPTER_CAST)は Chapter 1 の
   固定設計データで、このモジュールはそれを**読むだけ**。進行状態として
   書き換えることはしない ―― ここが返すのは「表の何段目か」だけ。

   ■ 一本道(WORK 11)
   Chapter 1 は「自由に遊べる前の一本道」。酒場から出られるのは
   **いま進めているシナリオひとつだけ**で、クリア済みへは戻れないし、
   章の外のシナリオも出てこない。死んでも進行は巻き戻らず、同じ
   シナリオをもう一度始めるだけ。自由に選べるようになるのは Chapter 2
   (まだ実装していない)から。

   ■ レベルでは進まない
   本編の次のシナリオは、レベルではなく**前のシナリオを終えたか**で決まる。
   推奨レベルの表示や敵の強さにレベルを使うのは今までどおり。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

/* Chapter 1 の正式な順序。CHAPTER_CAST の dungeonKey と同じ並び。 */
export const CHAPTER1_ORDER = ['mansion', 'duskvillage', 'ghostship', 'clocktower', 'road'];

/* その段の主人公と「シナリオの途中で初めて出会う」シナリオ。

   道の5人目は、酒場で待っているのではなく道の途中で見つかる ――
   だから道へ出るときの顔ぶれは前の段(盗賊＋弓師)のままで、
   5人目の段(CHAPTER_CAST[5])に切り替わるのは道の中の出会いの場面から。
   その切り替えはシナリオの一幕なので、ここでは「道を終えるまでは前の段の
   顔ぶれで数える」とだけ決めておく。 */
export const MET_INSIDE = ['road'];

const cleared = (clears, key)=> !!(clears && clears[key] > 0);

/* いま何段目か(1..CHAPTER1_ORDER.length+1)。

   **頭から連続でクリアした数**で数える ―― 途中を飛ばしてクリアした記録が
   あっても、順番は前に詰めない。章は一本道であって、飛び級は無い。 */
export function stageFor(clears){
  let n = 0;
  while(n < CHAPTER1_ORDER.length && cleared(clears, CHAPTER1_ORDER[n])) n++;
  return n + 1;
}

/* 次に挑むシナリオ。章を終えていれば null。
   死んで酒場へ戻ったときに「もう一度始める」のも、これと同じもの ――
   死んでも scenarioClears は増えないので、答えは変わらない。 */
export function nextScenario(clears){
  const stage = stageFor(clears);
  return stage <= CHAPTER1_ORDER.length ? CHAPTER1_ORDER[stage - 1] : null;
}

export function isMainline(key){ return CHAPTER1_ORDER.indexOf(key) >= 0; }

export function chapter1Complete(clears){ return nextScenario(clears) === null; }

/* 酒場から出撃できる行き先の一覧。

   Chapter 1 の途中 … いま進めているシナリオひとつだけ(再訪なし・寄り道なし)
   Chapter 1 の後   … 空。Chapter 2 の入口は別に出すが、行き先そのものは
                      Chapter 2 の仕様で決める(まだ実装していない) */
export function offeredScenarios(clears){
  const next = nextScenario(clears);
  return next ? [next] : [];
}

/* 本編で出撃できるか。offeredScenarios に入っているものだけ。
   レベルは見ない。 */
export function mainlineAvailable(key, clears){
  return offeredScenarios(clears).indexOf(key) >= 0;
}

/* その段のキャストを取り出す。cast は CHAPTER_CAST(1-indexed)をそのまま渡す。

   ・ふつうの段 … 表のとおり
   ・MET_INSIDE の段(道) … 出会うまでは前の段のまま
   ・章を終えた後 … 最後の段のまま(5人目＋盗賊) */
export function resolveCast(stage, cast){
  if(!cast) return null;
  const last = cast.length - 1;
  if(stage > last){
    const tail = cast[last];
    return (stage === last + 1 && tail && tail.classKey) ? rowToCast(tail, true) : null;
  }
  const here = cast[stage];
  if(!here) return null;
  const metInside = MET_INSIDE.indexOf(CHAPTER1_ORDER[stage - 1]) >= 0;
  if(here.classKey && !metInside) return rowToCast(here, true);
  const prev = cast[stage - 1];
  if(!prev) return {classKey: null, guestClassKey: null, gender: null, personality: null, playable: false};
  return rowToCast(prev, !!prev.classKey);
}

/* シナリオの中で出会ったあとの顔ぶれ(道の出会いの場面で使う)。
   表の段そのもの。 */
export function castAfterMeeting(stage, cast){
  const here = cast && cast[stage];
  return here && here.classKey ? rowToCast(here, true) : null;
}

function rowToCast(row, playable){
  return {classKey: row.classKey, guestClassKey: row.guestClassKey || null,
          gender: row.gender, personality: row.personality, playable};
}

/* 主人公が入れ替わるのはどの瞬間か。

   「いま操作しているクラス」と「進行から導いたクラス」が食い違ったときだけ
   true を返す ―― 酒場へ戻るたびに呼んでも、交代は各シナリオの直後に
   一度だけ起きる。 */
export function shouldSwitchCast(currentClassKey, resolved){
  if(!resolved || !resolved.classKey) return false;
  return currentClassKey !== resolved.classKey;
}

/* 表の何段目の主人公か(見つからなければ 0)。 */
export function castIndexOf(classKey, cast){
  if(!cast || !classKey) return 0;
  for(let i = 1; i < cast.length; i++) if(cast[i] && cast[i].classKey === classKey) return i;
  return 0;
}

/* 交代が「前へ進む」ものか。

   酒場で新しい主人公が現れるのは前へ進んだときだけで、道の途中で
   5人目と会ったあとに撤退・全滅して盗賊へ戻るときは、戻るだけ ――
   加入の一幕は出さない。 */
export function isForwardSwitch(prevClassKey, nextClassKey, cast){
  return castIndexOf(nextClassKey, cast) > castIndexOf(prevClassKey, cast);
}
