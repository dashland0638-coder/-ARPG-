/* UI アイコンの対応表(UI-002-C1 WI-C1-3)。

   「意味名 → いま画面で使っている emoji / 記号」の一覧だけを持つ。
   新しいアイコンは 1 つも無く、画面の表示もまだこの表を参照して
   いない(置き換えはしない。AP-C1-07)。ゲーム専用アイコンの絵柄・
   形式は UI-002-V / UI-002-E で Human が決め、そこで差し替える。

   glyph が null のものは、いまはアイコンが無く文字ラベルだけで
   表示している意味(例: HP バーの「HP」)。source は現在の出所。

   職業ごと・スキルごとに変わるアイコン(CLASSES の icon、必殺技・
   スキルの icon 等)は定義オブジェクト側にあり、ここには入れない。

   state・THREE・DOM に依存しない(ARCHITECTURE.md の core/ の作法)。 */
export const UI_ICONS = Object.freeze({
  hp:        Object.freeze({ glyph: null, source: 'HUD のバーラベル「HP」(index.html .bar-label)' }),
  mp:        Object.freeze({ glyph: null, source: 'HUD のバーラベル「MP」(index.html #mp-label)' }),
  stamina:   Object.freeze({ glyph: null, source: 'HUD のバーラベル「スタミナ」(index.html .bar-label)' }),
  attack:    Object.freeze({ glyph: null, source: 'アクションボタン「攻撃」(index.html #btn-attack)' }),
  skill:     Object.freeze({ glyph: '💢', source: 'スキル1ボタンの初期値(index.html #btn-charge-icon)' }),
  ultimate:  Object.freeze({ glyph: '💥', source: '必殺ボタンの初期値(index.html #btn-ult-icon)' }),
  equipment: Object.freeze({ glyph: '⚔️', source: '鑑定所「装備品」の武器スロット見出し(12-progression-ui.js)' }),
  item:      Object.freeze({ glyph: '🧪', source: 'HUD の薬草チップ(index.html #loot-potion-btn)' }),
  potion:    Object.freeze({ glyph: '🧪', source: 'LOOT_TABLE potion(08-loot-equipment.js)' }),
  mppotion:  Object.freeze({ glyph: '🔷', source: 'LOOT_TABLE mppotion(08-loot-equipment.js)' }),
  gold:      Object.freeze({ glyph: '🪙', source: 'LOOT_TABLE gold / メニューの所持金(index.html)' }),
  tavern:    Object.freeze({ glyph: null, source: 'ミニマップ下の地名ラベル(文字のみ)' }),
  dialogue:  Object.freeze({ glyph: '▼', source: '会話の「続ける」表示(main.css .dialogue-next::after)' }),
  save:      Object.freeze({ glyph: '💾', source: 'メニュー「セーブ」(index.html #menu-save)' }),
  sortie:    Object.freeze({ glyph: null, source: '出撃画面の見出し(文字のみ)' }),
  menu:      Object.freeze({ glyph: '☰', source: 'HUD のメニューチップ(index.html #loot-menu-btn)' }),
  interact:  Object.freeze({ glyph: '✋', source: 'インタラクト表示(main.css #interact-btn::before)' }),
  execute:   Object.freeze({ glyph: '✦', source: '処刑プロンプト(main.css #execute-prompt::before)' }),
  locked:    Object.freeze({ glyph: '🔒', source: '進めない分岐のインタラクト表示(main.css #interact-btn.branch-locked::before)' }),
  cameraLeft:  Object.freeze({ glyph: '⟲', source: 'カメラ回転ボタン(index.html #btn-cam-left)' }),
  cameraRight: Object.freeze({ glyph: '⟳', source: 'カメラ回転ボタン(index.html #btn-cam-right)' }),
});

/** 意味名の一覧 */
export const UI_ICON_NAMES = Object.freeze(Object.keys(UI_ICONS));

/** 意味名 → 現在のグリフ(アイコンが無い意味・未知の名前は null) */
export function uiIconGlyph(name){
  const e = Object.prototype.hasOwnProperty.call(UI_ICONS, name) ? UI_ICONS[name] : null;
  return e ? e.glyph : null;
}

/* ---- Production glyph(UI-002-E Production Integration WI-EPI-1) ----

   Human 承認済みの Swordsman glyph 4 つだけを、semantic ID → path データで
   持つ(HDE-EPI-09)。上の UI_ICONS(emoji 表)は変えない(HDE-EPI-13)。

   - path は承認済み Swordsman SVG catalog
     (.ai/reports/UI-002-E-swordsman-svg-catalog/glyphs.js)の d 文字列を
     そのまま転記したもの(catalog を import しない。HDE-EPI-03 / 07)。
     転記元の記録は .ai/reports/UI-002-E-production-integration-impl.md。
   - viewBox 0 0 24 24、塗りだけ。色・stroke・mask・transform・文字は持たない。
     描画側が fill="currentColor" で塗る。
   - 必殺技(渾身の斬撃)は正式 semantic ID が未決定のため登録しない(HDE-EPI-10)。 */
export const UI_GLYPH_VIEWBOX = '0 0 24 24';

export const UI_GLYPHS = Object.freeze({
  'weapon.greatsword': Object.freeze({
    source: 'catalog glyphs.js key "badge"',
    paths: Object.freeze([
      'M7.8,13.4 L17.6,3.6 L21.5,2.5 L20.4,6.4 L10.6,16.2 Z',
      'M5.9,10.9 L13.1,18.1 L11.2,20 L4,12.8 Z',
      'M6.6,15.8 L8.2,17.4 L5,20.6 L3.4,19 Z',
      'M1.3,20.8 A1.9,1.9 0 1 0 5.1,20.8 A1.9,1.9 0 1 0 1.3,20.8Z',
    ]),
  }),
  'attack.greatsword': Object.freeze({
    source: 'catalog glyphs.js key "atk"',
    paths: Object.freeze([
      'M11.34,8.95 L19.54,15.35 L20.98,19.02 L17.07,18.5 L8.88,12.1 Z',
      'M11.36,5.67 L12.94,6.9 L7.28,14.15 L5.7,12.92 Z',
      'M6,6.04 L9.15,8.5 L7.92,10.08 L4.77,7.62 Z',
      'M2.69,6.21 A1.9,1.9 0 1 0 6.49,6.21 A1.9,1.9 0 1 0 2.69,6.21Z',
      'M14,0.8 C19.2,1.6 22.6,4.8 23.6,9.4 C21,7.2 17.8,4.6 13.4,3.8 Z',
    ]),
  }),
  'skill.warrior.retreat': Object.freeze({
    source: 'catalog glyphs.js key "retreat"',
    paths: Object.freeze([
      'M22.49,17.72 L22.86,17.49 L23.11,17.18 L23.25,16.76 L23.26,16.27 L23.14,15.79 L22.91,15.33 L22.52,14.84 L22.12,14.49 L21.75,14.27 L21.31,14.09 L20.83,13.97 L20.31,13.91 L19.76,13.9 L19.18,13.94 L17.58,14.21 L17.9,14.76 L18.14,15.36 L18.27,15.97 L18.31,16.57 L18.25,17.16 L18.08,17.72 L17.82,18.23 L17.48,18.68 L17.01,19.09 L16.48,19.38 L10.58,21.77 L10.79,22.01 L10.99,22.16 L11.18,22.23 L11.37,22.21ZM11.73,5.2 L7.59,6.87 L9.86,12.51 L11.66,12.18 L12.58,12.08 L13.62,12.07 L14.55,12.19Z',
      'M4.6,22.2 L15.69,17.72 C16.76,17.29 16.66,15.84 15.81,14.94 C14.86,13.84 13.33,13.71 11.49,14.08 L8.72,14.58 L4.93,5.2 L-1.69,7.87 L3.36,20.97 C3.7,21.82 4.17,22.37 4.6,22.2 Z',
      'M4.4,21.8 L0.4,17.6 L1.8,16.4 L5.6,20.6 Z',
    ]),
  }),
  'skill.warrior.crushSlash': Object.freeze({
    source: 'catalog glyphs.js key "crush"',
    paths: Object.freeze([
      'M2.6,18 L15.2,16.8 L15.8,22.8 L3,22.8 Z',
      'M8.26,9.26 L20,12.6 L20.92,5.61 L18.54,3.58 L15,3.73 L12.67,2.32 L10.1,3.54 Z',
      'M0.2,16.4 Q12,11.6 23.8,10.6 Q12,16.8 0.2,16.4 Z',
    ]),
  }),
});

/** 登録済みの semantic ID の一覧 */
export const UI_GLYPH_IDS = Object.freeze(Object.keys(UI_GLYPHS));

/** semantic ID → glyph(未登録・null・継承プロパティ名は null) */
export function uiGlyph(id){
  return (typeof id === 'string' && Object.prototype.hasOwnProperty.call(UI_GLYPHS, id)) ? UI_GLYPHS[id] : null;
}

/* 既存の runtime の key から、Swordsman の承認済み glyph の semantic ID を決める。

   入力はゲーム側の既存の値だけ(新しい game logic ID は作らない):
     classKey    state.classDef.key
     charKey     state.classDef.charKey(影の旅人は 'wanderer'。剣士本人は持たない)
     job         state.job(上位職に転身済みなら値がある)
     weaponKey   weaponDefFor(...).key(いま持っている武器)
     skillChoice いま Skill1 に装備している技の key(CHARGE_VARIANTS_BY_CLASS)
     skill2Key   activeSkill2Def(...).key(いま Skill2 に装備している技の key)

   剣士本人(classKey 'warrior' かつ charKey・job が無い)のときだけ ID を返す。
   classKey だけを根拠にしない ―― 影の旅人(HDE-EPI-11)と上位職(HDE-EPI-04)は
   key が 'warrior' のままでも全部 null。slot ではなく装備中の技の key で決めるので、
   Skill1 / Skill2 を入れ替えても同じ技には同じ glyph が付く。
   解決できないものは null(描画側は既存表示へ fallback。HDE-EPI-12)。 */
export function resolveSwordsmanGlyphIds(input){
  const o = input || {};
  const none = { weapon: null, attack: null, skill1: null, skill2: null };
  if(o.classKey !== 'warrior' || o.charKey || o.job) return none;
  const skillGlyph = (key) => key === 'retreat' ? 'skill.warrior.retreat'
    : key === 'crushSlash' ? 'skill.warrior.crushSlash' : null;
  const greatsword = o.weaponKey === 'greatsword';
  return {
    weapon: greatsword ? 'weapon.greatsword' : null,
    attack: greatsword ? 'attack.greatsword' : null,
    skill1: skillGlyph(o.skillChoice),
    skill2: skillGlyph(o.skill2Key),
  };
}
