# UI-002-H Analysis — Dialog / Notification / Result UI

| 項目 | 値 |
| --- | --- |
| Task | UI-002-H（Status: DRAFT。本 report は Analyzer。承認欄・Status は変更していない） |
| 基準 | `main` `121b940`（PR #68 / UI-002-F の merge 後） |
| ブランチ | `claude/ui-002-h-analysis`（`main` から作成。未 commit・未 push） |
| 日付 | 2026-10-10 |
| 撮影 | Playwright Chromium 141（SwiftShader）、`deviceScaleFactor: 1`、1280×800（PC）/ 844×390（`hasTouch`）。画像は scratchpad（commit しない） |

FACT = コード・テスト・画面で確認 / INFERENCE = 推定 / DECISION = Human の判断が必要。

## 0. 資料の所在（FACT）

| 資料 | 状態 |
| --- | --- |
| `.ai/AGENTS.md`、`.ai/tasks/UI-002-{H,V,C2,D,E,F}.md`、`.ai/decisions/UI-002-human-decisions.md`、`.ai/reports/UI-002-F-{analysis,plan,impl-report}.md` | `main` にある |
| `.ai/reports/UI-001-analysis.md` | **`main` に無い**。Task の References どおり `origin/claude/ui-001-analysis-380kl5` で読んだ |
| `.ai/reports/UI-002-plan.md` | **`main` に無い**。`origin/claude/ui-002-planner` で読んだ |
| `.ai/reports/UI-002-D-D5-analysis.md`、`.ai/tasks/UI-002-D.md`「WI-D5 計画」 | `main` にある。**通知の表示先は D5 で既に整理済み**（§3） |

## 1. 結論（要約）

- 対象は 6 系統: ①会話（`#dialogue-overlay`）②中央トースト（`.item-pop`、`spawnToast`）③左下ログ（`#msg-log`、`spawnLog`）④結果（`#clear-overlay`）⑤戦闘不能（`#down-overlay`）⑥確認（`#confirm-overlay`）。ほかに拾得ポップ・ダメージ数値（D で整理済み）、Arena の記録（テストモード専用）。
- **通知の「1 系統化」は UI-002-D WI-D5 で別の形で既に決着している**: HD-D17（Human）により「種類ごとに 1 つの表示先」へ統合済み（中央トースト = 戦闘・入力拒否・時間・出現・節目・切り替え / 左下ログ = 獲得・物語・システム）。重複は 0（E2E `notifications`）。H で残るのは **見た目と重なり・寿命** の整理（§3）。
- 見た目は 6 系統とも F 以前の言語のまま: 紫寄りのグラデーションの面・1px の線・**背景ぼかし**（会話以外の 3 つのオーバーレイ）・オレンジのグラデーションの pill ボタン・発光の文字影。F のプレート（単色の面・3px の輪郭・2px の内縁・落ち影 1 種）と不一致。
- Chapter 1 の結果画面は成長要素を出していない（FACT: `legacyGrowth()` で XP・固有装備・3 択報酬・ステ振り・討伐回数・難易度・分岐踏破・初制覇を出し分け）。**H で表示条件を変える必要は無い**。
- テストの空白: **結果画面・戦闘不能画面を実際に表示する E2E が無い**（`#clear-overlay` は「出ない」確認だけ、`#down-return-btn` はボタンを直接 click するだけ）。

## 2. 画面ごとの現状

### 2-1. 会話（`#dialogue-overlay`）— 撮影済み（両サイズ、新規ゲームの酒場の導入）

| 項目 | FACT |
| --- | --- |
| DOM | `index.html` `#dialogue-overlay > .dialogue-box > #dialogue-name / #dialogue-text / .dialogue-next`（「クリックして続ける」） |
| 表示 | `classList.add('active')` を 17 か所以上から直接（`12-progression-ui.js` startScenarioTavernDialogue / startBossDialogue / bossEnding、`02-world-common.js` cutsceneLine / readLore ほか、`03`）。`state.activeOverlay` の管理外 |
| 進め方 | オーバーレイのクリック（`12:1372` `advanceDialogue`）、パッド A（選択肢の無い会話は `gpNavContext()` が null → advance）。キーボードで送るキーは無い（会話中は keydown が先頭で return する。`09-save-load.js:315`） |
| CSS | `main.css` 1100〜1116: 下寄せ（`padding-bottom:8vh`）、幅 `min(640px,92vw)`、半透明のグラデーション、1px の線、角丸 8px。名前 13px（Cinzel・ember）、本文 14.5px、案内 11px ＋ `▼` が **常時バウンス**（`dialogueBounce` 1s infinite）。ぼかしなし（背景 0.35 の暗幕） |
| 計測 | 1280×800: 640×143 @ (320,593)。844×390: 640×143 @ (102,216) ―― **844×390 では画面の下 45% を覆い、スティック・行動ボタンの一部に重なる**（会話中は入力が止まるので操作上の問題は無い。INFERENCE） |
| 話者 | 名前の文字だけ（肖像なし。肖像の仕組みは存在しない ―― 新設は未実装機能） |
| 入力案内 | 「クリックして続ける」固定。タッチ・パッドでも同じ文言（FACT） |
| テスト | `#dialogue-name` / `#dialogue-text` / `#dialogue-overlay` を 18 spec が参照（tower-to-road・road・shadow-guide・duskvillage・tavern-smith-greeting ほか）。`ui-foundation` が `.dialogue-box` の影・角丸を固定 |

### 2-2. 中央トースト（`spawnToast`）— DOM で確認（「🧪薬草を持っていない……」15px）。画像には写らず

| 項目 | FACT |
| --- | --- |
| 実装 | `11-combat-actions.js:2240` `.item-pop` を `#hud` に追加、`left:50%`、`top:calc(30% - i×25px)` で積む（`layoutToasts`）、**要素の寿命 1.7 秒** |
| CSS | `.item-pop`（`main.css:775`）: 13px（JS で 15px に上書き）、Noto Serif JP 太字、`text-shadow:0 0 6px`（発光ぎみの影）、**アニメーション `itemfloat` 1.1 秒で opacity 0 まで消える**（`forwards`） |
| 不一致 | **見えている時間は約 1.1 秒、要素は 1.7 秒残る**（アニメーションと寿命が別の値）。D5 は「1.7 秒で十分」と記録しているが、実際の可視時間は 1.1 秒（INFERENCE: 意図より短い） |
| 共有 | `.item-pop` は拾得ポップ（`spawnPickupPopup`、1.15 秒、拾った位置）と共有 |
| 呼び出し | `spawnToast(` 120 か所（12 ファイル） |
| z | `#hud`（16）の中。会話（35）・結果（35）・メニュー（30）の下になる |
| テスト | `watchNotifications`（MutationObserver）で文言を記録: `notifications`・`chapter1-dusk-basics`・`character-weapon-visual`・`dev-ui-gate`・`mansion-scenario` ほか |

### 2-3. 左下ログ（`spawnLog` → `pushMsgLog`）— 撮影済み（「💾 セーブしました」）

| 項目 | FACT |
| --- | --- |
| 実装 | `#msg-log`（初回に生成）、最大 6 行、1 行 6.5 秒（`msgLogFade` で最後の 18% にフェード） |
| CSS | `main.css:795〜812`: 11.5px、`rgba(12,10,16,0.6)` の半透明 pill、1px の線、角丸 10px |
| 844×390 | D6 で **スティックの上**（`bottom:calc(46% + 6px)`）へ移動・最新 3 行だけ（`main.css:951`）。撮影: (12,180) 122×25、スティック top 211 → 重ならない |
| 呼び出し | `spawnLog(` 74 か所（10 ファイル） |
| テスト | `#msg-log` を 12 spec が参照 |

### 2-4. 結果（`#clear-overlay`）— **実画面では未確認**。静的な枠だけ撮影（SIMULATED）

| 項目 | FACT |
| --- | --- |
| 表示 | `showBossResultScreen(boss, levelBefore)`（`12:1057`）。ボス撃破 → 一拍（洋館の再会・村の夜明け等の演出、または `#canvas-wrap.victory-blur` を一定時間）→ 表示 |
| 中身（本編） | 「VICTORY」、`#clear-desc`（ボスごとの文）、`#result-loot` に **ゴールド＋そのボスの品（素材以外）だけ**。ボタンは「街に戻る」または「探索を続ける」（`boss.endsRun === false`）/「……!?」（`afterDefeat`） |
| 中身（テストモード） | ＋経験値・Lv 上昇・固有装備（未鑑定）・討伐回数・初制覇（習得の証）・難易度★・分岐踏破・3 択報酬（`#boss-choice-panel`）・ステ振り（`#result-stat-panel`） |
| Chapter 1 の判定 | `legacy = legacyGrowth()` と `noReturn = isMainlineScenario()` で行ごとに出し分け。初制覇は `grantFirstClearRank()` 自体が本編で false（`12:2132`） |
| CSS | `.event-overlay`（**`backdrop-filter:blur(3px)`**）、`.event-box`（440px、共通のグラデーションのパネル、中央揃え）、`.event-title` 24px ember、`.result-loot-row` 12.5px の点線区切り、`.event-btn` **オレンジのグラデーションの pill（角丸 20px）**。`#clear-overlay .event-box` に inline style（max-height / overflow） |
| 世界のぼかし | `#canvas-wrap.victory-blur{ filter:blur(9px) saturate(1.5) brightness(1.15) }`（撃破直後の一拍。洋館・村は別演出でこれを使わない） |
| 計測（SIMULATED） | 844×390: 440×290 @ (202,50)、ボタン 119×44。1280×800: 440×290 |
| テストモード専用部品 | `.boss-choice-desc` **8.5px**、`.boss-choice-name` 10px（読めない大きさ。本編には出ない） |
| テスト | 表示する E2E は **無い**。`duskvillage` は「出ない」こと、`ui-foundation` は `#clear-overlay .event-box` と `#clear-overlay` のぼかしを固定（F で追加） |

### 2-5. 戦闘不能（`#down-overlay`）— **実画面では未確認**。静的な枠だけ撮影（SIMULATED）

| 項目 | FACT |
| --- | --- |
| 表示 | `triggerPlayerDown()`（`12:1180`）。**テストモードでは出ない**（HP 1 で踏み止まり、Arena の記録に「TEST MODE — HP1で生存」） |
| 中身 | 「力尽きた……」（**inline style `color:#c9576a`**）、固定文 2 行、`#down-penalty-line`（所持金を🪙n失った……、inline style `color:#e0a04a`）、「街に戻る」 |
| 挙動 | 所持金の 30% を失う、ボスを初期化、`returnToTown(true)`（進行は戻らない ―― E2E `chapter1-progression`「死亡しても進行は戻らず」がボタンを直接 click して確認） |
| テスト | 画面の表示を見る E2E は **無い** |

### 2-6. 確認（`#confirm-overlay`）— 撮影済み（タイトルへ戻る）

| 項目 | FACT |
| --- | --- |
| 表示 | `askConfirm(title, text, onYes, {okLabel, cancelLabel})`（`12:2565`）。呼び出し: はじめる（上書き）・タイトルへ・撤退・まとめて売却 ほか。`#confirm-text` は **innerHTML**（呼び出し側が `<br>`・`<b>` を渡す） |
| CSS | `main.css:362〜388`: **`backdrop-filter:blur(2px)`**、`#confirm-box` グラデーション＋ember の線、角丸 12px。OK = **明るい金のグラデーション**、ghost = 半透明の白 |
| z | 120（最前面。メニューの上に出る） |
| パッド | B でキャンセル（`gpNavCancel`） |
| 計測 | 844×390: 380×181、OK 162×42 |
| テスト | `#confirm-ok` を `save-load`・`mansion-scenario`・`combat-hud-display-conditions` が click。`ui-foundation` が `#confirm-box` の影を固定 |

## 3. 通知の現状（経路・用途・優先順位・寿命）

| 経路 | 用途（D5 の表） | 位置 | 寿命 | 重なり | 呼び出し |
| --- | --- | --- | --- | --- | --- |
| 中央トースト `spawnToast` | (a) 戦闘・危険 (b) 入力拒否 (c) 時間 (d) 出現 (e) 節目 (f) 切り替え | 中央 30% から上へ 25px ずつ | 要素 1.7 秒 / **見えるのは約 1.1 秒** | 上限なし（積むだけ）。`#hud` 内（z 16）で会話・結果の下 | 120 |
| 左下ログ `spawnLog` | (g) 獲得 (h) 物語 (i) システム | 左下（844×390 はスティックの上） | 6.5 秒 | 最大 6 行（844×390 は 3 行表示） | 74 |
| 拾得ポップ | 拾った物 | 拾った位置の上 | 1.15 秒 | — | — |
| ダメージ数値 `.dmg-pop` | ダメージ | 対象の上 | 0.82 秒 | プール 40 | — |
| Arena の記録 | テストモードの診断 | Arena パネル | 2.2 秒＋0.5 | 6 行 | テストモードのみ |
| 処刑・インタラクト・コンボ・PC ヒント | 操作の案内 | D6 / D3 で配置済み | 条件 | D の範囲 | — |

- FACT: 優先順位（重要度）を表す仕組みは無い。色は呼び出し側が直書き（`spawnToast(text, '#ffd27a')` 等）。
- FACT: 通知履歴は無い（Decision record の Undecided。D5 A-4 でも作らないと記録）。
- INFERENCE: 中央トーストが積み上がる上限が無く、連続（例: 技名＋節目＋入力拒否）で 4 段以上になると画面上部へ伸びる。

## 4. 世界観（V-1〜V-7・F）との不一致

| # | 箇所 | 現状 | 不一致 | 重さ |
| --- | --- | --- | --- | --- |
| H-1 | 結果・戦闘不能・確認の背景 | `backdrop-filter: blur(3px / 2px)` | V-2（blur 禁止）、F-D2 | **大** |
| H-2 | 4 つのパネル | グラデーションの面・1px の線・角丸 6〜12px がばらばら | F のプレート（単色・3px 輪郭・2px 内縁・8px） | **大** |
| H-3 | ボタン | `.event-btn` = オレンジのグラデーションの pill（20px）、`.confirm-btn` = 金のグラデーション | F のプレートボタン（36px 以上・単色・輪郭） | 中 |
| H-4 | トースト | 文字だけ＋`text-shadow:0 0 6px`（発光ぎみ）。重要度は色の直書きだけ | V-6（色だけにしない）、V-2（glow） | 中 |
| H-5 | ログ | 半透明の pill（0.6）、1px の線 | V-2（excessive transparency）。F の面と違う | 小 |
| H-6 | 会話の `▼` | 常時バウンス | V-6（常時の動き。点滅・発光ではないが常時アニメ） | 小 |
| H-7 | 世界のぼかし | `#canvas-wrap.victory-blur` 9px | V-2 の blur（ただし UI の面ではなく世界の演出） | DECISION |
| H-8 | インライン style | `#down-overlay` の見出し・罰金行の色、`#clear-overlay .event-box` | token を経ない色 | 小 |
| H-9 | テストモード専用 | 3 択報酬 8.5〜10px | F-D3 の下限（11px）。ただし本編には出ない | 小 |

**維持すべきもの**: 会話が下寄せで世界を隠さない配置、話者名の ember、結果の中央配置、確認が最前面（z 120）、戦闘不能の赤系の見出し、D5 の表示先の分け方、D6 のログ位置。

## 5. 重なり・優先順位（z-index、FACT）

`#hud`（トースト・ログ・ダメージ）16 / ログ 21 / フラッシュ 25 / メニュー 30 / 会話 35 = 結果・戦闘不能・鍛冶屋・出撃 35 / 暗転 60 / 確認 120。
- 会話と結果は同じ 35。同時には出ない（結果 → 「街に戻る」で結果を閉じてから会話 `bossEnding`）。戦闘不能は `dialogueActive` を立て、会話中は `triggerPlayerDown` が何もしない（`12:1191`）。
- 状態管理は二系統（UI-001 O と同じ）: menu / appraisal / scenario は `state.activeOverlay`、dialogue / clear / down / confirm は DOM の `active` class。**H で統合はしない**（ロジックの変更になる）。

## 6. UI-002-F の影響

- `#appraisal-overlay` / `#menu-overlay` に限定した CSS（F-D8）は H の画面に及んでいない（`ui-foundation` が `#clear-overlay` のぼかし・`.event-box` を固定）。
- `.gp-focused`（F で発光をやめ 3px の金の輪郭）は全画面共通 → 結果・戦闘不能・確認のボタンにも既に効いている（FACT: CSS）。
- `.event-btn` は **出撃画面の「出撃する」（`.scenario-sortie-btn`、UI-002-G の範囲）と共有**。`.appraisal-box` 系と同様、H では id で絞る必要がある。

## 7. Chapter 1 / Test Mode の差（FACT）

| 画面 | 本編 | テストモード |
| --- | --- | --- |
| 結果 | ゴールド＋品のみ | XP・装備・討伐・初制覇・★・分岐・3 択・ステ振り |
| 戦闘不能 | 出る（罰金 30%） | 出ない（HP 1） |
| トースト | 同じ（呼び出し側で本編に無いもの〔スキル3 等〕は出ない ―― E2E `chapter1-legacy-ui`） | ＋デバッグ等 |
| Arena の記録 | 無い | ある |

## 8. 確認できなかったもの・環境の制約

- **結果・戦闘不能の実画面**: ボスを倒す・HP を 0 にする操作はこの環境（3〜7fps）では現実的でない。静的な枠を `active` にして撮影しただけ（中身は本編の行を模した SIMULATED）。表示順・演出からの遷移・ボタンの切り替え（探索を続ける / ……!?）は未確認
- **中央トーストの画像**: DOM では記録（文言・15px・位置）したが、スクリーンショットのタイミングでは写らなかった
- 書体: Google Fonts が読めず代替フォント
- 実機（iPhone / パッド）: 未確認

## 9. 既存テストへの影響の見込み

| 参照 | spec | H で変えるなら |
| --- | --- | --- |
| `#dialogue-overlay` / `#dialogue-name` / `#dialogue-text` | 18 spec | id・文言・クリックで進む動きを変えなければ影響なし |
| `#msg-log` / `.item-pop` / `watchNotifications` | 17 spec | 表示先・文言・`.item-pop` の class を変えなければ影響なし |
| `#confirm-ok` | 3 spec | id を変えなければ影響なし |
| `#down-return-btn` | `chapter1-progression` | 同上 |
| computed style の固定 | `ui-foundation`（`.dialogue-box`・`#confirm-box`・`#clear-overlay .event-box`・`#clear-overlay` のぼかし） | **期待値の更新が必要**（許可された範囲だけ） |

## 10. Autonomy Metrics（Analyzer、実測）
- Human Escalation Count: 0 / Human Decision Count: 0
- Auto Fix Count: 0 / Reviewer Rounds: 0
- Test Retries: 0（撮影用の一時 spec を 2 本実行。1 本目で会話・トーストが撮れなかったので、別の手順の 2 本目を追加した。どちらも PASS）
