# CHARACTER-VIS-002 T-0 Review

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | CHARACTER-VIS-002 / Work Item T-0（+ 同じ範囲の文書: joint analysis、CHARACTER-MOTION-RENEWAL の analysis / task、頭身の比較画像）|
| Branch | `claude/wanderer-renewal-001-nhlxns` |
| Reviewed SHA | `cc1b8f1` |
| Diff range | `01b2abe..cc1b8f1`（5 commits: `96e8a95` DEC-035 / `0fe3195` motion analysis / `0519efb` joint analysis / `24259d1` T-0 実装 / `cc1b8f1` 実施記録・比較画像・motion task）|
| Base | `claude/road-visual-003-r3-7` @ `3b168a2`（origin で確認、`01b2abe` の祖先）|
| Changed files | src: `05-rendering-rig.js`, `06-player-enemy.js`, `14-dungeon-road.js`, `src/core/motion-preview.js` / tests: `unit/motion-preview.test.js`, `unit/wanderer-visual-freeze.test.js`（新規）, `unit/road-stranger.test.js`, `character-visual-budget.spec.js`（新規）/ docs: DEC-035, CHARACTER-VIS-002.md, CHARACTER-MOTION-RENEWAL.md, 2 analysis reports, 4 jpg |
| Handoff Verification | Orchestrator から Review Target（branch / SHA / range / base）と DEC-035 を受領。range・base の祖先関係・merge commit 無しを git で確認 |
| Analysis Source | `.ai/reports/CHARACTER-VIS-002-analysis.md`（`7caabaf`、Task file の記録どおり）|

## Result
**PASS**（must-fix なし。should-fix 1 件は T-1 着手前に解消すること）

## Independence
別 Agent・別コンテキストの Reviewer。Implementer の判断過程は入力にしていない（diff・Task file・実行結果のみ）。

## Checks
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | PASS | DEC-035 の T-0（影の旅人の分離・共通関数の既定値不変・見えない鎧の調査・描画回数の記録・頭身比較画像・接合調査・モーション分析を独立 Task で）をすべて満たす。見た目を変える変更なし |
| 2 | Scope compliance | PASS | 変更は Files To Change の T-0 行のみ（`road-stranger.test.js` の代役更新は Approval に追記済み）。`13`・`17`・パレット・CLIPS は未変更 |
| 3 | Regression / 見た目不変 | PASS | `BUILD.wanderer` は `BUILD.warrior`（05:2066-2074）と全 27 値が一致（目視比較）。`P.build`（13:1196 の `P.build \|\| BUILD.warrior`、05:3886、06:2174/2312）は `playerMixerParts.build = B` 経由で同値の行を読む。`BUILD` の同一性比較・キー列挙は src / tests に無い（grep `BUILD\.\|BUILD\[`、`=== BUILD`、`Object.keys(BUILD`）。`checkBuild('wanderer')` は整合式を満たす（stanceW+thigh 0.205 ≤ 0.22）。**独立再現**: `3b168a2` の worktree で同じ probe を実行し、影の旅人の4シグネチャが期待値（`5fa1eb90/341`・`4aeddb73/31`・`4e1507f0/35`・`b9781fa3/8`）と完全一致 |
| 4 | Build | PASS | `npm run build` exit 0 |
| 5 | Unit tests | PASS | `npm run test:unit`: 2342 tests, pass 2341, fail 0, skipped 1 |
| 6 | E2E tests | PASS | `npx playwright test tests/character-visual-budget.spec.js tests/character-clothing.spec.js tests/wanderer-renewal.spec.js --trace off`: **20 passed (1.8m)**、FLAKY / FAIL なし |
| 7 | Save/Load integrity | PASS | セーブ関連の変更なし（BUILD はセーブされない）|
| 8 | Existing behavior | PASS | MESH 行は Debug Motion Preview（デバッグモード時のみ、14-hud-boot.js:1305/1367）。本番 UI 不変 |
| 9 | Code duplication | 許容 | `BUILD.wanderer` は剣士の行の直書きの写し。分離が目的（参照・複製にしない）で unit が固定しており妥当 |
| 10 | Unnecessary architecture changes | PASS | 先回りのオプション引数を足していない（AD-14）|

### テストの健全性（`character-visual-budget.spec.js`）
- 決定性: 影の旅人のシグネチャは base / HEAD・複数回の実行で同一（本レビューで再現）。ジオメトリは CPU 生成で GPU 非依存。予算は `<=` のみで、記録値は実施記録の表（変更前後で一致）と一致
- 検出力: 頂点数・インデックス数・外接箱・頂点座標チェックサム・Material の値・表示フラグ・木の形を含み、形・色の変化は検出する。加入前の姿は変形も含む
- **穴（R-1）**: 加入後のリグ（`player`）は変形を含めないため、部品の位置・回転・スケールだけの変化は検出しない（下記）
- `road-stranger.test.js` の代役変更はキー名 `warrior`→`wanderer` のみ（値同一、assert 不変）。加入前の姿が `BUILD.warrior` へ戻ると代役に無いキーで失敗するため、弱化ではなく追従

### 文書の spot-check
| 文書 | 主張 | 結果 |
| --- | --- | --- |
| joint analysis | J-2 `05:739` 顎 widthMul 0.38、`06:740` 首 | 正（06 は `3b168a2` の行番号）|
| joint analysis | J-1 `06:1035` / `06:1077`（髪の房の隠れ判定）| 正（`3b168a2` で `findCoverageExitAlongStrand`）|
| joint analysis | J-4 `06:1716` 手の 8×8 球、`06:1740` vambrace | 正（`3b168a2`。HEAD では +1〜2 行ずれる）|
| joint analysis | J-6 `06:1648` TorusGeometry(headR*0.95, headR*0.2024, 6, 12) | 正（`3b168a2`）|
| joint analysis | J-8 `06:2067` addOutline(group) | 正（HEAD 06:2067、base では空行。R-3）|
| motion analysis | basic3=spin / basic4=skill2・dash の流用 `05:3167-3176` | 正（05:3165-3176）|
| motion analysis | `COMBO_CLIP_BY_STAGE` `11:74-86` | 正（11:73-79。剣士 3 段で basic3 を使わない）|
| motion analysis | プレイヤー被弾の体の反応なし（07:1850 付近）| 正（`spawnDamagePopup` + `flashScreen` のみ。hurtT/flinch は敵側だけ）|
| motion analysis | `triggerPlayerDown` `12:1244` | 正 |
| motion analysis | 歩幅 `13:1193-1197`（strideT += speed·dt·2.7、min(0.62, 0.045+0.085·v)）| 正（`B.strideAmp` を掛けるが脚長 hipY は見ない、の記述と整合）|
| motion analysis | `DODGE_MOTION` `13:1042-` | 正 |
| CHARACTER-MOTION-RENEWAL.md | 形式・制約 | Goal / Constraints / Work Items / Plan / Test / AC / Risks / Rollback / Out of Scope / Escalation / AD / Status History を備える。判定・時間・キャンセル・応答性の維持、影の旅人不変、VIS-002 と非並行を明記。Status PLANNED（実装なし）|
| head-ratio-compare.jpg | 行ラベル・列 | 行 = 5.0（現行・変更前）/ 4.75（比較案）/ 4.5（比較案）、列 = 正面・斜め前・横・顔の拡大・ゲームカメラ。Task file の記述と一致。表の値は全高 2.539〜2.54、headsTall 4.757 / 4.504、hipY = thigh+calf、首の見える長さ（headGap−headR = 0.036）一定で整合 |

### Protocol
- range に merge commit なし。`main` への merge なし。base `claude/road-visual-003-r3-7` は origin で `3b168a2` のまま
- Human Decision は DEC-035 に記録（E-1 = A / E-2 = A / 追加要求 / T-0 指示 / 規則）
- T-0: Approval（Agent Approval、Escalation Check: None）→ IMPLEMENTING → TESTING → REVIEWING を Status History に記録。T-1 は頭身の選択待ち（WAITING_APPROVAL）で正しい
- 作業ツリーは clean（本 report 以外を変更していない。base 検証用の一時 worktree は scratchpad に作り削除済み）

## Findings

### must-fix
None

### should-fix
| # | 箇所 | 問題 | 期待する状態 | 確認方法 |
| --- | --- | --- | --- | --- |
| R-1 | `tests/character-visual-budget.spec.js` の `sigs()`（`treeSig(player, false)`）| 加入後のリグのシグネチャは変形を含めないため、部品の位置・回転・スケールだけの変更を検出しない。**実証**: `3b168a2` の worktree で `06:740` の首の高さ `bodyH*0.99`→`0.90`（約 7cm 下げる、見た目が変わる）にしても、シグネチャは `5fa1eb90/341` のままテストが PASS した。T-1 の J-2（首を頭の下面へ埋める）・J-7・J-10 はまさに共通の `buildPlayer` 内の位置の調整なので、影の旅人へ波及しても気づけない。なお単純にメッシュの変形を加えると、待機アニメで動くメッシュがあるため実行ごとに値が変わる（本レビューで2回とも不一致を確認）| T-1 着手前に、組み立て直後の姿勢の変形を含むシグネチャを追加する。例: (a) probe で影の旅人の classDef から別のリグを組み立て、シーンに入れず変形込みで hash（加入前の姿と同じ作法。`playerMixerParts` 等の副作用は退避・復元するか、テストの最後に行う）、または (b) アニメーションで書き換えるノード（ピボット）を明示して除外し、残りの変形を含める。実施記録の「検出できること」の行に位置だけの変更を追加 | 首の高さなど位置だけの一時変更で影の旅人のテストが FAIL すること、未変更で2回連続 PASS すること |

### note
| # | 箇所 | 内容 |
| --- | --- | --- |
| R-2 | `05:3944-3960`（motionBodySnapshot の mesh）| `motionPanelSnapshot()` はデバッグモード中は毎フレーム呼ばれ（局面の記録のため、14-hud-boot.js:1367）、`traverseVisible` が約 300 メッシュを毎フレーム走査する。デバッグ時のみで負荷は小さく許容。気になるなら文字列更新の 0.5 秒の枝でだけ計算する |
| R-3 | `.ai/reports/CHARACTER-VIS-002-joint-analysis.md` | 冒頭の基準は「`3b168a2` + T-0」だが、06 の行番号は `3b168a2` 版（HEAD では 547 行以降が +2 行ずれ、J-8 の `06:2067` だけは HEAD の行）。基準版を「行番号は `3b168a2`」と明記するとよい |
| R-4 | `.ai/tasks/CHARACTER-MOTION-RENEWAL.md` | Analysis の Source SHA / blob が未記録（「Persistence 後に記録」）。`0fe3195` で push 済みなので記録できる |
| R-5 | `head-ratio-compare.jpg` | 画像内に数値（headR 等）は無く、値は Task file の表にある。Human へ提示する際は表と一緒に見せる |
| R-6 | Task file | 本 Reviewer は Orchestrator の指示により commit しない。Status History の `REVIEWING（Reviewer PASS）` 行は Orchestrator が本 report と一緒に記録すること |

## Required Changes
None（R-1 は should-fix。T-1 の着手条件として扱うことを推奨）
