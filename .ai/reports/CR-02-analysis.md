# CR-02 Analysis — 道の導入（正体不明の人物 → 影の旅人）

Analyzer。根拠は実コード（`claude/cr-02-road-shadow-intro` = PR #61、#60 の上）・`.ai/decisions/DEC-004-chapter1-story.md`・`docs/CHAPTER1_STORY.md` §3 / §4-5 / §4-6・`docs/CHARACTERS.md`。

## 0. 前提の確認（重要）

| 前提 | 実際の状態 |
| --- | --- |
| #50〜#59 が main へ merge 済み | **#50（CG-02）と #59（TF-01）だけが main にある。** #51〜#58 は積み上げた PR だったため、それぞれ一つ前の PR のブランチへ merge された（GitHub 上の表示は "merged" だが、base が main ではない） |
| CT-03 の島の人影 | CT-03 は**地の文だけ**（「対岸の街道を、誰かが一人で歩いていく。足元の影が、本人より少しだけ遅れてついていく」）。グラフィックは CR-02 の範囲として残していた |
| 対応 | **PR #60** が #51〜#58 の内容をそのまま main へ載せる（新しい変更なし、衝突なし）。**PR #61** は CR-02 の初回実装（下記 §5 の大部分）で、#60 の上に作ってある |

→ **Human: #60 → #61 の順で merge が必要**（判断事項ではない。§13 参照）。

## 1. 現状（シナリオ上の現在位置）

```
時計塔 5F（時喰らい）→ 崩壊 → 見晴台 → 跳躍（CT-03）→ 名も無い島（CT-03 地の文 / CR-02 #61 遠景）
  → 酒場（翌朝。CT-03: 朝の鐘・時計を返す・管理人生還）→ 道へ出撃
  → 道標 → 戦闘1 → 小川の橋（持ち主のいない影）→ 休憩所（出会い）
  → 「……私が行きます」→ 交代（roadHandOff = 正式加入）→ 戦闘2 → 丘 → 酒場（第一章の最後）
```

## 2. 関連ファイルと既存実装

| # | 調査項目 | 場所 | 実装の事実 |
| --- | --- | --- | --- |
| 1 | 道の実装 | `src/legacy/parts/14-dungeon-road.js` | `buildRoad`・`playRoadSignpost` / `playRoadGlimpse` / `playRoadMeeting` / `roadHandOff` / `playRoadEnding` / `finishRoad` / `playChapter1Finale`。ボスなし、敵は既存の獣（`PROVISIONAL_ROAD_*`） |
| 2 | 道への遷移 | `12-progression-ui.js` `startScenarioTavernDialogue` / `SCENARIO_TAVERN_DIALOGUE.road`、`core/chapter1-progress.js` `nextScenario` / `mainlineAvailable` | 時計塔クリアで道だけが出撃先になる（一本道）。出撃時のカメラは北向き（`camYaw = π`） |
| 3 | 時計塔クリア後の酒場 | `03` `setLookout(...onSea)` → `towerEscape` → `returnToTown(false)`、`12` `SCENARIO_TAVERN_DIALOGUE.road`（CT-03 で本編に3行）、`03` `shadowGuideSeated()` = `!scenarioClears('clocktower')` | 時計塔を終えると隅の席が空き、`buildChapter1TavernTrace`（飲みかけの杯・隅の卓）が出る |
| 4 | 「？？？」に当たる既存の人物 | 酒場: `03` `shadowGuide` グループ（`SHADOW_GUIDE_POS`）+ `12` `talkToShadowGuide`。道: `14-dungeon-road` `roadTraveler`（`buildRoadTravelerFigure`）。橋: `spawnApparition` | **main では話者名が「影の旅人」**（`SHADOW_GUIDE_NAME`、道の `ROAD_TRAVELER`）。#61 で「？？？」へ |
| 5 | 影の旅人のデータ | `01` `CLASSES.wanderer`（`kit:'warrior'`, `hidden:true`, 名前・色・基礎ステータス・必殺技「影送り」）、`CHAPTER_CAST[5]`（`guestClassKey:'rogue'`） | 職業ではない。戦闘の骨格は剣士の kit を借りる |
| 6 | モデル生成 | `06` `buildPlayer(classDef, gender)`。`recomputeStats`（`12`）が `{key: kitKey, charKey:'wanderer'}` を作る。`06` は `charKey==='wanderer'` で肌・髪・コート・パンツ・マフラーを分け、**武器を非表示**（`weapon.visible = false`）。配色は `render/player-palette.js` の wanderer 行 | 加入後の正式モデルは**実装済み**（CHARACTER-VIS-001） |
| 7 | 加入の登録 | `14-hud-boot.js` `meetChapter1Protagonist(stage)` → `castAfterMeeting` → `switchProtagonist(cast, true)`（`applyChapterCast`・`recomputeStats`・`buildPlayer`）→ 支援AIを組み直す | 道の出会いの中で一度だけ。新しい進行状態は持たない |
| 8 | 話者名 | `renderDialogueLine`（`12`、`dialogue-name`）、`cutsceneLine(text, name)`（`02`）。HUD の名前は `12` `refreshHudName`（`#hud-name`、`state.classDef.name` ｜ 支援名） | 話者名は台詞データ側の `name` で決まる。人物の内部状態とは結びついていない |
| 9 | 支援AI | `state.guestClassKey` + `syncAlliesToState()`（`08`）。`CHAPTER_CAST[5].guestClassKey = 'rogue'` | 交代で盗賊が支援、弓師は休憩所に残る（`roadArcherStay`） |
| 10 | キャラクター切替 | `advanceChapter1Cast`（酒場へ戻った時）/ `meetChapter1Protagonist`（道の出会い）。どちらも `switchProtagonist` | 同じ一つの仕組み |
| 11 | save/load | `09-save-load.js`: `selectedClass` 等を保存。キャストは `scenarioClears` から毎回導く（`core/chapter1-progress.js` `MET_INSIDE = ['road']`） | 道の途中（加入後）でセーブ → ロードすると、道を終えていないので盗賊＋弓師に戻る（`advanceChapter1Cast({rebuild:false})`、既存仕様「撤退・全滅したら道を最初から」）。**新しいセーブ項目は不要** |
| 12 | docs/CHARACTERS.md | §5人目 | main: 「名称は『影の旅人』」。#61 で「加入後の呼び名」を明記。素手の演出は「未実装」と記載 |
| 13 | docs/CHAPTER1_STORY.md | §3 / §4-5 / §4-6 / §6 N-4 | 加入前は「？？？」、交代の瞬間に開示、と既に確定（DEC-004） |
| 14 | 道の unit / E2E | `tests/road.spec.js`（テストモードで休憩所の手前から）、`tests/shadow-guide.spec.js`、`tests/unit/chapter1-progress.test.js`、#61 の `tests/unit/road-stranger.test.js` | main の E2E は話者名「影の旅人」を期待している（DEC-004 で更新すると決定済み） |
| 15 | CT-03 の島の人物 | `03` `CLOCKTOWER_CHAPTER1_ISLAND`（地の文、話者名なし）。#61 で `showIslandStranger`（対岸の崖の上の街道を歩く遠景、`buildRoadTravelerFigure`） | 同じ見た目の部品を使う |
| 16 | 時計塔→道のテスト | `tests/chapter1-progression.spec.js`（時計塔クリア後に道が次 / 道を終えると影の旅人＋盗賊、`selectedClass === 'wanderer'`）、`tests/unit/clocktower-finale.test.js`（島の行に名前が無い） | 島の着地から道の出会いまでを通す E2E は無い（時計塔の通しは数十分かかる。CT-05 で Human 実機確認） |

## 3. 「同一人物」の扱い（重要原則との照合）

- **「？？？」と「影の旅人」は別キャラクターではない。** キャラクターとしての定義は `CLASSES.wanderer` / `CHAPTER_CAST[5]` の一つだけ。加入前に別のクラス・別の NPC 定義・別のセーブ項目は存在しない（#61 でも作っていない）。
- 加入前に出てくるのは「その人物の姿（演出用のメッシュ）」と「台詞の話者名」だけ。どちらも同じ部品で作る:
  - 姿: `buildRoadTravelerFigure`（酒場の隅の `shadowGuide` と同じ作り・同じ配色）を、島・休憩所で共有。
  - 話者名: 加入前の場面の台詞はすべて「？？？」、加入後は `CLASSES.wanderer.name`（= 影の旅人）。
- 正体判明（名前の開示）＝正式加入＝主人公の交代は**同じ瞬間**（`roadHandOff` → `meetChapter1Protagonist`）。DEC-004「正式加入時に…初めて『影の旅人』の名称を開示」と一致。**既存設計との矛盾は無い。**

## 4. 正体判明の箇所（特定）

`playRoadMeeting` の最後、「……私が行きます」→ 弓師「来た道は、私が見ています」→ `fadeTransition(roadHandOff)`。
フェードの間に `meetChapter1Protagonist` が走り、以下が同時に切り替わる:

| 表示 | 加入前 | 加入後（roadHandOff 以降） |
| --- | --- | --- |
| 話者名 | 「？？？」 | 「影の旅人」（丘・最後の酒場） |
| HUD の名前 | 盗賊 ｜ 支援: 弓師 | 影の旅人 ｜ 支援: 盗賊 |
| ログ | ― | `◐ 影の旅人`（spawnLog） |
| 姿 | `buildRoadTravelerFigure`（演出用メッシュ） | 操作キャラクターのリグ（`buildPlayer`、wanderer） |
| キャラクター情報 | なし（`CLASSES.wanderer` は `hidden`） | `state.classDef`（名前・説明・ステータス） |

他の UI（メニューの名前、テストモードの一覧）に加入前の名前が出る経路は無い（`hidden:true` でテストモードの一覧から除外済み、メニューは `state.classDef`）。

## 5. 再利用できる仕組み / 不足している実装

| 項目 | main | #61 | 残り |
| --- | --- | --- | --- |
| 加入前の話者名「？？？」（酒場の隅） | ✗（影の旅人） | ✓ 本編のみ（テストモードは従来表示） | ― |
| 加入前の話者名「？？？」（道） | ✗ | ✓（`ROAD_STRANGER`） | ― |
| 加入時の開示（HUD・話者名・ログ） | ✓（仕組みは既存） | ✓（加入前に出ないことをテストで確認） | ― |
| 加入前の姿（遠景／簡易モデル、武器なし） | ✓ 道の長椅子のみ | ✓ 島の遠景・休憩所で同じ部品 | ― |
| 影が遅れて動く | ✗（「影のほうが先に動く」演出のみ） | ✓（`trackPreJoinShadow`） | ― |
| 島 → 道の接続（同一人物と分かる） | ✗（地の文のみ） | ✓ 島の遠景・橋で弓師「……島から見えた人です」・休憩所で「朝の鐘で出てったんだろ」「……鳴ったので」 | ― |
| 加入後の正式モデル（武器なし） | ✓（見た目だけ武器を非表示） | 変更なし | ― |
| **加入後の「素手」の攻撃モーション** | ✗ 剣士の kit のまま（大剣の振りを、武器を消して行う） | 変更なし | **Human Decision（§9 HD-CR02-1）** |
| **加入後の「影を利用した攻撃表現」** | ✗ 通常攻撃の色は剣士の赤（`atkColorHex` を kit から継承）。必殺技「影送り」だけ紫 | 変更なし | **Human Decision（§9 HD-CR02-1）** |
| 影の旅人の Skill 1 / Skill 2 | 剣士の kit のもの（暫定） | 変更なし | 未決定。**今回は決めない**（指示どおり） |
| docs | ✗ | ✓ CHARACTERS.md（加入後の呼び名） | CHAPTER1_STORY §7 の CR-02 欄に実装位置を追記 |

## 6. モデル切替の方法

既存の `switchProtagonist(cast, true)` だけを使う（`scene.remove(player)` → `buildPlayer(state.classDef, gender)`）。加入前の演出用メッシュは `roadHandOff` で `scene.remove`。新しい切替の仕組みは作らない。

## 7. 話者名切替の方法

台詞データの `name` を場面ごとに決める既存の作法のまま。加入前の場面は `ROAD_STRANGER = '？？？'` / `shadowGuideSpeaker()`、加入後の場面は `ROAD_TRAVELER`（= `CLASSES.wanderer.name`）。人物の状態フラグは増やさない（加入前・後は「どの場面か」で一意に決まるため）。

## 8. save/load への影響

なし。加入は `scenarioClears` と道の中の一幕から導かれ、セーブ項目は増えない。道の途中でロード・撤退・全滅すれば盗賊＋弓師に戻り、休憩所でもう一度「？？？」として出会う（既存仕様）。

## 9. Human Decision

### HD-CR02-1 加入後の攻撃表現（素手・影を利用した攻撃）

今回の指示に「加入後: 素手 / 影を利用した攻撃表現」がある。現状は「見た目だけ武器を非表示、攻撃処理・判定・モーションは剣士の kit のまま（素手の演出は未実装）」（docs/CHARACTERS.md、CHARACTER-VIS-001 HDR-T4-10）。素手のモーションや影の攻撃の見せ方は、影の旅人の戦闘スタイル（未決定）の一部なので、Agent では決めない。

| 案 | 内容 | 影響 |
| --- | --- | --- |
| **a（推奨）** | CR-02 では**色だけ**影にする: 影の旅人の通常攻撃・Skill の斬撃エフェクトの色を、必殺技「影送り」と同じ影の紫（`0x8a5ad6`）にする（`CLASSES.wanderer.atkColorHex` の1行）。モーション・判定・数値・Skill は剣士の kit のまま。素手のモーションは別 Work Item（戦闘スタイルの決定後） | 表示のみ。戦闘挙動・バランス不変。剣士の色は変わらない |
| b | 現状のまま（剣士の赤い斬撃、武器なし）。攻撃表現はすべて戦闘スタイルの決定後 | 変更なし。武器の無い赤い斬撃が残る |
| c | CR-02 で素手のモーション（専用クリップ）と影の攻撃 VFX を作る | 新しい戦闘表現の設計が必要。Chapter 1 Freeze（Skill のルール）に近い。工数大 |

推奨は a。理由: 指示の「影を利用した攻撃表現」に、未決定の戦闘スタイルを決めずに一番近い（既存の必殺技の色に揃えるだけ）。

**回答形式**: `HD-CR02-1: a`（または b / c）

**Human の回答（2026-10-08）: a** → `.ai/decisions/DEC-005-wanderer-attack-color.md`、CR-02-07 で実装。

### それ以外

- 正体判明のタイミング・話者名・モデル切替・加入処理・save/load は、DEC-004 と既存の仕組みで決まっている → Human Decision なし。
- 影の旅人の Skill 1 / Skill 2 は今回触らない（剣士の kit のまま）→ 決めない。

## 10. テスト状況

| テスト | main | #61 |
| --- | --- | --- |
| `tests/road.spec.js` | 話者名「影の旅人」を期待 | 加入前「？？？」・加入前に「影の旅人」が出ない・加入後 HUD に「影の旅人」 |
| `tests/shadow-guide.spec.js` | 話者名「影の旅人」を期待 | 「？？？」・会話中に「影の旅人」が出ない |
| `tests/unit/road-stranger.test.js` | ― | 10件（話者名・本編の追加行・遅れる影・島の遠景・加入時の開示・片づけ） |
| `tests/chapter1-progression.spec.js` | 時計塔→道、道クリア→影の旅人＋盗賊 | 変更なし（そのまま通る） |
| CI | ― | #60 / #61 実行中 |

## 11. 実装方針

1. #60 → #61 の merge で、§5 の ✓ はすべて main に入る（#61 は Reviewer PASS 済み、CI 実行中）。
2. 残りは HD-CR02-1 の結果に応じた攻撃表現だけ（a なら1行 + テスト）。
3. 新しい仕組み・セーブ項目・別キャラクター定義は作らない。

## 12. Self-review（Analyzer の結果を Planner へ渡す前の確認）

- 「？？？」と「影の旅人」を別キャラクターにしていないか → していない（§3）。
- 既存設計との矛盾 → 無い（DEC-004 と同じ開示タイミング）。
- Freeze 対象（成長・Skill 1/2・装備・異空間・支援AI・加入順）に触れるか → 触れない。HD-CR02-1 の c だけが Skill / 戦闘表現に近いので推奨しない。
- Test Mode を本編仕様に合わせて制限していないか → していない（酒場の隅はテストモードで従来表示、道は加入前の場面なのでどのモードでも「？？？」）。

## 13. Human への依頼

- **Merge**: #60 → #61（#61 は #60 の上。base を main にしてあるので、#60 の後に #61 の差分は CR-02 だけになる）。
- **Decision**: HD-CR02-1（推奨 a）。
