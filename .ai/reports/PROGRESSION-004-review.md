# PROGRESSION-004 Review（第一章序盤の施設アクセス）

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-004 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `b1afaa14a740e96298abd8b7301383a11dec5ab2` |
| Diff range | `68af531..b1afaa1`（実装 `c90514b`、E2E の歩き方 `8a3b0c7`、文書 `b1afaa1`） |
| Handoff Verification | V-1〜V-6 OK（Analysis `4ba5a1a`・Plan `68af531` の blob 一致） |

### Result
PASS

### Independence
同一セッションで兼務（施設への入口を `toggleAppraisal` / `setOverlay('appraisal')` / `nearbySmith` / `useCheckpoint` で全数 grep し直し、本編・テストモード・旧セーブの経路を読み直した。Human による差分確認を推奨）

### Checklist（Human 指定の 10 観点）
| # | 観点 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | 第一章序盤で施設が実際に利用できない | PASS | E2E: 新規ゲーム・剣士だけの段階の旧セーブで、加入後に鍛冶士へ届く歩き方を同じだけ繰り返しても、鍛冶士・作業台のインタラクトが一度も出ず、I キーでも開かない（変更前の src では「🧰 仮設の作業台(鑑定・強化)」が出て開く → FAIL を確認）。洋館のチェックポイントは回復だけ（unit: `setOverlay('appraisal')` は判定の中だけ） |
| 2 | ボタンの無効化ではなく進行条件 | PASS | 作業台そのものを建てない（`buildTavern`）・インタラクトの対象にしない（`nearbySmith`）・`KeyI` でも開かない（`toggleAppraisal`）・チェックポイントは施設の入口にならない（表示も「休憩する(回復)」）。判定は core の `smithFacilityAvailable()`（`smithJoined` = 鍛冶屋の加入、既存の確定仕様）1 か所 |
| 3 | 施設登場後の機能を壊していない | PASS | E2E: 洋館クリア後（`smithJoined: true`）は鍛冶士の前で鑑定所が開き、装備（古びた杖）・スキル（幻影歩法）の画面が出る。既存の `chapter1-old-save-growth`（PROGRESSION-003 の鑑定所の確認）・`tavern-smith-greeting`・`mansion-scenario` PASS |
| 4 | 旧セーブを破壊していない | PASS | セーブの読み書きは変更なし。E2E: 加入前の旧セーブ（`smithToolsRecovered: true`・素材あり）でも施設は出ず、セーブし直しても `smithJoined: false`・`smithToolsRecovered: true`・所持数が残る |
| 5 | Test Mode を壊していない | PASS | `smithFacilityAvailable` は `testMode` で true。テストモードの `KeyI`（どこでも）・Arena のロードアウト・加入前の作業台は今まで通り。E2E: テストモードで I キーが開く、既存のテストモードの spec（`ui-production-glyphs`・`job-traits`・`hud-zones-layout`・`chapter1-old-save-growth` のテストモード等）PASS |
| 6 | Skill 1 / Skill 2 / Ult 等への不要な変更 | PASS | 差分に無い |
| 7 | Chapter 2 への影響 | PASS（影響なし） | 判定は「鍛冶屋の加入」だけ。Chapter 2 の施設は決めていない |
| 8 | UI-002-F C-2 等の未決定事項を決めていない | PASS | 鑑定所の中身・道具（C-4）・Skill 1（C-1 / C-2）は変更なし。新しい台詞は書いていない（影の旅人の作業台を指す 1 行を、作業台が無いときに出さないだけ）。チェックポイントの文言は既存の「(回復+装備整理)」から「+装備整理」を外しただけ |
| 9 | Regression test の追加 | PASS | 新規 E2E `chapter1-facility-access`（4 件。加入前の 2 件は変更前の src で FAIL）、unit（`smithFacilityAvailable` の真理表、入口・作業台・文言の構造。変更前の src で 2 件 FAIL） |
| 10 | Build / Unit / E2E | PASS | Build PASS、Unit 1626 / 0 / 1、Protocol 16 / 16、E2E 全体（2 CPU）**233 passed**。GitHub Actions は下の Findings |

### Findings
- Info（既存 E2E の前提の移し替え）: 加入前の本編で鑑定所を開いていた E2E を、検証の中身（assertion）を変えずに施設が使える状態へ移した。`chapter1-skill2`（閃く前のスキル2タブ → 洋館クリア後の魔法使い）、`mansion-escort` D-04（剣士の Skill 2 = 崩し斬り → テストモード）、`chapter1-legacy-ui`（旧セーブの鑑定 UI → 加入後の旧セーブ）、`character-weapon-visual`（影の旅人 → 加入済みの Chapter 1 クリア後のセーブ。剣士 → 主人公の剣士が鍛冶士の前に立つ本編の段階が無いので、`smithJoined` だけを立てた合成のセーブ）
- Info（E2E の歩き方）: 加入後の鍛冶士へ W+D で歩くと、炉の当たり判定に突き当たって鍛冶士の範囲(3m)のちょうど縁で止まり、押している間は範囲の内外を毎フレーム行き来する（インタラクトの表示が点滅。MutationObserver で実測）。手を離した位置しだいで開けたり開けなかったりしていた（変更前の src でも再現）。共通の `openAppraisalAtSmith`（helpers.js）は W+D を押したまま I キーを押す形にした（剣士・影の旅人・魔法使いのセーブで 9 / 9）。新規 spec の「施設が無い」確認も同じ歩き方
- Info（GitHub Actions、`b1afaa1`）: 232 passed / 1 failed。FAIL は `base-class-identity:413`（テストモードの Arena で Dummy の向きを乱数で出し直す spec。CI-001 で「乱数の探索、再評価」と記録済み、PROGRESSION-003 のローカルの E2E 全体でも 1 回 FAIL）。今回の変更（本編の施設の判定。テストモードは true）の経路に無い。PR にコメントし、失敗した job を 1 回再実行した。根本原因（Dummy の向きが一様乱数で、40 回の出し直しで合わない run がある。合わない時に最後の向きを返すので、メッセージも紛らわしい）は今回の範囲外として Known Limitation に記録
- Info: 洋館をクリアしたのに `smithJoined` が無いセーブ（通常のプレイでは作られない）は施設が出ない（Known Limitation）

### Required Changes
None
