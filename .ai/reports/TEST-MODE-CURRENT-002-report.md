# TEST-MODE-CURRENT-002 — 第一章ルールでの経験値・レベルアップ混入の調査と修正

**状態: Reviewer PASS ／ CONTENT READY = HUMAN DEVICE CHECK REQUIRED**（PR #101 に追加。main への merge は Human の判断）

## 1. 報告された事象

PR #101 の確認中、テストモードの開始時に「📖 第一章（本編と同じ）」を選んだのに、ボス撃破後にレベル 4 へ上がった。

## 2. 調査（Analyzer）

### 2.1 報酬の経路（PR #101 の HEAD `cfe715b`）

| 経路 | 場所 | ルールの判定 |
| --- | --- | --- |
| ボス撃破の経験値 | `07-ai-combat.js` `grantXP(en.xp\|\|150)` | `grantXP` の先頭で `legacyGrowth()`。偽なら何もしない |
| 通常敵の経験値 | `07-ai-combat.js` `grantXP(en.xp\|\|10)` | 同上 |
| 撤退ボーナスの経験値 | `12-progression-ui.js` `grantXP(bonus.xp)` | 同上 |
| レベルアップ・成長ポイント（ダイス・スフィア +1・レベル成長） | `grantXP` の中だけ（`state.level++` はコード全体でここ 1 か所） | 同上 |
| 習得の証（初制覇） | `grantFirstClearRank` | `legacyGrowth()` |
| 固有装備（ボス・宝箱・ドロップ） | `showBossResultScreen`・`08-loot-equipment.js` | `legacyGrowth()` |

`legacyGrowth()` は `legacyGrowthEnabled(state.testMode, state.testRules)` で、`state.testRules` は `beginTestMode` が開始画面の選択から決める。他に書き換えるのは、タイトルへ戻る時（第一章ルールへ戻す）と結果画面の確認（描いた直後に戻す）だけ。

### 2.2 再現（PR #101 の HEAD）

第一章ルール・剣士・宵待ちの村「水鏡の跡」から、村の残響を実際に倒した（E2E、Debug Info に内部の値を出して確認）:

- 撃破前・撃破後とも **Lv 1 / 経験値 0**、結果画面は「🪙 ゴールド」だけ（経験値の行なし）

**PR #101 の HEAD では、報告された「ボス撃破でレベルが上がる」は再現しなかった。**

### 2.3 報告の事象の原因として最も考えられること

- GitHub Pages への公開は `main` への push だけ（`.github/workflows/deploy.yml`）。PR #101 は main に入っていない（main の HEAD は `0d33bdb`）
- main のテストモードは PR #101 の前の仕様で、**テストモードなら常に旧成長系が動く**（`legacyGrowthEnabled(testMode)`）。開始画面には「チャプター: 第一章」（TEST-CHAPTER-SELECT-001 のチャプターの選択）があり、PR #101 の「📖 第一章（本編と同じ）」と取り違えやすい
- main のテストモードでレベルを低くして（例: 1）ボスを倒すと、経験値でレベル 3〜4 に上がる（ボスの経験値 150〜で Lv 1→3、村の残響の経験値で Lv 4 に届く）

→ 実機で動いていたのは **main（PR #101 を含まない）の公開版** だった可能性が高い。ただし断定はできない:
- 報告の「📖 第一章（本編と同じ）」という文言は PR #101 にしか無い（main には無い）
- 村の残響の経験値は 260（`14-dungeon-duskvillage.js`）で、**Lv 1 + 260 = ちょうど Lv 4**（`applyXpGain`）。「旧成長の計算が Lv 1 から動いた」ことと一致する。これは (a) main の公開版でレベルを 1 にして倒した、(b) PR #101 で「🧪 旧成長システム」が選ばれたまま入った（開始画面の選択は、同じページでタイトルへ戻って入り直しても残る。選択中のカードは光って見える）、のどちらでも起きる
- PR #101 の HEAD で「📖 第一章」を選んで入った場合は、どの経路でもレベルは上がらない（§2.1・§2.2）

実機で確かめる時は、PR #101 の版で動かし、開始画面の要約が「📖 第一章ルール」になっていることを確かめる（§6）。

### 2.4 一方で、PR #101 の HEAD で見つかった内部の状態の不備（今回直したもの）

報告の事象とは別に、「旧成長システム由来の値が現行ルールに混ざらない」という要件に対して、次の不備があった:

1. **第一章ルールでも、旧成長用のデバッグの値で入っていた**: `beginTestMode` がルールに関係なく `spherePoints = 999`、派生スキル（Skill 1 / Skill 2 / 必殺技の別型）の全解放を入れていた。第一章ルールでは画面に出ず効きもしない（`legacyGrowth()` が偽）が、内部の状態は本編の第一章と違っていた
2. **振り分け（ダイスの合計・配分）を持ち越していた**: `beginTestMode` は `diceTotal` / `allocPoints` を戻していなかった。通常のセーブを読んだ後や、旧成長ルールでレベルを上げた後にテストモードへ入り直すと、前の値が残った（旧成長ルールではステータスに乗る）

## 3. 修正（Planner / Implementer）

| 場所 | 内容 |
| --- | --- |
| `core/test-debug.js` | `testModeGrowthState(testRules, level)`: 入る時の成長の状態をルールで決める（第一章: Lv 1・経験値 0・スフィア 0・派生は未解放・習得の証 0、旧成長: 指定のレベル・スフィア 999・派生は全解放。どちらもダイスの合計 12）。`applyXpGain(state, amount, legacy)`: 経験値の計算（旧成長でなければ何も変えない）。`xpToNextForLevel` を同じ場所へ |
| `14-hud-boot.js beginTestMode` | 上の状態で入る。振り分け（`diceTotal` / `allocPoints` / `allocDraft`）を初期値へ戻す |
| `12-progression-ui.js grantXP` | `legacyGrowth()` が偽なら何もしない（今まで通り）。計算は `applyXpGain`。レベルアップの副作用（音・ダイス・スフィア +1・レベル成長・転身の確認）は今まで通り |
| `14-training-ground.js` Debug Info | 見出しに `Growth: Lv / XP / SP（スフィアのポイント）/ Ranks（習得の証）/ Dice（ダイスの合計）/ Alloc（配分の合計）` を出す（HUD ではなく内部の値を確かめるため。テストモードだけ） |

HUD の表示は変えていない（隠すだけの修正はしていない）。通常プレイ・セーブの形式は変わらない。旧成長ルールで変わったのは 1 点だけ: 通常のセーブを読んだ後にテストモードへ入っても、振り分け（ダイスの合計・配分）を持ち越さず、未使用 12 から始まる（以前はセーブの値が残り、ステータスに乗っていた）。それ以外の旧成長ルールの挙動（レベル指定・スフィア 999・派生の全解放・経験値とレベルアップ）は変わらない

## 4. テスト（Tester）

- `npm run build` 成功
- `npm run test:unit`: 2045 件（pass 2044 / fail 0 / skip 1 は既存）
  - 新規（`tests/unit/test-mode-current.test.js`）: 第一章ルールで経験値の付与が何も変えない（ボス・通常敵の量）／旧成長ルールで従来の式どおりにレベルが上がる（Lv 1 に 210 で Lv 4）／入る時の状態がルールで決まる（第一章: Lv 1・スフィア 0・派生なし）／レベル・経験値・習得の証を増やす所はコード全体で `grantXP` / `grantFirstClearRank` だけで、どちらも `legacyGrowth()` の後／`beginTestMode` が 999・全解放を直接入れず、振り分けを戻す
- E2E（`tests/testmode-current.spec.js`、9 件 pass）
  - **第一章ルール: 村の残響を倒しても、内部の Lv 1・XP 0・SP 0・Ranks 0 のまま**。結果画面に経験値の行なし、HUD に Lv なし
  - **旧成長ルール（Lv 1）: 同じボスを倒すと Lv が上がり、スフィアのポイントとダイスが上がった分だけ増え、初制覇で習得の証 +1**。結果画面に経験値の行。**そのあとタイトルへ戻って第一章ルールで入り直すと Lv 1・XP 0・SP 0・Ranks 0・Dice 12・Alloc 0**（実際に育った値が残らない）
  - **ルールの切り替え: 旧成長 Lv 20 → タイトル → 第一章（Lv 1・SP 0）→ タイトル → 旧成長 Lv 5（SP 999）**。前のルールの値が残らない
- 回帰の抜き取り（road・job-traits・chapter1-old-save-growth・chapter1-legacy-ui・chapter1-smith-shop・smith-gear-layout・dialog-result-layout・save-load・chapter1-progression・chapter1-tower-to-road・combat-test-arena・execution-break・production-build・pwa-test-entry・scenario-test-mode・chapter-select-testmode・action-zone・battle-knight-visual・dusk-boss-clone-check・mansion-butler、2 並列）: 96 件 pass。`job-traits` のタイミング依存の 1 件が 2 並列の負荷で落ち（このテストは以前から自前の retry を持つ）、単独（1 並列）で再実行して 1 回目で pass
- E2E の手順の修正（テストの側）: ボス戦の台詞が Arena のボタンを覆う時は送ってから開く／開始画面は前のシナリオを覚えているので、入り直す時にトレーニング空間を選び直す

## 5. 独立レビュー（Reviewer）

- Round 1: **PASS**（BLOCKER / MAJOR 0）。MINOR-1 原因の断定を避ける（Lv 1 + 260 = Lv 4 の一致、PR では「🧪」が選ばれたままの可能性も）→ 直した／MINOR-2 ユニットの守りを全部品・ダイス・スフィアへ広げる → 直した／MINOR-3 振り分けの持ち越しと実際に育った後の残留を E2E で確かめる → Debug Info に Dice・Alloc、E2E を追加／MINOR-4 旧成長ルールで変わった 1 点を書く → 直した／NIT コメント → 直した。NIT-3（経験値の計算が test-debug.js にある）・NIT-4（12 の重複）は範囲外として残す
- Round 2: **PASS**（指摘はすべて直っている。新しい指摘なし。NIT-3・NIT-4 は範囲外のまま）

## 6. iPhone 実機で再確認すること

**PR #101 の版で動かすこと**（GitHub Pages の公開版は main なので、PR #101 を含まない）。merge 前に確かめる場合は、PR のブランチを手元で `npm run build` → 配信するなど、PR の版を開く。

1. テストモードの開始画面で「📖 第一章（本編と同じ）」が選ばれている（「チャプター: 第一章」とは別の欄）。要約に「📖 第一章ルール」
2. 宵待ちの村 → 水鏡の跡で入り、Arena の「🔍 Debug Info」の `Growth:` が `Lv 1 XP 0 SP 0 Ranks 0`
3. ボスを倒しても `Growth:` が変わらない。結果画面に経験値の行が無い。HUD にレベルが出ない
4. 「🧪 旧成長システム」で同じことをすると、経験値が入ってレベルが上がる
