/* 道(新)の宝箱と、道だけの固定の報酬表(ROAD-VISUAL-003 R3-6、DEC-025 E-4 = A)。

   ■ 決まり(E-4)
   ・宝箱の ID × 職業で中身が決まる。ランダムではない
   ・武器は職業の武器の種類(native)。装備は少しだけ(1 職業あたり 7 品まで)
   ・同じ品を二度は渡さない(持っていれば薬草に替える)。補給の箱は薬草と魔力の雫
   ・宝箱の開け閉めはその出撃の間だけ覚える(DEC-025 E-3。保存は到達したエリアだけ)

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */
import { equipmentStatBonus } from './loot-math.js';

/* 設計 §2 の宝箱の数: 宿場 補給 2・武具 1/原野 補給 2・武具 2/谷 補給 2・武具 1・特別 1/山道 補給 2・武具 2/道の果て なし */
export const ROAD2_CHESTS = Object.freeze([
  {id:'C1-1', area:1, x:1104.8, z:41,    kind:'supply'},    // 宿場: 通りの東の樽の脇
  {id:'C1-2', area:1, x:1064,   z:86,    kind:'supply'},    // 宿場: 物置の庭の奥(隠し道の先)
  {id:'C1-3', area:1, x:1134,   z:64,    kind:'armoury'},   // 宿場: 裏庭の北(寄り道)
  {id:'C2-1', area:2, x:1032,   z:196,   kind:'supply'},    // 原野: 旧道の脇
  {id:'C2-2', area:2, x:1022,   z:290,   kind:'supply'},    // 原野: 展望の高台
  {id:'C2-3', area:2, x:1188,   z:226,   kind:'armoury'},   // 原野: 東の岩場(隠し道)
  {id:'C2-4', area:2, x:1176,   z:276,   kind:'armoury'},   // 原野: 岩場の奥(高難度 F2-X の先)
  {id:'C3-1', area:3, x:1150,   z:352,   kind:'supply'},    // 谷: 浅瀬の遺構
  {id:'C3-2', area:3, x:1050,   z:340,   kind:'supply'},    // 谷: 西の崖の道
  {id:'C3-3', area:3, x:1048,   z:378,   kind:'armoury'},   // 谷: 滝の裏の岩棚
  {id:'C3-4', area:3, x:1050,   z:410,   kind:'special'},   // 谷: 隠しの淵(淵の大鰻の先)
  {id:'C4-1', area:4, x:1074,   z:507.5, kind:'supply'},    // 山道: 森の外周の脇
  {id:'C4-2', area:4, x:1039,   z:578,   kind:'supply'},    // 山道: 地下の通路(狭間)の奥
  {id:'C4-3', area:4, x:1141.5, z:586.5, kind:'armoury'},   // 山道: 遺構の東の部屋
  {id:'C4-4', area:4, x:1146,   z:622,   kind:'armoury'},   // 山道: 峠の手前(番石の先)
].map(Object.freeze));

/* 武具の箱の順(道を進む順)。どの部位・どの強さか。特別の一品は武器の強いもの */
const ARMOURY_PLAN = Object.freeze({
  'C1-3': {slot:'lower',  level:4},
  'C2-3': {slot:'weapon', level:5},
  'C2-4': {slot:'upper',  level:6},
  'C3-3': {slot:'lower',  level:7},
  'C3-4': {slot:'weapon', level:9, special:true},
  'C4-3': {slot:'upper',  level:8},
  'C4-4': {slot:'weapon', level:8},
});

/* 名前(職業ごと)。武器は職業の武器の種類 */
const NAMES = Object.freeze({
  weapon: {warrior:['旅路の剣', '峠越えの長剣'], rogue:['旅路の短剣', '峠越えの双刃'], mage:['旅路の杖', '峠越えの長杖'], archer:['旅路の弓', '峠越えの長弓'], wanderer:['旅路の刃', '峠越えの刃']},
  upper:  {warrior:['街道の胸当て', '遺構の鎧'], rogue:['街道の胴着', '遺構の革鎧'], mage:['街道のローブ', '遺構の外套'], archer:['街道の胴衣', '遺構の狩衣'], wanderer:['街道の外套', '遺構の外套']},
  lower:  {warrior:['宿場の具足', '谷渡りの具足'], rogue:['宿場の脚衣', '谷渡りの脚衣'], mage:['宿場の裾衣', '谷渡りの裾衣'], archer:['宿場の脚衣', '谷渡りの脚衣'], wanderer:['宿場の脚衣', '谷渡りの脚衣']},
  special:{warrior:'淵守りの剣', rogue:'淵守りの短剣', mage:'淵守りの杖', archer:'淵守りの弓', wanderer:'淵守りの刃'},
});

export function roadChestById(id){ return ROAD2_CHESTS.find(c => c.id === id) || null; }

/* 宝箱の中身(固定)。supply → {kind:'supply'}。armoury/special → 装備の決まり(id は宝箱と職業で一つ) */
export function roadChestReward(chestId, classKey){
  const c = roadChestById(chestId);
  if(!c) return null;
  if(c.kind === 'supply') return {kind:'supply', potion:2, mpPotion:1};
  const plan = ARMOURY_PLAN[chestId];
  if(!plan) return null;
  const cls = NAMES.weapon[classKey] ? classKey : 'warrior';
  const order = Object.keys(ARMOURY_PLAN).filter(k => ARMOURY_PLAN[k].slot === plan.slot && !ARMOURY_PLAN[k].special);
  const tier = Math.max(0, order.indexOf(chestId));
  const name = plan.special ? NAMES.special[cls] : NAMES[plan.slot][cls][Math.min(1, tier)];
  const {atkBonus, hpBonus} = equipmentStatBonus(plan.slot, plan.level, !!plan.special, () => 0.5);   // 珍しい品の上乗せも決まった値
  return {kind:'equipment', item:{id:`road2_${chestId}_${cls}`, slot:plan.slot, itemLevel:plan.level, name, atkBonus, hpBonus,
    rarity: plan.special ? 'rare' : 'normal', identified:true, roadReward:chestId}};
}
