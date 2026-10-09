# CQ-01 Analysis — Chapter 1 Full Playthrough QA

Analyzer。対象: `main` `49ffc25`（#63 まで）。目的: Human が iPhone 実機で Chapter 1 を最後まで遊び、Content Ready / Not Ready を判定できる状態にする。

## 1. 結論

- **CODE READY = YES**: 5段（洋館・村・幽霊船・時計塔・道）が本編から順に遊べる形で `main` に入っている。進行不能の既知バグは無い（道の最終戦闘の湧き直しは CR-03 で修正済み）。
- **CONTENT READY = HUMAN DEVICE CHECK REQUIRED**: 本編を最初から最後まで通した実機プレイが一度も無い。島の遠景・跳躍の間・手触り・テンポは自動テストで判定できない。
- 成果物: Human 用チェックリスト `docs/CHAPTER1_PLAYTEST.md`（A・B・V・C・D・E・G の 118 項目、4状態の判定、Content Ready 基準）。

## 2. 調べた資料

| 区分 | 資料 |
| --- | --- |
| 仕様 | `docs/CHAPTER1_STORY.md`、`docs/CHARACTERS.md`、`docs/SCENARIOS.md`、`docs/PROGRESSION.md`、ルートの `MANSION_SCENARIO.md` |
| 決定 | `.ai/decisions/DEC-001`（村）、`DEC-004`（第一章の物語・N-4）、`DEC-005`（影の旅人の斬撃の色）、`UI-002-human-decisions.md`（Skill 1）、`.ai/reports/CHAPTER1-CONTENT-plan.md` §0（HD-C1〜C4・凍結） |
| 既存の確認表 | 洋館 CM-05 / CM-07（PR #42 / #44 のブランチ）、村 CV-02（PR #48）、幽霊船 CG-05（`.ai/reports/CHAPTER1-GHOSTSHIP-balance.md`）、時計塔 CT-05（`.ai/reports/CHAPTER1-CLOCKTOWER-balance.md` H-1〜H-12）、道 CR-02 / CR-03 |
| 実装 | `core/chapter1-progress.js`（5段・一本道・`MET_INSIDE`）、`core/chapter1-rules.js`（旧成長系を本編で止める）、`01` `CHAPTER_CAST`、`12` `SCENARIO_DEFS` / 出撃一覧、各ダンジョンのファイル |

## 3. Chapter 1 の本編の流れ（実装から）

```
新規開始（剣士）→ 洋館 → 酒場（鍛冶士加入・魔法使いへ交代）
→ 宵待ちの村 → 酒場（弓師＋魔法使い）
→ 幽霊船 → 酒場（盗賊＋弓師）
→ 時計塔 1F〜5F → 時喰らい → 崩壊 → 見晴台 → 跳躍 → 名も無い島（遠景の人影）→ 酒場（翌朝）
→ 道（盗賊＋弓師）→ 橋の影 → 休憩所「？？？」→ 正式加入（影の旅人＋盗賊）→ 戦闘2 → 丘 → 酒場（第一章の最後の会話 12行）
→ 「この先の旅」（Chapter 2 の入口、出撃不可）
```

保存は酒場に戻るたび。進行は `scenarioClears` だけから導く（新しいセーブ項目なし）。

## 4. 自動テストで見ている範囲（区間ごと）

| 区間 | unit | E2E | 自動で見られないもの（→ 実機） |
| --- | --- | --- | --- |
| 新規開始・酒場 | `chapter1-progress`、`chapter1-rules`、`chapter1-smith-shop` | `chapter1-progression`、`save-load`、`shadow-guide`（「？？？」）、`chapter1-facility-access`、`chapter1-legacy-ui` | ― |
| 洋館 | `mansion-*`（butler / lord / warden / enemies / anomaly / combat-curve / lamp-zones）、CM-02〜06 の unit（PR #39〜#43、未 merge） | `mansion-scenario`、`mansion-butler` / `-lord` / `-warden` / `-enemies` / `-escort`、`chapter1-skill2` | 分離のカメラ・再会の見え方・館の主のフェーズの間・全体の長さ |
| 村 | `dusk-village-map`、`village-echo`、`warden-echo`、CV-01 / CV-03 の unit（PR #47 / #46、未 merge） | `duskvillage`、`chapter1-dusk-basics` | 魔法使いの手触り・ボス戦の長さ（CV-02）・BGM（CA-01、PR #45 未 merge） |
| 幽霊船 | `ghostship-story` / `-ending` / `-route` | ― | 甲板の湧き直しの煩わしさ・船倉の着地点の被弾・船長戦の長さ |
| 時計塔 | `clocktower-story` / `-finale` / `-route` | ― | H-1〜H-12（3F の針・5F の距離・跳躍の間・島の人影） |
| 道 | `road-stranger`、`road-enemies`、`wanderer-attack-color` | `road`、`chapter1-tower-to-road`（酒場 → 道の導入 → 出撃 / 休憩所 → 加入 → 戦闘2 → 丘 → 最後の酒場） | 影の遅れ・紫の斬撃の見え方・戦闘の手触り |
| 第一章の終わり | `chapter1-progress`（`chapter1Complete`） | `chapter1-progression` #10（「この先の旅」） | ― |

**本編で時計塔を登り切る E2E は無い**（この環境は 3〜7fps）。屋上 → 跳躍 → 島は unit とスクリーンショット（CR-02）だけ。

## 5. `main` に入っていない、関係する PR（Human の merge 待ち）

| PR | 内容 | 実機の通しへの影響 |
| --- | --- | --- |
| #38〜#44 | CM-01〜CM-07（洋館の仕様照合・テスト・実機手順） | ゲームの挙動はほぼ変えない（#38 は Arena の的のテスト用の修正のみ）。洋館の確認項目は本チェックリストに統合済み |
| #45 | CA-01（村と道の手続き生成 BGM） | **merge 前は村・道が BGM 無し**。チェックリストでは V-08 / E-24 を「merge 前なら NOT TESTED」とした |
| #46〜#48 | CV-03 / CV-01 / CV-02（村のテスト・負荷・手触りの手順） | 挙動は変えない。確認項目を統合済み |
| #49 / #54 | CG-01 / CT-01（監査文書のみ） | 影響なし（#54 の内容は #60 で `main` に入っている） |

12 本（#38〜#49）は、それぞれ `main` に単独で、また 12 本を順に重ねても衝突しない（ローカルで確認。CM-04 の unit 1件は CG-03 に追従して修正済み）。

## 6. 第一章で出てはいけないもの（禁止要素）

実装の判定（`legacyGrowthEnabled(testMode)`、`chapter1-progress`）から:

- レベル・経験値・レベル表示・推奨レベルでの出撃制限・攻撃 Tier・転身
- 装備ドロップ・鑑定・強化・鍛造・クラフト・ステータス配分
- スフィア盤・パッシブ・ボス能力の効果
- 商店での購入、Skill 1 / Skill 2 の付け替え、Skill 3
- 異空間の裂け目（anomaly、PROGRESSION-008）
- 周回（★2 以降・制限時間・再訪）、★3〜4 の奥（洋館の隠し部屋・屋根裏、船倉・最深部、隠し歯車庫）
- 第一章の外の行き先（水路・神殿・温室）

※ 洋館の「異常空間」は物語の一部で、上の「異空間」とは別物。

## 7. Content Ready の判定基準（要約）

YES の条件（全て）: Main route 完走 / Critical FAIL 0 / 主要演出成立 / 加入成立 / 時計塔 → 島 → 道の接続成立 / 最終戦闘 → 丘 → 酒場 → Ending 成立 / 禁止要素なし / Critical・Major FAIL 0。Minor と OBSERVATION だけなら YES のまま。
詳細と重さの定義は `docs/CHAPTER1_PLAYTEST.md` §9〜§10。

## 8. 既知の技術課題（判定に混ぜない）

| ID | 内容 |
| --- | --- |
| TF-02 | `mansion-enemies.spec.js:220` 猟犬の予兆が出ず `PASSIVE/IDLE` のまま（テストのセットアップ側が濃厚）。CI でまれに落ちる |
| TF-03 | `combat-events-layout.spec.js:263 / :296` 特定のカメラ角度でインタラクトの表示が `#joy-zone` に重なる。（2026-10-09 更新）CI の失敗時に手がかりを記録する仕組みを merge 済み（#65）。**根本原因は未確定**（実際の UI の不具合かどうかも未確定）。`.ai/reports/TF-03-analysis.md` |

## 9. Human Decision

- **不要**。新しいゲームデザインの判断は無い。実機で見つかった見た目・テンポの問題は OBSERVATION として記録し、直す場合は改めて Human に上げる（数値は HE-3）。
