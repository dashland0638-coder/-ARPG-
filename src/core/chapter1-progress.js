/* Chapter 1 の進行 ―― 「いま誰が主人公で、次はどこへ行くのか」。

   ■ 新しい進行状態を作らない
   このモジュールは **何も保持しない**。答えはすべて、既にセーブされている
   `scenarioClears`(どのシナリオを何周クリアしたか)から導く:

     洋館を終えていない       → 剣士ひとり、次は洋館
     洋館を終えた             → 魔法使い＋剣士、次は宵待ちの村
     宵待ちの村を終えた       → 弓師＋魔法使い、次は幽霊船
     幽霊船を終えた           → 盗賊＋弓師、次は時計塔
     時計塔を終えた           → 5人目＋盗賊、次は道

   だから `state.chapter` のような章の変数は要らないし、セーブにも
   新しい項目が増えない。ロードしたら同じ式で同じ答えが出る。

   ■ 誰が主人公かは CHAPTER_CAST が決める
   キャストの表(01-character-creation.js の CHAPTER_CAST)は Chapter 1 の
   固定設計データで、このモジュールはそれを**読むだけ**。進行状態として
   書き換えることはしない ―― ここが返すのは「表の何段目か」だけ。

   ■ レベルでは進まない
   本編の次のシナリオは、レベルではなく**前のシナリオを終えたか**で決まる。
   推奨レベルの表示や敵の強さにレベルを使うのは今までどおり。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

/* Chapter 1 の正式な順序。CHAPTER_CAST の dungeonKey と同じ並びで、
   最後の「道」だけはまだシナリオの中身が無い(WORK 10 では入口までを繋ぐ)。 */
export const CHAPTER1_ORDER = ['mansion', 'duskvillage', 'ghostship', 'clocktower', 'road'];

const cleared = (clears, key)=> !!(clears && clears[key] > 0);

/* いま何段目か(1..CHAPTER1_ORDER.length+1)。

   **頭から連続でクリアした数**で数える ―― 途中を飛ばしてクリアした記録が
   あっても、順番は前に詰めない。章は一本道であって、飛び級は無い。 */
export function stageFor(clears){
  let n = 0;
  while(n < CHAPTER1_ORDER.length && cleared(clears, CHAPTER1_ORDER[n])) n++;
  return n + 1;
}

/* 次に挑むシナリオ。章を終えていれば null。 */
export function nextScenario(clears){
  const stage = stageFor(clears);
  return stage <= CHAPTER1_ORDER.length ? CHAPTER1_ORDER[stage - 1] : null;
}

export function isMainline(key){ return CHAPTER1_ORDER.indexOf(key) >= 0; }

/* 本編で出撃できるか。

   ・まだ来ていない先の話は出せない(章は一本道)
   ・一度クリアしたシナリオへは、いつでも戻れる(周回・★の育成のため)
   ・レベルは見ない */
export function mainlineAvailable(key, clears){
  if(!isMainline(key)) return true;          // 章の外(神殿・水路・温室など)はここでは決めない
  if(cleared(clears, key)) return true;      // 周回はいつでも
  return key === nextScenario(clears);
}

export function chapter1Complete(clears){ return nextScenario(clears) === null; }

/* その段のキャストを取り出す。cast は CHAPTER_CAST(1-indexed)をそのまま渡す。

   5人目(classKey が null)はまだ戦闘キットが無いので、**顔ぶれは前の段の
   ままにしておく** ―― 進行だけ先へ進めて、操作できないキャラクターに
   すり替わってしまう事故を防ぐ。支援も前の段のまま(表どおりに 'rogue' を
   採ると、主人公も支援も盗賊という妙な並びになってしまう)。 */
export function resolveCast(stage, cast){
  if(!cast) return null;
  const here = cast[stage];
  if(!here) return null;
  if(here.classKey) return {classKey: here.classKey, guestClassKey: here.guestClassKey || null,
                            gender: here.gender, personality: here.personality, playable: true};
  const prev = cast[stage - 1];
  if(!prev) return {classKey: null, guestClassKey: null, gender: null, personality: null, playable: false};
  return {classKey: prev.classKey, guestClassKey: prev.guestClassKey || null,
          gender: prev.gender, personality: prev.personality, playable: false};
}

/* 主人公が入れ替わるのはどの瞬間か。

   「いま操作しているクラス」と「進行から導いたクラス」が食い違ったときだけ
   true を返す ―― 酒場へ戻るたびに呼んでも、交代は各シナリオの直後に
   一度だけ起きる。 */
export function shouldSwitchCast(currentClassKey, resolved){
  if(!resolved || !resolved.classKey) return false;
  return currentClassKey !== resolved.classKey;
}
