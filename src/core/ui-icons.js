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
