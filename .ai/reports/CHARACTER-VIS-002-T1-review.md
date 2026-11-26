# CHARACTER-VIS-002 T-1 Review（独立 Reviewer）

## Review Target
- Repository: `/home/user/-ARPG-`、branch `claude/character-vis-002-t1`
- 初回の対象: HEAD `7734197`（range `4e76a69..7734197`。`4e76a69` = T-0、PR #147 の head）
- 追加の対象（Coordinator の依頼で拡張）: HEAD **`c4d66e3`**（range `4e76a69..c4d66e3`。追加分 `190e86a` コード / `c4d66e3` 文書・画像）
- 根拠: `.ai/decisions/DEC-036-character-vis-002-head-ratio.md`、DEC-035、`.ai/tasks/CHARACTER-VIS-002.md`（Implementation Result（T-1）と「T-1 追加: 顔の造形」）、`.ai/reports/CHARACTER-VIS-002-face-design.md`、`.ai/reports/CHARACTER-VIS-002-joint-analysis.md`、`docs/CHARACTERS.md`

## Independence
- 実装に関わっていない別コンテキストの Reviewer。ソース・テストは変更していない（この report だけを作成。commit なし）
- 実験は scratchpad の一時 git worktree（detached、`7734197` → `c4d66e3`）で行い、終了後に削除した
- 注意（環境）: レビュー中、メインの作業ツリーで別のセッションが未 commit の変更（`05` / `06` / budget spec、`tests/_tmp-*.spec.js`）と Playwright の実行を同時に行っていた。`playwright.config.js` は 5173 / 4173 を `reuseExistingServer` で共有するため、最初にメインのツリーで流した E2E は汚染された（バーサーカーの weapon-stow が `ERR_CONNECTION_REFUSED` / `phase` null で失敗）。**判定には使っていない**。E2E は worktree でポートを 5273 / 4273 に変えた一時 config（worktree 内のみ、削除済み）で取り直した

## Checks & Results
| 確認 | `7734197` | `c4d66e3` |
| --- | --- | --- |
| `npm run build` | PASS | PASS |
| `npm run test:unit` | PASS（2342 件中 2341 pass / 0 fail / 1 skip。worktree で再実行も同じ）| PASS（2341 pass / 0 fail / 1 skip）|
| E2E `character-visual-budget` `character-motion` `weapon-stow` `wanderer-renewal`（`--trace off`、隔離した worktree）| **35/35 PASS**（10.6 分）| **35/35 PASS**（10.5 分）。`CVB_PRINT=1` の実測値 = budget の8行と完全に一致（例: 剣士 total 307 / tris 15512、バーサーカー 311 / 15312。body・mats は T-0 のまま）|
| BUILD の整合（node で再計算）| 4系列とも `hipY − (thighLen+calfLen)` = 0、`stature − Σ` ≤ 0.0001（EPS 0.001 内）、`headGap > headR`、`stanceW+thigh ≤ hipR×1.10`（剣士 0.205 ≤ 0.220、魔法使い 0.180 ≤ 0.209、弓師 0.188 ≤ 0.209、盗賊 0.185 ≤ 0.204）| 変更なし |
| 頭身 | stature / (2·headR): 剣士 4.7494、魔法使い・弓師 4.7506、盗賊 4.7507（Σ基準でも 4.7496〜4.7507）。≥ 4.5 の制約内 | 変更なし |
| 作り方の主張 | dr: 剣士 0.0134 等。headGap も +dr（首の見える長さ headGap−headR は 0.036 / 0.040 / 0.040 / 0.038 で不変）。脚の短縮 / 2dr = 0.597〜0.603（6 割）、残りが胴（4 割）。太腿 / すねの比・hairR / headR の比は不変。肩・腰・手足の太さ・動きの係数は不変 → 主張どおり | ― |
| 影の旅人 | `BUILD.wanderer` 不変。`softHead = charKey !== 'wanderer'` で頭の断面・目の点の数・首を分岐。`HEAD_SECTION_RATIOS`（既定）不変（unit で固定）。`14-dungeon-road.js` は `makeCharacterHead(HEAD_DIMS)` / `makeCharacterHairShell({..., classKey:'wanderer'})` を `sections` なしで呼ぶ → 既定。`17-wanderer-style.js` は該当関数を呼ばない。budget spec の影の旅人のシグネチャ PASS | `noOutline`・目の回転・横の髪はすべて `if(softHead)` の中 → 影の旅人は既定のまま |
| `o.sections` の配線 | 呼び出し元を全件確認: `06` の頭（headSections）、`HEAD_DIMS`（髪の殻・前髪・横髪・後ろ髪の `headOut`）、魔導士の銀髪 `archHeadDims`（SOFT 固定。魔導士は魔法使い系列のみで影の旅人にならないので可）、`14` は既定。被り物の Coverage 関数（`arcHeadwearCoverage` / `cylinderHeadwearCoverage` / `findCoverageExitAlongStrand`）は `headRatioAt` を呼ばず headR と被り物の定数だけで判定するため、`sections` を受け取らなくて正しい。被り物の RINGS は既定の頭の幅に +15% 前後の手計算マージン（`05` のコメント）だが、SOFT で広がるのは頬より下（被り物の開口側）だけで、撮影でも地肌の露出は見られない | ― |
| 首 | 下端 `HIP_Y + bodyH*0.925` は既定の首の下端と同じ。上端は顎の下面 +0.05 で頭の内側（顎付近の頭の断面の半幅 ≈ 0.19、首の半径 0.065、z も頭の内側）。`neck` は `headLookPivot` に乗らない（頭だけ回る）。見下ろし・攻撃の撮影では露出なし | ― |
| 三角形の算術 | `makePlate` は ExtrudeGeometry（キャップ 2(n−2) + 側面 2n = 4n−4）。1 眼 +16 点 × 4 = +64、両目 +128、本体 + 輪郭線 2 + X 線 1 の 4 複製で **+512** → budget の差（例 16256 − 15744）と一致 | 目 6 枚から輪郭線・X 線を外す: メッシュ −6×3 = **−18**。三角形: 新しい目の本体 2×(52+44+28) = 248、T-0 の目 4 複製 4×120 = 480 → **−232**。budget 8 行すべて T-0 −232 / −18 と一致 |
| 比較画像 | `t1-compare-head/body/poses/game-844x390`: 顎の丸み、角の取れた目、首の棒が顎の下に収まる、影の旅人不変 ―― 主張と一致。ゲームカメラでは差はほぼ判別できない（Task file にもその旨あり）| 新しい `t1-compare-head`・`face-design-*`: 目の点線の輪が消え、正面の目は丸い。横顔で新しい黒い楔が見える（F-1）|

## Findings

### must-fix
なし

### should-fix
- **S-1（`c4d66e3`）横顔の頬に黒い楔が出る** ― `src/legacy/parts/06-player-enemy.js`（横の髪 `if(softHead){ sideHair.scale.set(0.62,0.78,0.62) ... }`）と `05` `makeCharacterHairShell` のうなじの輪。`t1-compare-head.jpg` の faceSide 後、`face-design-faceSide.jpg` の「輪郭2」以降で、剣士・戦騎士・魔法使い・魔導士・弓師・鷹の目の頬の中ほどに、前へ尖った黒い三角が出る。推定: 髪の殻のうなじの輪（yFrac 0.34。横・後ろの点は頭の 1.09 倍の外、顔側の4点は内側）と生え際の輪（0.72）の間にできる斜めの面。これまでは太い横の髪の房に隠れていた。SOFT の断面で 0.34 の幅が 0.856 → 0.952 に広がり、外へ出る量も増えている。横の房は根元を下げた上で後ろへ寄せたので、根元が被り物の下端から ≈ 0.085·headR 下に出る（`makePrism` は両端キャップなし）。Human の「頬の横に黒い板」の指摘箇所で、`face-design.md` §4 / §6 #2「横顔で頬が見える」の主張とずれる。提案: 楔の原因（髪の殻の側面か、房の影か、房の開いた根元か）をメッシュの色分けで特定して直す（例: 4職ではうなじの輪の側面の点を顔側寄りに、または房の根元を被り物の下端 / 殻の内側に残す）。直さない場合は既知の残りとして Implementation Result と V-1 の確認項目に書く
- **S-2（`7734197` / `c4d66e3`）「目の大きさ・縦横比・間隔は不変」の記述が実際の見た目と少し違う** ― `05` `makeEyeOutline` の点は角度 0 から始まる。白目 14 点は 90° に頂点が無く、縦の外接寸法が 0.975 倍（見た目の縦横比 1.28 → ≈1.25）。瞳 6 → 12 点で縦の寸法 +15.5%（1.73r → 2r）・面積 +15.5%。ハイライト 4 → 8 点で面積 +41%。`c4d66e3` の 0.28 rad の回転で、正面から見た白目の幅は 0.961 倍、瞳は白目より ≈0.015 前にあるので外へ ≈0.004 ずれる（左右の瞳の間隔 +約 4%。T-4 の「目が離れすぎ」の指摘と逆方向）。DEC-036 は瞳 0.046・縦横比 1.28・大きさ / 間隔の維持を明示している。提案: 白目の点の数を 4 の倍数（12 か 16）にして縦横比 1.28 を厳密に保つ。瞳 / ハイライトの見た目の増加と回転による瞳の外ずれを Implementation Result・`docs/CHARACTERS.md`・`face-design.md` §3 に事実として書き、Human の V-1 の確認項目にする（必要なら回転を白目だけにする / 瞳の x を補正する）
- **S-3（`7734197`）計画上 T-1 に割り当てた接合の項目の行き先が記録されていない** ― `.ai/tasks/CHARACTER-VIS-002.md` の Work Items の注記と joint analysis §「割り当て」は J-1・J-2・J-4・J-7・J-8（と J-9 の方針決定・J-11 の動画での確認）を T-1 に置いている。Implementation Result は J-4 / J-7 / J-8 を「T-2〜T-5」へ送り、J-1 は対策を試して戻している（後頭部の帯は画像でも残る）。DEC-036 の T-1 の範囲（頭・顔・首・髪・帽子・フード）に照らすと送るのは妥当だが、AD が無く、T-2〜T-5 の行にも J-4 / J-7 / J-8 / J-9 / J-11 の担当が無い（このままだとどの Work Item にも属さない）。`c4d66e3` で J-3（T-3 の項目）を4職とも T-1 で行った点も同じ。提案: AD を1行足して割り当てを直し、T-2〜T-8 の行または Plan へ担当を書く
- **S-4（`c4d66e3`）目の輪郭線を外す・向きを変える変更と、E-3 の線引き** ― `face-design.md` §3 は瞳孔・まぶたを「T-4 で Human が承認した目の見た目を変える」ので E-3 としている。一方で輪郭線・X 線を外すことと 0.28 rad の回転も、承認済みの目の見た目を変える変更として、Human への提示（E-3 の Facts か V-1 の確認項目）に明示されていない（Task file には「実装済み」とだけある）。Human の「目も変」の要求に応える改善としては妥当。提案: E-3 の Facts / V-1 の確認項目に「目の輪郭線を外した」「目を外へ 0.28 rad 向けた（S-2 の見た目の変化を含む）」を載せ、Human が外せるようにする

### note
- **N-1** T-2 体格のテストの換算（`tests/character-motion.spec.js`、AD-18）: 肩幅は変えずに頭だけが 5.0/4.75 倍になったので、肩 / 頭の範囲を 4.75/5 倍にするのは、DEC-036 に基づく正当な仕様の更新で、テストを弱めてはいない（同じ絶対的な肩幅を検査し、肩 / 全高 ≤ shoulderMax は不変。頭身の ±0.1 は 5.0 を通さない）。ただし魔法使い ≈1.20・盗賊 ≈1.256 は T-2 V-1a の元の下限 1.26 を下回る。AD-18 で Human の目視確認の項目にしてあるので、Final Report の Human 確認項目に必ず載せること
- **N-2** budget spec の更新（`7734197`: +512、`c4d66e3`: 実測の減少値へ下げた）は算術と一致し、上限を下げた方向なので弱めていない。`c4d66e3` で入った `CVB_PRINT` の `console.log` は計測用で無害だが、残すなら意図をコメントに書く
- **N-3** 魔導士の `archHeadDims` は `HEAD_SECTION_RATIOS_SOFT` を直接書いている（`headSections` ではない）。現状は影の旅人が魔導士にならないので問題ないが、`headSections` を使う方が「4職は softHead で選ぶ」の一本化として安全
- **N-4** `c4d66e3` で目の回転の後、白目の外側の前面の角と顔の面の余裕は計算で ≈0.001（剣士、目の高さ。頬の nosePush 0.04 → 0.07 で顔が前へ出たが `eyeFrontZ` は不変）。撮影では埋まりは見えないが、首振り・拡大でのちらつきは iPhone 実機の確認項目で見ること。回転の式（`x' = cx + dx·c + dz·s`、`z' = cz − dx·s + dz·c`）は `rotation.y = th` と一致し、+x の目が外向き（法線 (sin th, 0, cos th)）になる。正しい
- **N-5** `HEAD_SECTION_RATIOS_SOFT` の顎線の nosePush は `7734197` で 0.08 → 0.07 だったが、`05` のコメントには書かれていなかった（Implementation Result にはある）。`c4d66e3` で 0.09 とコメントに明記された。Task file の追加の表は「0.07 → 0.09」（T-1 の初版から）、`face-design.md` / コメントは「0.08 → 0.09」（既定から）と基準が違う。どちらの基準か書いておくとよい
- **N-6** `face-design.md` §5 の案 B は「1 人 +2 メッシュ程度」、E-3 は「+2〜6 メッシュ程度」で揃っていない
- **N-7** `c4d66e3` の時点で T-1 の Status は IMPLEMENTING（E-3 の回答待ち）。この Review はその途中の状態の確認で、E-3 の回答後に部品を足す場合は再 Review が要る。Test Report（T-1）は `7734197` の結果のままなので、`190e86a` 以降の結果を追記すること
- **N-8** 影響（T-2 以降）: 剣士の BUILD（胴 −0.0107、hipY −0.016）が変わったので、T-2 の衣服の丈・ゲイターの高さは新しい値の上で調整することになる。肩幅・手足の太さは不変なので、衣服の Loft は追従しているはず（撮影で破綻なし）。T-3（魔法使いの長い髪）は横の髪の房が4職とも細く・後ろへ寄った前提で計画すること
- **N-9** 環境: 複数のセッションが同じ作業ツリーで Playwright を流すと、共有の dev / preview サーバー（`reuseExistingServer`）で互いのテストを汚染する。Test Report の E2E は単独で流した結果であることを確かめるとよい

## Verdict
**PASS**（must-fix なし。`7734197` / `c4d66e3` とも）。should-fix S-1〜S-4 は Implementer へ戻すことを推奨（特に S-1 の横顔の黒い楔と S-2 の目の見た目の記述）。T-1 は E-3 の回答と Human の目視承認（V-1）が残っている。

## Round 2（Reviewed SHA `396c83c`）
- 範囲: `c4d66e3..396c83c`（コード `0923f6d`、記録 `5bcf10a` / `7e9d206` / `396c83c`）。Round 1 の指摘への対応と、それが起こしうる退行だけを確認した
- 独立性: 同じく別コンテキスト。一時 worktree（`396c83c`、ポート 5273 / 4273 の一時 config）で実行し、終了後に削除した。同時に動いている他の Playwright は無かった

### Checks & Results
| 確認 | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | PASS（2341 pass / 0 fail / 1 skip）|
| E2E `character-visual-budget` `character-motion` `weapon-stow` `wanderer-renewal` `character-clothing`（隔離した worktree）| **44/44 PASS**（9.6 分）。`CVB_PRINT=1` の実測値は budget の8行と完全に一致（剣士 307 / 15528 … バーサーカー 311 / 15328。body・mats は T-0 のまま）|
| 三角形の算術 | 白目 14 → 16 点で 1 眼 +8（4n−4）、両目 +16 / 人。目は輪郭線・X 線が無いので複製されない。T-0 との差は −232 → **−216**。8行すべて +16 で一致 |
| S-1 頬のくさび | `05` `makeCharacterHairShell` の `opts.napeSideIn`: うなじの輪の点 1 / 4（`HEAD_HEX_TEMPLATE` の cheekL / cheekR。`headSectionPoints` の並びは face 6 点 + nose 2 点なので添字は正しい）だけを 0.96 倍にする。`hairShellPointAt` は被り物の内側へ縮めるだけで外へは押し出さない。新しい `t1-compare-head.jpg` の横顔でくさびは消えている（こめかみに細い横の房の小さな影が残る。記録どおり）。後頭部・背面の髪の見え方は Round 1 と同じで、地肌の新しい露出は見られない |
| S-1 の影の旅人への影響 | `06` は `napeSideIn: softHead`、`14-dungeon-road.js` は渡さない → 影の旅人の殻は既定のまま。budget spec の影の旅人のシグネチャ（加入後・加入前の立ち / 座り）PASS |
| S-2 目 | 白目 16 点: 0° / 90° / 180° / 270° に頂点が来るので、描画上の縦横比は 1.28 で厳密。回した後に3枚を `pupil.x − pupilX0` だけ横へ戻す: 瞳の左右の位置は回す前と一致し、3枚の相対の配置（回転）は保たれる。unit の固定値も 16 へ同期（`wanderer-visual-freeze`）|
| S-3 / S-4 | AD-19 と T-2〜T-5 の行に J-1 / J-4 / J-7 / J-8 / J-9 の担当、J-11 は T-8 と iPhone の確認。E-3 の Facts に実装済みの目の変更を明示、E 案（目を T-4 の見た目へ戻す）と Minimal answer を追加 ―― 妥当 |
| 魔導士の `archHeadDims` | `applyJobPromotionVisual` は `buildPlayer` の外で `headSections` が見えない ―― 確認した。`HEAD_SECTION_RATIOS_SOFT` のままとコメントで可（Round 1 N-3 の提案は取り下げ）|

### Findings（Round 2）
- must-fix: なし
- should-fix: なし
- note:
  - **R2-N1** 瞳を元の位置へ戻した代わりに、白目の中心が左右とも内側へ ≈ dz·sin(0.28) ≈ 0.004 寄る（白目の中心の間隔 ≈ −4%）。「間隔 0.095」が実際には瞳の位置を指すことになった。Implementation Result の「目の向き」の行（「大きさ・間隔・瞳・縦横比は不変」）と E-3 の Facts（「左右の瞳の間隔がわずかに変わる」）は、`0923f6d` の後の状態（瞳の間隔は同じ、白目がわずかに内側）に合わせて書き直すとよい
  - **R2-N2** Round 1 N-4 の続き: 白目を内側へ寄せたので、外側の前面の角と顔の面の余裕は計算で ≈0.0006（剣士、目の高さ）とさらに小さい。撮影では埋まりは見えない。iPhone 実機の拡大・首振りで確認する項目として残す
  - **R2-N3** 瞳の見かけの高さ +15%・ハイライトの面積 +41% は、Implementation Result で V-1 の確認項目と明記された（Round 1 S-2 の残り。対応として十分）

### Verdict（Round 2）
**PASS**（`396c83c`）。Round 1 の S-1〜S-4 は解消されている。退行は見つからなかった。T-1 に残っているのは E-3 の回答と Human の目視承認（V-1）。
