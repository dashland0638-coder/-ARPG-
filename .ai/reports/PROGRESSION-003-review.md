# PROGRESSION-003 Review（旧セーブの Skill 2 alt・必殺技 alt・Skill 1 新技・上位職 Skill 1 を第一章本編で使わない）

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-003 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `cf947362d3e578052d908e14dcf32a7fffa2570e` |
| Diff range | `7d7a9c1..cf94736` |
| Handoff Verification | V-1〜V-6 OK（Analysis `787556f`・Plan `7d7a9c1` の blob 一致） |

### Result
PASS

### Independence
同一セッションで兼務（`unlockedSkill1Alt / Skill2Alt / UltAlt`・`skill2Choice`・`ultChoice`・`skillChoice` の参照を全数 grep し直し、ロードの順序を読み直した。Human による差分確認を推奨）

### Checklist（Human 指定の観点）
| # | 観点 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | A-1〜A-4 が本編から隔離されているか | PASS | 値を読む所は、戦闘・HUD（`activeSkill2Def`・`recomputeStats` の ult・`activeSkill1Variant()`）と鑑定所のスキル画面だけで、どれも `skill2AltAvailable` / `ultAltAvailable` / `skill1VariantUsable` を通る。残る直接参照はロードの復元（09-save-load.js、値を読み込むだけ）とスフィア盤の解放・初期化（テストモードの画面）。E2E: 変更前は HUD に ⚡ / 🔥 / ❄️ / 🌠 が出て鑑定所に新技のカード、変更後は既定の 👣 / 🔍 / 既定の必殺技・カードなし |
| 2 | 旧セーブの値を壊していないか | PASS | 判定・解決の関数は読むだけ（unit）。E2E: セーブし直しても `unlocked*Alt`・`skillChoice`・`skill2Choice`・`ultChoice` が残る。ロードの復元は変更なし |
| 3 | 正式な第一章の Skill 仕様への Regression | PASS | 解放条件の無い技は `skill1VariantUsable` が常に true。default の Skill 2（閃き）・必殺技は変更なし。`chapter1-skill2`・`chapter1-dusk-basics`（観測の灯の閃き）・`chapter1-progression` を含む E2E 全体 PASS |
| 4 | 主人公の交代への Regression | PASS | 交代処理（`defaultSkill1For` / `learnedSkill2 = false`）は変更なし。E2E: alt 解放済みの剣士のセーブ → 魔法使いへ交代 → Skill 1 = 幻影歩法、Skill 2 = 未習得、必殺技 alt なし |
| 5 | Test Mode への Regression | PASS | テストモードは `legacyGrowth()` が true で、判定は変更前と同じ（上位職の技は転身済みのときだけ、の条件も同じ）。E2E: テストモードで新技・Skill 2 alt・必殺技 alt を選ぶと HUD が ⚡ / 🔥 / ❄️ に替わる |
| 6 | Chapter 2 の仕様を決めていないか | PASS | 判定は PROGRESSION-001 / 002 と同じ `legacyGrowth()`。値は残し、Chapter 2 の扱いには触れていない |
| 7 | UI-002-F の Human Decision 待ちを実装していないか | PASS | Skill 1 の基本技の付け替え（C-1）・剣士/盗賊/弓師の Skill 1（C-2、`CHAPTER1_SKILL1` に追加なし）・スキル画面の構成（C-3）・装備の道具と置き場所（C-4）・`learnedSkill2` キー無し（C-5）は変更なし。鑑定所は使えない alt・技のカードを出さないだけで、表示は新規ゲームと同じ「固定」 |
| 8 | 条件判定が散らばっていないか | PASS | 判定は 3 つの関数（12-progression-ui.js）に集約。Skill 1 の技の解決は同じ式の 4 か所を `activeSkill1Variant()` に置き換えた（直接参照が残っていないことを unit で固定） |
| 9 | Build / Unit / Protocol / E2E | PASS（下の Findings） | 1621 / 0 / 1、16 / 16。新規 E2E 4 件（変更前の src で 3 件 FAIL、テストモードの 1 件は変更前も PASS）。GitHub Actions（`cf94736`）success |

### Findings
- Info（挙動の差）: 選ばれている技が使えない・存在しないときの Skill 1 は、`retreat` 固定から `defaultSkill1For(class)` に変わった。剣士・盗賊・弓師は `retreat` のままで同じ。魔法使いだけ幻影歩法（新規開始・交代と同じ）。C-2（3 職の Skill 1）は決めていない
- Info（E2E 全体、2 CPU）: 225 passed / 3 failed / 1 flaky。FAIL は `base-class-identity:413`（Dummy の向きを乱数で探す。CI-001 の記録で 4 CPU でも落ちていた spec）、`combat-events-layout:70`（844×390 safe-area の処刑）、`execution-break:99`（処刑のプロンプト）。3 件ともテストモードの戦闘で、今回の判定の結果は変更前と同じ（`legacyGrowth()` が true、解放条件の無い技）。同じコードで再実行して 3 件 × 2 回すべて PASS（10 / 10、`combat-events-layout:70` は 3 viewport 分）、同じ commit の GitHub Actions は全件 PASS。原因は今回は調べていない（間欠的な FAIL として Known Limitation に記録。retry・timeout は変更していない）
- Info: E2E の鑑定所への歩き方を、短い歩幅でインタラクトの表示を見て開く形にした（CI-001 の記録どおり、W+D の道は鍛冶士の範囲の縁をかすめるだけ。最初の形では 2 回中 1 回開かなかった → 変更後 3 / 3）

### Required Changes
None
