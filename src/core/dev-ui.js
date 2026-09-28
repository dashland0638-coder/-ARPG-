/* 開発用 UI の有効/無効(UI-002-B、HD-3 / D-1)。

   ページ URL のクエリに `dev=1` がある時だけ開発用 UI(テストモード入口・
   デバッグモード)を有効にする。値は `1` の完全一致のみ ―― `dev=true`・
   `dev=01`・値なしは無効。同名キーが複数ある時は最初の値で判定する
   (URLSearchParams.get と同じ)。

   判定結果はどこにも保存しない(D-1)。通常 URL で開き直せば必ず本番扱い。
   目的は秘匿ではなく、通常プレイと開発用 UI の分離。

   state・THREE・DOM に依存しない(ARCHITECTURE.md の core/ の作法)。 */
export function devUiEnabled(search){
  return new URLSearchParams(search || '').get('dev') === '1';
}

/* Combat HUD Visual Prototype の見本オーバーレイ(UI-002-C2、AP-C2-08)。
   `?dev=1` かつ `uiproto=1` の時だけ有効。判定は devUiEnabled と同じ
   規則(値の完全一致・最初の値・保存しない)。通常 URL では常に無効。 */
export function uiProtoEnabled(search){
  return devUiEnabled(search) && new URLSearchParams(search || '').get('uiproto') === '1';
}
