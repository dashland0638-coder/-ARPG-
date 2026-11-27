# CHARACTER-VIS-002 T-2R-2 Review（顔の確認のプレビュー）

- Verdict: **PASS**（must-fix なし。should-fix 3 件は次の Round か T-2R-3 の冒頭で直せばよい）
- Reviewed SHA: `733449b`（diff `5f50ce5..733449b`）
- Reviewer: 独立 Reviewer（Agent Protocol 2.0）
- 範囲: `src/legacy/parts/18-face-preview.js`（新規）、`index.html`、`src/styles/main.css`、`tests/face-preview.spec.js`、`.ai/tasks/CHARACTER-VIS-002.md`、撮影シート `t2r2-face-preview-8jobs.jpg`

## 要件との対応
| 要件 | 判定 | 根拠 |
| --- | --- | --- |
| 既存の Motion Preview の調査 | △ | 実装の判断（Motion Preview は文字の表示とゲームのカメラを使う。単独の全画面に分けた）自体は妥当。ただし調査の結果と、計画（「Motion Preview の顔カメラ」）から変えた理由が記録に無い → S-3 |
| dev 専用の顔カメラ・表示 | OK | `openFacePreview` は `DEV_UI` で止める（18-face-preview.js:148）。入口の bind も `DEV_UI` で止める。設定タブの行は初期値が `display:none`、タイトルのボタンは `hidden` の `.testmode-link-row` の中にあり、その行は `DEV_UI` の時だけ出る（01-character-creation.js:466-467）|
| 正面 / 45° / 横 / 下から / 後頭部 | OK | 方位は +Z（姿の正面）から測る。注視点は頭のメッシュの world 座標で、ピボットの原点＝頭の中心。E2E で 5 方向とも方位・仰角が ±1° で合う。撮影シートでも正面に顔が来ている。戦騎士の頭のピボットの縮小は今は `KNIGHT_HEAD_SCALE = 1.0`（06-player-enemy.js:2559）。0.86 に戻しても注視点は world 座標なので向きは崩れず、距離が 14% 遠く見えるだけ |
| 4 基礎職 + 4 上位職（影の旅人を除く）| OK | `facePreviewJobs()`。E2E で 8 個あり、影の旅人を含まないことを確かめている |
| 顔 / 全身 | OK | 頭の高さが縦の 40%（縦の fov 30°）。全身は stature×1.15 |
| 頭赤・髪緑の診断 | OK（S-2 あり）| 頭＝`headGroupParts[0]`、髪の殻＝`[1]` |
| ゲームの操作・カメラ・キャラの表示へ影響しない | OK | 下の「共有変数の差し替えの安全性」とプローブの結果 |
| iPhone の縦画面 | OK | 390×844 で表示の領域が縦の半分以上、ボタンはすべて画面の内側（E2E）。safe-area の内側、z-index は縦向きの案内（`--ui-z-rotate: 60`）より上 |
| 本番の UI に出さない | OK | `dev:false` の E2E で入口が出ない |
| 影の旅人を変えない | OK | `character-visual-budget` の影の旅人のシグネチャ・`wanderer-renewal` が PASS |
| T-2R-3 に着手しない | OK | 顔の形の変更は無い（diff の src は新規ファイル 1 つ・入口・CSS だけ）|

## 共有変数の差し替えの安全性（重点の確認）
- `buildPlayer` / `applyJobPromotionVisual` / `clearJobPromotionVisual` / `applyPlayerPalette` / `addOutline` / `addXrayShell` がグローバルへ書くものを洗った（06-player-enemy.js 96〜2810 行、05-rendering-rig.js 2160〜2350 行）:
  - `playerMixerParts`・`player`・`state.job`・`state.classDef`: 差し替えて、`finally` で戻している（18-face-preview.js:42-59）。上の 4 つのほかに、`state.*` への代入は 1 つも無い
  - `_jobDecorLastFacing = null`（clearJobPromotionVisual、06:2390）: 上位職を組み立てるたびにゲーム側の値が null になる。ゲームの上位職の装飾の旋回の検出が 1 フレームだけ dFacing=0 になるだけ（再構築直後と同じ扱い）で、害は無い → N-1
  - `_outlineRim/_outlineDark` の uWidth（addOutline）: `dotOn()` で決まる同じ値を書くだけ（冪等）
  - `xrayMat()` / `outlineMats()` の共有 Material: `disposePlayerPartTree` は `isOutline/isXray` のシェルを飛ばすので、破棄しない
  - leather / metal のテクスチャ: `makeSurface` の key でキャッシュされ、ゲームのプレイヤーと共有。`material.dispose()` はテクスチャを破棄しないので影響しない
  - ジオメトリのキャッシュ: プレイヤーの組み立てでモジュール単位に共有しているものは無い（`_relaxedStanceCache` は姿勢の数値だけ）
  - 確認用の姿の `roleMats` は `disposePlayerPartTree` の keep に入るので破棄されない。ただし参照が無くなって GC され、閉じる時にコンテキストごと解放される（下のプローブで GPU の数は頭打ち）
- `scene.children` の差分: 組み立ては同期処理なので、その間にゲームがシーンへ足すことは無い。`buildPlayer` 末尾の `scene.add(group)`、上位職の auraRing（バーサーカー）・魔法石 4 個と魔法陣（大魔導）が移される。E2E のゲーム内の場合（大魔導を組み立てる）でシーンの子の数が不変であることを確かめている
- 開いている間のゲームのループ: `updateJobDecor` などはゲームの `playerMixerParts` だけを読むので、確認用の姿には触れない
- 例外: `finally` でグローバルは戻る。ただしシーンの差分の移動が `finally` の外にある → S-1

## Reviewer のプローブ（worktree、ポート 5292、844×390 タッチ）
テストモードの剣士 → ゲームのプレイヤーの全 geometry / material / map / bumpMap（101 個）に dispose の監視を付ける → 「開く → 8 職 ×2 周、各職で 診断 on / 帽子なし / off → 閉じる」を 3 回繰り返す。
- ゲームのプレイヤーの資源の dispose: **0 件**（geo 0 / mat 0 / tex 0）
- ゲームのシーンの子: 20 → 20。ゲームのレンダラー: `gl.getError()=0`、コンテキストは失われていない、draw calls 307、programs 12 → 12
- プレビューのレンダラー（1 回の開いている間）: geometries 37 → 38（増えない）、textures 4 → 28（8 職の配色のキャッシュ済みテクスチャの upload。上限があり、閉じると `forceContextLoss` で解放）、programs 6 で一定
- ページのエラー: 0 件。閉じた後のスクリーンショットでゲームの剣士は正常に描画されている

## must-fix
なし

## should-fix
- **S-1 組み立て中に例外が出るとゲームのシーンに部品が残る**（18-face-preview.js:61）。`scene.children` の差分の移動が `try/finally` の後にあるため、`buildPlayer` / `applyJobPromotionVisual` の途中で throw すると、それまでに `scene.add` された部品（上位職の魔法石・魔法陣・オーラ等）がゲームのシーンに残る。さらに `setFacePreviewEntry` は先に前の姿を破棄している（`fp.fig = null`）ので、プレビューは空のまま、エラーの表示も出ない。直し方: 移動を `finally` の中へ入れる（`previewScene` へ移すか、例外の時は remove して破棄する）。合わせて `setFacePreviewEntry` の呼び出しを try/catch で囲み、ラベルにエラーを出す。今の職では起きないが、T-2R-3 以降で組み立てを変えている最中に使う道具なので、壊れた時の安全が要る
- **S-2 「髪緑」が髪の殻だけで、前髪・横髪・後ろ髪の房が緑にならない**（18-face-preview.js:83-91）。緑は `headGroupParts[1]`（殻）だけ。T-2R-3 では `napeSideIn`（横・後ろの髪）と髪の輪・下限を見直すので、房と頭の貫通も同じ診断で見えた方がよい。直し方: `bangMeshes` / `sideHairMeshes` / `backHairMeshes` も緑にする（殻と房の色を分けてもよい）。少なくとも記録とラベルに「髪の殻だけ」と書く。E2E は `hg[1]` しか見ていない。また「＋帽子なし」はピボットの子のうち頭・髪・目以外をすべて隠すので、上位職の `addHeadPart` で頭のピボットに載せた髪・髭も隠れる。戦騎士の装飾は waist に付くので隠れない。これも記録に一言書く
- **S-3 Motion Preview の調査の結果と、計画を変えた理由が記録に無い**（.ai/tasks/CHARACTER-VIS-002.md:88 / 693〜）。Human の要件 1 は「既存の Motion Preview を調査」。計画の行は「Motion Preview の『顔』カメラ」だったのが「全画面のプレビュー」に変わったのに、理由が書かれていない。調査で分かったこと（`src/core/motion-preview.js` + 14-hud-boot.js の `updateMotionPanel` は文字の表示で、ゲームのカメラと操作中の姿を使う。顔カメラを足すとゲームのカメラに触れることになり、要件「ゲームのカメラに影響しない」と衝突する）を Implementation Result に 2〜3 行で書く

## note
- N-1 `_jobDecorLastFacing` がプレビューで上位職を組み立てるたびに null になる（06-player-enemy.js:2390 経由）。害は無いが、コメント（18-face-preview.js の冒頭）の「書き換える共有変数」の一覧に加えておくと、後で読む人が迷わない
- N-2 z-index の `10000` が直接書かれている（main.css:2039）。tokens.css には `--ui-z-*`（最大 `--ui-z-confirm: 120`）がある。dev 専用なので実害は無いが、`--ui-z-devtool` などのトークンにするとそろう
- N-3 開いている間もゲームの描画ループは止まらない。iPhone では WebGL のコンテキスト 2 つ（DPR 2 まで）を毎フレーム描く。dev 専用で、開くのは主にタイトル・メニューの上なので許容できる。重いと感じたら、開いている間だけゲームの render を止める案がある。iOS のコンテキストの上限は、閉じる時の `dispose` + `forceContextLoss` で開き直しても積み上がらない
- N-4 キーボード・パッドの入力は遮らない（メニューの上で開いた後に Esc でメニューが閉じると、プレビューの下でゲームが再開しうる）。iPhone のタッチの使い方では起きない
- N-5 `buildPlayer` はゲームの `state.equipped.weapon.specialId` / `state.usingAltWeapon` を読むので、確認用の姿の武器はゲームの装備の影響を受ける（`SPECIAL_WEAPON_AURA` の色だけ。武器は既定で隠れている）
- N-6 E2E の質: ゲーム内のケースで `player` と `playerMixerParts` が同じものであること、`state.classDef.key`、シーンの子の数を確かめているので、元に戻す処理やシーンの移動が壊れれば落ちる。入口の DEV_UI の判定も、設定タブの行で落ちる。X 線シェルを隠していること、閉じた後もゲームのプレイヤーの資源が破棄されていないこと（今回プローブで確認）は E2E に無い。後者は dispose の監視を足せば安く守れる
- N-7 記録: unit の数は今回の実行で `tests 2342 / pass 2338 / skipped 4 / fail 0`。記録の「PASS（2341）」は前の記録と同じ書き方なので問題は無い（数え方の違い）

## T-2R-1 の Human 承認の記録の正確さ
- 進捗表（.ai/tasks/CHARACTER-VIS-002.md:88）、追加調査の節（:690-691）、Status History（:749）のいずれも「CI 成功 `a634fbf`」「Human の iPhone 実機確認 PASS（Safari・ChatGPT のアプリ内ブラウザ・Claude のアプリ内ブラウザ）」「BGM の重複の改善を確認」で、依頼の内容と一致する。Reviewer PASS の SHA（`f9fc4e5` / `a634fbf`）も前の記録と合う。**正確**

## 撮影シート
`t2r2-face-preview-8jobs.jpg`: 8 職 × 9 列。正面・45°・横・下から・後頭部の向きが列ごとにそろっている。診断の列で、後頭部が髪の殻を突き抜けている部分（Human Review C）が赤くはっきり見える。帽子なしの列では帽子が消えている。全身の列も 8 職とも正常

## 実行したテスト（isolated worktree `/tmp/rev-t2r2` @ 733449b、Vite :5291 / :5292、削除済み）
| テスト | 結果 |
| --- | --- |
| `tests/face-preview.spec.js` | 3 passed |
| `character-visual-budget`・`battle-knight-visual`・`character-clothing`・`wanderer-renewal`・`hud-zones-layout` | 31 passed（4.4m）|
| `npm run test:unit` | tests 2342 / pass 2338 / skipped 4 / fail 0 |
| Reviewer のプローブ（3 回開く × 8 職 ×2 周 × 診断の切り替え → 閉じる → ゲームの状態を確認）| PASS（上の「Reviewer のプローブ」）|

`/home/user/-ARPG-` は変更・commit・push していない。

---

# Round 2

- Verdict: **PASS**
- Reviewed SHA: `e6dbc41`（diff `733449b..e6dbc41`）

## 指摘の反映の確認
| 指摘 | 判定 | 根拠 |
| --- | --- | --- |
| S-1 例外でゲームのシーンに部品が残る | 解消 | シーンの部品を移す処理が `finally` の中に入った（18-face-preview.js:65）。`setFacePreviewEntry` は try/catch でラベルにエラーを出す（:142-150）。**注入の検証**: `applyJobPromotionVisual` を組み立ての後で throw するように差し替え、大魔導（魔法石・魔法陣をシーンへ足す）を選んだ。結果: ゲームのシーンの子の数は不変。`player`・`playerMixerParts`・`state.job`・`state.classDef` は同じもの（identity）に戻った。ラベルは「魔導士: 組み立てに失敗 (inj)」、`fp.fig = null`、プレビューのシーンには固定の 4 つだけが残る。次に別の職を選ぶと正常に組み立て直せた。閉じた後もゲームのシーンは不変で、pageerror は無い |
| S-2 髪の房 | 解消 | 前髪・横髪・後ろ髪 = 濃い緑 `0a7a28`、殻 = `20d040`。通常に戻すと元の Material に戻る（E2E の `toEqual(normal)` に房の色も入った）。帽子なしの範囲はコメント（:7-9）と記録に書かれた |
| S-3 Motion Preview の調査 | 解消 | Implementation Result に、調査で分かったこと（文字の表示・ゲームのカメラ・デバッグモードでのみ出る）と、計画から変えた理由（ゲームのカメラ・操作中の主人公を変えないため）が書かれた。内容はコードと一致する |
| N-2 z-index | 解消 | `--ui-z-face-preview: 10000`（tokens.css）|
| N-4 キー入力 | 解消 | 下の確認 |
| N-6 E2E | 解消 | 房の色と、X 線シェルが 0 枚見えていることを確かめるようになった |

## keydown のリスナーの確認（依頼の重点）
- 登録は `document.addEventListener('keydown', fp.onKey, true)`（:247）、解除は同じ参照・同じ capture フラグの `removeEventListener`（:283）で、`closeFacePreview` を通る経路はすべて解除する。二重に開く経路は `if(!DEV_UI || facePreview) return` で塞がれていて、リスナーは最大 1 つ
- ゲームのキー処理は `window` の bubble（09-save-load.js:319 / 324 / 362）。`document` の capture で `stopPropagation` すれば、ゲームへは届かない。`preventDefault` は Esc の時だけなので、プレビューのボタンを Enter / Space で押す標準の動作は壊れない
- keyup は止めないので、開く前から押していたキーも `keys[...]` が false に戻る（押しっぱなしで固まらない）
- **実機の確認**（1280×800、テストモードの剣士）:
  - ゲームの中で Esc を押すとメニューが開く → プレビューを開く → KeyW を押してもゲームの `keys.KeyW` は false のまま → Esc でプレビューだけが閉じ、メニューは開いたまま
  - 開く / 閉じるを 3 回繰り返した後で Esc を押すと、ゲームがメニューを閉じる。KeyW もゲームの `keys.KeyW` = true になる。閉じた後に漏れは無く、ゲームの入力は正常
- note R2-N1: 開いている間の Esc の keyup はゲームへ届くが、ゲームは Esc を keydown でしか扱わないので無害

## note（Round 2）
- R2-N2 例外の時、`setFacePreviewEntry` の catch はプレビューのシーンから部品を remove するだけで、`dispose` しない（18-face-preview.js:146）。dev 専用で、閉じれば `forceContextLoss` でコンテキストごと解放されるので実害は小さい。気になるなら `disposePlayerPartTree(o, null)` を呼ぶ

## 実行したテスト（isolated worktree `/tmp/rev-t2r2b` @ e6dbc41、Vite :5293、削除済み）
| テスト | 結果 |
| --- | --- |
| `tests/face-preview.spec.js` | 3 passed |
| `npm run test:unit` | tests 2342 / pass 2338 / fail 0 |
| Reviewer のプローブ（キー入力・漏れ）| PASS（上の数値）|
| Reviewer のプローブ（組み立ての例外の注入）| PASS（上の数値）|

`/home/user/-ARPG-` は変更・commit・push していない。
