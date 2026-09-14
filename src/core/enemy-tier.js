/* 敵の階層と、階層ごとの「大怯みで行動が止まるか」。

   ■ 背景(解析で分かったこと)
   この実装には怯みで敵の行動を中断する仕組みが元々無かった。AIを止めて
   いるのはダウン(体幹100%)と切り上げの浮きだけで、大怯み(体幹70%)は
   en.hurtT を 0.5 秒へ伸ばしてトーストを出すだけ ―― 胴体のスカッシュ表示
   にしか効いておらず、突進の溜めも突進そのものも止まらなかった。

   つまり「通常敵は殴っていれば攻撃を潰せる / 強モブは潰せない」という
   対比は、強モブ側にスーパーアーマーを足しても生まれない。全員が既に
   止まらないからで、必要なのは逆 ―― **通常敵にだけ中断を与える**こと。
   既にある 70% の閾値へ意味を持たせるだけなので、新しい数値体系も
   新しいステートも増えない。

   ■ 階層
     通常敵   大怯みで攻撃を中断する。ダウンは従来どおり
     強モブ   中断しない(guardian も同じ扱い)
     ネームド 中断しない。戦闘基盤は強モブと同じで、差は報酬で付ける
     ボス     中断しない。専用AIとフェーズを持つ

   ■ 責務の切り分け
     「大怯みが発生したか」        … core/combat-result.js(既存)
     「どの状態が予兆か」          … core/punish-window.js(既存)
     「中断してよい階層か / 何を打ち切るか」… このファイル
     実際に en を書き換える副作用  … 07-ai-combat.js(THREE/state に依存)
*/
import { punishWindowState } from './punish-window.js';

export const TIER = {
  NORMAL: 'normal',
  ELITE:  'elite',
  NAMED:  'named',
  BOSS:   'boss',
};

/* 判定の順番が意味を持つ。ネームドは実装上ほぼ必ず strongMob も立って
   いる(洋館の「燭台を提げた影」など4体すべて)ので、先に名前を見ないと
   全部 elite に落ちてしまう。 */
export function enemyTier(en){
  if(!en) return TIER.NORMAL;
  if(en.isBoss) return TIER.BOSS;
  if(en.midbossName) return TIER.NAMED;
  if(en.strongMob || en.guardian) return TIER.ELITE;
  return TIER.NORMAL;
}

// 大怯みで止まる秒数。ダウン(通常敵3.0秒/ボス2.2秒)とは別物で、
// 「振りかぶりを潰された」ぶんの短い硬直
export const BIG_FLINCH_STUN_SEC = 0.4;

export function shouldInterruptOnBigFlinch(en){
  return enemyTier(en) === TIER.NORMAL;
}

/* 大怯きが起きたとき、その敵に何をするかの決定。
   呼び出し側(07-ai-combat.js)はこの結果に従って en を書き換えるだけ。

   cancelWindup は「まだ振り抜いていない予兆」だけを打ち切るための印。
   どの状態が予兆かは punishWindowState の midWindup と同じ定義を使う ――
   予兆中の一撃は体幹が 1.6 倍入る窓でもあるので、「溜めを狙えば余計に
   削れて、しかも潰せる」が一つの定義でつながる。

   既に踏み込んだ突進(dash)や飛びかかり(lunge)は打ち切らない。宙で
   当たり判定だけが消えるし、読んで避ける対象そのものが無くなるため。 */
export function bigFlinchInterrupt(en){
  if(!shouldInterruptOnBigFlinch(en)){
    return { interrupt: false, cancelWindup: false, stunSec: 0 };
  }
  const { midWindup } = punishWindowState(en);
  return { interrupt: true, cancelWindup: !!midWindup, stunSec: BIG_FLINCH_STUN_SEC };
}
