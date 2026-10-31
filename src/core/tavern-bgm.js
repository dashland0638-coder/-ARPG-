/* 酒場 BGM の加入段階(MUSIC-BGM-TAVERN-002)。

   作曲アプリ v5.70.0 の「酒場BGMの成長」(TAVERN_STAGE_POLICY)は、同じ曲(主旋律・和音)に仲間の加入ごとに
   楽器を足していく 6 段階を持つ。ゲームはその段階ごとの書き出し(public/audio/bgm/tavern-<n>-<stage>.mp3)を、
   第一章の進行に合わせて鳴らす:

     swordsman  剣士加入            … 剣士ひとり(洋館の前)
     mage       魔法使い加入        … 魔法使いとの交代の会話の後
     archer     弓師加入            … 弓師との交代の会話の後
     thief      盗賊加入            … 盗賊との交代の会話の後
     shadow     影の旅人加入        … 道を終えて戻った酒場の、第一章の最後の会話の間
     complete   第一章クリア後・完成版 … 第一章の最後の会話が終わった後(Chapter 2 の入口)

   ■ 新しい進行状態を作らない
   答えはセーブ済みの `scenarioClears` と、いま操作している主人公(selectedClass)から出す(core/chapter1-progress.js と同じ作法)。
     - 進行から導いた顔ぶれ(resolveCast)と、いまの主人公の、**早い方の段**を取る。
       洋館から戻った直後は、進行は魔法使いの段でも、交代の会話が終わるまで主人公は剣士のまま → 剣士の段。
       会話の後に主人公が替わった瞬間に、次の段へ進む。
       道の途中で影の旅人と出会ってから撤退した場合は、主人公は影の旅人でも、進行は盗賊の段 → 盗賊の段。
     - 第一章を終えた(道をクリアした)後は完成版。ただし、戻ってすぐの第一章の最後の会話の間だけは影の旅人の段
       (影の旅人が酒場にいるのはここが最初。finaleActive は出撃中の一度きりのフラグで、セーブしない)。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */
import { stageFor, resolveCast, chapter1Complete } from './chapter1-progress.js';

export const TAVERN_BGM_STAGES = ['swordsman', 'mage', 'archer', 'thief', 'shadow', 'complete'];

function castIndex(classKey, cast){
  if(!classKey || !cast) return 0;
  for(let i = 1; i < cast.length; i++) if(cast[i] && cast[i].classKey === classKey) return i;
  return 0;
}

/* clears: state.scenarioClears / classKey: いまの主人公 / cast: CHAPTER_CAST(1-indexed) /
   finaleActive: 第一章の最後の会話の最中(または、これから始まる)か */
export function tavernBgmStage({ clears, classKey, cast, finaleActive = false } = {}){
  if(chapter1Complete(clears) && !finaleActive) return 'complete';
  const resolved = resolveCast(stageFor(clears), cast);
  const fromProgress = castIndex(resolved && resolved.classKey, cast) || 1;
  const fromHero = castIndex(classKey, cast) || fromProgress;      // 表に無い主人公(古いセーブ等)は進行だけで決める
  const n = Math.max(1, Math.min(fromProgress, fromHero, TAVERN_BGM_STAGES.length - 1));
  return TAVERN_BGM_STAGES[n - 1];
}
