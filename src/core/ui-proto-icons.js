/* Combat HUD Visual Prototype のアイコン(UI-002-C2 WI-C2-3)。

   ?dev=1&uiproto=1 の見本オーバーレイ(15-ui-proto.js)だけが使う。
   本番 HUD のアイコンは置き換えない ―― 正式なアイコンシステムと
   その形式は UI-002-E で決める(H-5: インライン SVG は C2 Prototype
   限定の方式)。

   規則(V-3 / V-5):
     - 24×24 のグリッド。Emoji / Unicode 記号は使わない
     - 塗りのシルエット(class="f")+厚い輪郭(CSS が stroke を付ける)
     - 内部の線は 1〜2 本まで(class="s" = 線、class="a" = 小さな差し色)
     - 同じ意味には同じ形: 大剣は Attack と Weapon Badge で共通

   色はここでは持たない(currentColor と CSS の token)。
   state・THREE・DOM に依存しない(ARCHITECTURE.md の core/ の作法)。 */

const SVG_OPEN = '<svg class="uip-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">';
const SVG_CLOSE = '</svg>';
const svg = body => SVG_OPEN + body + SVG_CLOSE;

// 大剣(剣士の武器。docs/CHARACTERS.md)。刃・鍔・握り・柄頭
const GREATSWORD =
  '<path class="f" d="M19 2.5L21.5 5L11.5 15L9 12.5Z"/>' +
  '<path class="f" d="M5.5 11.5L7 10L14 17L12.5 18.5Z"/>' +
  '<path class="f" d="M8.2 14.4L9.6 15.8L5.6 19.8L4.2 18.4Z"/>' +
  '<circle class="f" cx="3.8" cy="20.2" r="1.6"/>';

export const UI_PROTO_ICONS = Object.freeze({
  // 通常攻撃: 大剣+斬撃の弧
  attack: svg('<path class="s" d="M3.5 9.5Q5 3.5 12.5 2.5"/>' + GREATSWORD),
  // 武器バッジ(剣士): 大剣のシルエットだけ
  weaponGreatsword: svg(GREATSWORD),
  // 必殺: 魔導紋章(外周の輪+八芒星+中心の石)
  ultimate: svg(
    '<circle class="s" cx="12" cy="12" r="10"/>' +
    '<polygon class="f" points="12,4.8 13.2,9.1 17.1,6.9 14.9,10.8 19.2,12 14.9,13.2 17.1,17.1 13.2,14.9 12,19.2 10.8,14.9 6.9,17.1 9.1,13.2 4.8,12 9.1,10.8 6.9,6.9 10.8,9.1"/>' +
    '<circle class="a" cx="12" cy="12" r="1.8"/>'),
  // 回復: 薬瓶(栓・首・丸い胴)+十字
  heal: svg(
    '<rect class="f" x="9.5" y="2.5" width="5" height="2.6" rx="0.8"/>' +
    '<rect class="f" x="10.2" y="5" width="3.6" height="4.5"/>' +
    '<circle class="f" cx="12" cy="15.2" r="6.3"/>' +
    '<path class="a" d="M11 12.2h2v2h2v2h-2v2h-2v-2h-2v-2h2Z"/>'),
  // Skill 1(仮): 振り下ろす一撃(下向きの矢印+地面)
  skill1: svg(
    '<path class="f" d="M9 2.5h6v8h4l-7 8l-7-8h4Z"/>' +
    '<rect class="f" x="3.5" y="19.8" width="17" height="2.2" rx="1"/>'),
  // Skill 2(仮): 崩し斬り(円を断つ斜めの一閃)
  skill2: svg(
    '<circle class="f" cx="12" cy="12" r="8"/>' +
    '<path class="cut" d="M4.5 19.5L19.5 4.5"/>'),
  // インタラクト通知: 吹き出し(話しかける)
  interact: svg(
    '<path class="f" d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>' +
    '<circle class="a" cx="8" cy="10.5" r="1.3"/><circle class="a" cx="12" cy="10.5" r="1.3"/><circle class="a" cx="16" cy="10.5" r="1.3"/>'),
  // HP: ハート
  hp: svg('<path class="f" d="M12 21s-8.5-5.3-8.5-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.8C20.5 15.7 12 21 12 21Z"/>'),
  // 肖像(人物の頭と肩)
  portrait: svg(
    '<circle class="f" cx="12" cy="8.2" r="4.4"/>' +
    '<path class="f" d="M3.5 21.5a8.5 7.5 0 0 1 17 0Z"/>'),
  // 見本オーバーレイの操作(閉じる / 見本板の開閉)
  close: svg('<path class="s" d="M6 6L18 18M18 6L6 18"/>'),
  board: svg(
    '<rect class="f" x="3.5" y="3.5" width="7" height="7" rx="1"/><rect class="f" x="13.5" y="3.5" width="7" height="7" rx="1"/>' +
    '<rect class="f" x="3.5" y="13.5" width="7" height="7" rx="1"/><rect class="f" x="13.5" y="13.5" width="7" height="7" rx="1"/>'),
});

/** アイコン名の一覧 */
export const UI_PROTO_ICON_NAMES = Object.freeze(Object.keys(UI_PROTO_ICONS));

/** 武器種キー(WEAPON_TYPES の key)→ アイコン名。C2 では剣士の大剣だけ(全職業分は UI-002-E) */
export function uiProtoWeaponIcon(weaponKey){
  return weaponKey === 'greatsword' ? 'weaponGreatsword' : null;
}

/** 名前 → SVG 文字列(未知の名前は空文字) */
export function uiProtoIcon(name){
  return Object.prototype.hasOwnProperty.call(UI_PROTO_ICONS, name) ? UI_PROTO_ICONS[name] : '';
}
