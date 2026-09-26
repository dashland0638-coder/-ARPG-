// プレイヤー専用の配色表と質感表(CHARACTER-VIS-001 T-5)。
//
// lowpoly-primitives.js と同じ位置づけの「真のESモジュール」- 共有可変変数にも
// three にも依存しない純粋なデータと純粋関数だけ。legacy/parts/*.js からは
// concat-plugin.js の HEADER 経由で import され、06-player-enemy.js の
// buildPlayer() / applyPlayerPalette() が Material へ値を書き込む。
//
// なぜ CLASSES(01-character-creation.js)の color / trim を使わないか:
//   CLASSES の color / trim は支援AI(08)・街道の NPC(14)・攻撃 VFX(11)・
//   足元リング(13)も読む。プレイヤーの服の色だけを変えるため、プレイヤーは
//   この表から色を取り、CLASSES の値は変えない(HDR-T5-2)。
//
// 役割(role)は職によらず固定(P-D3):
//   main   主な上着・素体(clothMat / clothMatFlat)
//   sub    メインと分けたい層 = パンツ・袖(subMat / subMatFlat)
//   accent 布のアクセント = ゲイター・マフラー・盗賊のパーカー・矢羽(clothAcc)
//   layer  白系の中のレイヤー = シャツ・タートルネック(layerMat)
//   hat    帽子(キャップ・キャスケット・盗賊の帽子)
//   trim   膝球・脛当て・籠手・肩当て・ベルト・武器装飾(trimMat 系)
//   boot   ブーツ
// その職で使わない role にも値を入れておく(applyPlayerPalette は全 role を
// 毎回上書きするので、前の職の色が残らない)。
//
// 色の値は Human 承認済みの方向の候補値。最終値は V-1 で Human が決める。

export const PLAYER_ROLES = ['main', 'sub', 'accent', 'layer', 'hat', 'trim', 'boot'];

/* 質感(HDR-T5-9 の初期候補。現在値 → 候補は Planner report §9)。
   肌・髪・目・魔導士の結晶・魔法陣・魔法エフェクトはこの表の対象外 */
export const PLAYER_FINISH = {
  cloth:  { roughness: 0.85, metalness: 0 },    // main / sub(leather の map と bump は維持)
  accent: { roughness: 0.85, metalness: 0 },
  layer:  { roughness: 0.85, metalness: 0 },
  hat:    { roughness: 0.80, metalness: 0 },
  trim:   { roughness: 0.60, metalness: 0.25, emissiveIntensity: 0.04 },
  boot:   { roughness: 0.75, metalness: 0.08 },
  knife:  { roughness: 0.75, metalness: 0.45 }, // 盗賊の投げナイフ(P-D9)
  // 上位職の装飾(applyJobPromotionVisual)。現在値 → 候補は Planner report §9
  upperTrim:   { roughness: 0.55, metalness: 0.30, emissiveIntensity: 0.08 },
  knightSteel: { roughness: 0.50, metalness: 0.35 },
  knightGold:  { roughness: 0.50, metalness: 0.35, emissiveIntensity: 0.05 },
  knightDark:  { roughness: 0.70, metalness: 0.20 },
};

const DEFAULT_BOOT = 0x2a2018;

/* inherit: 上位職は基礎職の行を引き継ぎ、差分だけ書く。バーサーカーは
   盗賊を引き継がない独立配色(HDR-T5-8) */
export const PLAYER_PALETTE = {
  // 剣士: Deep Navy のパーカー / Blue Gray のパンツ・キャップ / Off White のゲイター / Warm Gold
  warrior: { main: 0x263a55, sub: 0x52657a, accent: 0xe6e4dd, layer: 0xe6e4dd, hat: 0x52657a, trim: 0xc49a4a, boot: DEFAULT_BOOT },
  // 魔法使い: Light Blue のコート / Pale Blue Gray のパンツ / Off White のタートルネック / 帽子 #6F8CA3(P-D6)
  mage:    { main: 0x8fb9d6, sub: 0xb7c7d2, accent: 0xe7e8e5, layer: 0xe7e8e5, hat: 0x6f8ca3, trim: 0xc7a45a, boot: DEFAULT_BOOT },
  // 弓師(P-D5): Forest Green / Blue Gray / Muted Gold / trim Off White。帽子は main
  archer:  { main: 0x315c50, sub: 0x617a82, accent: 0xb99652, layer: 0xe6e4dd, hat: 0x315c50, trim: 0xe6e4dd, boot: DEFAULT_BOOT },
  /* 盗賊: Deep Green のオーバーオール / Dusty Blue のパーカー / Warm Yellow の帽子 / Dark Navy。
     パーカーは Human V-1 第1段階で Muted Purple #5B4B78 → Dusty Blue #526A78(緑と黄色を
     冷色でつなぐ。紫を主役にしない) */
  rogue:   { main: 0x304d45, sub: 0x304d45, accent: 0x526a78, layer: 0xe6e4dd, hat: 0xd2a83e, trim: 0x263449, boot: 0x263449 },
  /* 影の旅人(HDR-T5-6): Charcoal のコート / Dark Purple のパンツ / Shadow Purple の
     マフラー・金具 / Off White のシャツ。全身黒にしない(P-D8: 暗く見えれば明るくして
     よい)。衣服の紫は影 VFX・足元リングの紫(CLASSES.wanderer.trim 0x8a5ad6)と
     別の値(unit テストで検査)。キャップは無い(hat は未使用) */
  wanderer: { main: 0x30323a, sub: 0x403454, accent: 0x654f86, layer: 0xd8d4d0, hat: 0x30323a, trim: 0x654f86, boot: DEFAULT_BOOT },

  /* 上位職。role 以外のキーは上位職の装飾だけが使う色
     (steel / gold = 戦騎士の強化肩・ハーネス、cape = 鷹の目の背中のフード) */
  // 戦騎士: 剣士を継承 + 白いレイヤー Cool Gray(P-D7)+ 肩 Muted Silver + 金具 Warm Gold
  battleKnight: { inherit: 'warrior', layer: 0x9aa5b1, steel: 0xc8cdd2, gold: 0xc49a4a },
  // 魔導士: Deep Blue のコート / Indigo Purple のパンツ・帽子 / Off White のドレス / Muted Gold
  archmage:     { inherit: 'mage', main: 0x334a72, sub: 0x514b86, hat: 0x514b86, layer: 0xe4e6e3 },
  // 鷹の目: 弓師を継承 + Deep Green のフード + Off White のベスト(P-D7)
  hawkEye:      { inherit: 'archer', layer: 0xe5e1d9, cape: 0x24463e },
  // バーサーカー: 盗賊を継承しない(HDR-T5-8)。Charcoal / Deep Red / Off White / Dark Brown
  berserker:    { main: 0x45484d, sub: 0x45484d, accent: 0x8a3438, layer: 0xe5e1d9, hat: 0x59483d, trim: 0x59483d, boot: 0x59483d },
};

/* どの行を使うか。影の旅人(charKey)は剣士の kit でも独立の行。転身中は上位職の行 */
export function paletteKeyFor(classKey, jobKey, charKey){
  if(charKey === 'wanderer') return 'wanderer';
  if(jobKey && PLAYER_PALETTE[jobKey]) return jobKey;
  return PLAYER_PALETTE[classKey] ? classKey : 'warrior';
}

/* inherit を展開した、全 role が埋まった行を返す(表に無いキーは null) */
export function resolvePalette(key){
  const row = PLAYER_PALETTE[key];
  if(!row) return null;
  const base = row.inherit ? resolvePalette(row.inherit) : {};
  const out = Object.assign({}, base, row);
  delete out.inherit;
  return out;
}
