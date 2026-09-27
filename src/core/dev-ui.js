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
