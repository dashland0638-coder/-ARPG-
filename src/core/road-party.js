/* 道（新）の一行（ROAD-VISUAL-003 R3-4、DEC-025 E-1〜E-3）。

   ■ 一行全員が道を歩く。戦闘に出るのは 2 人だけ（E-2）
   主人公（操作キャラクター）と支援 AI の 2 人が戦う。残りの仲間は「同行者」で、
   会話の場面や野営地の焚き火のそばに立つ。支援は野営地で選び直せる。

   ■ 到達したエリアだけを保存する（E-3）
   保存するのは到達したエリアの番号（0〜5）ひとつ。加入したかどうかは、それから導く。
   エリア 4 の到達は、出会いの一幕で加入した時にだけ記録する ―― だから
   「到達 4 以上 = 加入済み」が必ず成り立つ（加入せずに北へ抜けても 3 で止める）。

   state・THREE・scene に依存しない（ARCHITECTURE.md の core/ の作法）。 */

/* 第一章の四人（加入前の一行）。並びは野営地の選ぶ画面の並び */
export const ROAD_PARTY = Object.freeze(['warrior', 'mage', 'archer', 'rogue']);
/* 道で出会って加入する 5 人目 */
export const ROAD_JOINER = 'wanderer';
/* 出会いと加入の野営地のエリア */
export const ROAD_JOIN_AREA = 4;
/* 到達の番号の範囲(0 = まだ道に出ていない / 旧セーブ) */
export const ROAD_AREA_MAX = 5;

/* 一行の全員(加入後は 5 人目を含む) */
export function roadPartyMembers(joined){
  return joined ? ROAD_PARTY.concat([ROAD_JOINER]) : ROAD_PARTY.slice();
}

/* 野営地で選べる支援: 一行から主人公を除いた全員 */
export function roadSupportOptions(protagonist, joined){
  return roadPartyMembers(joined).filter(k => k !== protagonist);
}

/* 戦闘に出る 2 人(主人公と支援)。支援が一行にいなければ主人公だけ */
export function roadBattleMembers(protagonist, support, joined){
  const out = [protagonist];
  if(support && support !== protagonist && roadPartyMembers(joined).concat([protagonist]).includes(support)) out.push(support);
  return out;
}

/* 戦闘に出ない同行者(会話の場面・野営地に立つ) */
export function roadCompanions(protagonist, support, joined){
  const battle = roadBattleMembers(protagonist, support, joined);
  return roadPartyMembers(joined).filter(k => !battle.includes(k));
}

/* セーブから読んだ到達の番号。無い・壊れた値は 0(最初から) */
export function sanitizeRoadArea(v){
  const n = Math.floor(Number(v));
  if(!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, ROAD_AREA_MAX);
}

/* 到達を記録する。戻らない(大きい方)。加入していなければ加入のエリアの手前で止める */
export function recordRoadArea(prev, area, joined){
  const p = sanitizeRoadArea(prev);
  let a = sanitizeRoadArea(area);
  if(!joined && a >= ROAD_JOIN_AREA) a = ROAD_JOIN_AREA - 1;
  return Math.max(p, a);
}

/* 到達したエリアから、加入したかどうかを導く */
export function roadJoinedFromArea(area){
  return sanitizeRoadArea(area) >= ROAD_JOIN_AREA;
}

/* 出撃し直した時に始める野営地のエリア。2 未満(宿場・旧セーブ)は入口から(null) */
export function roadStartCamp(area){
  const a = sanitizeRoadArea(area);
  return a >= 2 ? a : null;
}
