# CHAPTER1-CONTENT — 第一章コンテンツ完成の実装計画（Planner）

Date: 2026-10-06
Phase: **Planner のみ**（コード変更なし・PR なし）
Input: `.ai/reports/CHAPTER1-CONTENT-analysis.md`（全文確認済み、CB-01〜CB-15）
Base: `origin/main`（`c6d3259`）＋ PR #36（第一章システム凍結。CI green・merge 待ち）

---

## 0. 前提

### 0-1. 確定済みの Human Decision（再確認しない）

| ID | 決定 | この計画での扱い |
| --- | --- | --- |
| HD-C1 | **b**: 幽霊船・時計塔に第一章専用の物語と同行者の会話を足す | 物語接続設計 CS-01 を最初に置く。④の舞台は**時計塔で確定**（c は不採用） |
| HD-C2 | **b**: 村・道に自動生成 BGM を足す。実音源は別タスク | CA-01（村・道）。実音源は CA-90 として本計画の外へ切り離す |
| HD-C3 | **a**: 道は今の敵のまま数値を確定。新規敵なし | CR-01（数値のみ）。新しい敵の Work Item は作らない。ボスなし・強敵なしも変えない |
| HD-C4 | **a**: 植物園 Extra（硝子の温室）は第一章クリア後に開く | CX-01（接続だけ）。本編5段の完成には依存させない |

### 0-2. 凍結中で、変更しないもの

全 Work Item の Reviewer は共通で次を確認する（**R-0**）。

- 第一章の成長システム、装備取得ルール、Skill 1 / Skill 2 ルール
- 異空間の廃止、鍛冶屋のルール、ショップのルール
- `CHAPTER1_ORDER`、`CHAPTER_CAST`、`stageFor` / `nextScenario`、主人公交代の仕組み
- Chapter 1 → Chapter 2 の境界（`chapter1Complete` と Chapter 2 入口カード）
- Agent Protocol 2.0、Chapter 1 System Definition of Done（PROGRESSION-010）
- `basefile.html` と legacy concat の構造

コンテンツは**凍結済みの仕組みの上に載せる**。

- 会話は既存の会話システムで、同行は既存の支援AI（`buildGuestCompanion`）で実装する。
- 新しい進行状態をセーブに増やす場合は、`smithJoined` と同じ「純追加フィールド」に限る。

### 0-3. Test Mode の扱い

- Test Mode にある機能は、第一章コンテンツの完成要素として数えない。
- 検証は本編経路で行う。本編の状態（`scenarioClears` など）を注入して区間から始める E2E は**本編経路として扱う**。Test Mode の4職選択やゲスト選択は使わない。

### 0-4. 着手条件

PR #36 が `main` へ merge されてから着手する（凍結済みシステムを土台にするため）。

---

## 1. Content Production Roadmap

| Phase | 対象 | 目的 | 含む Work Item | 出口 |
| --- | --- | --- | --- | --- |
| P0 | 物語接続設計 | 村 → 幽霊船 → 時計塔 → 道の物語をひとつながりで確定 | CS-01 | 物語仕様が Human に承認される（HE-1） |
| P1 | 森の洋館 | 第一章コンテンツの最初の完成対象 | CM-01〜CM-07 | 洋館 Content Ready |
| P2 | 宵待ちの村 | 第二の完成対象。BGM を入れ、C 4件を閉じる | CA-01、CV-01〜CV-03 | 村 Content Ready |
| P3 | 幽霊船 | 既存ダンジョンに第一章③の物語を載せる | CG-01〜CG-05 | 幽霊船 Content Ready |
| P4 | 時計塔 | 既存ダンジョンに第一章④の物語を載せ、道へつなぐ | CT-01〜CT-05 | 時計塔 Content Ready |
| P5 | 道 | 数値の確定、導入の整合、第一章の締め | CR-01〜CR-03 | 道 Content Ready |
| P6 | 第一章の通し | 5段を本編で通す | CQ-01、CD-01 | **Chapter 1 Content Ready** |
| P7 | 植物園 Extra | 第一章クリア後の解放だけ | CX-01（CX-02 は後日） | 解放の接続が完成 |

P0 は文書だけの作業。P1 の洋館は P0 に依存しないので、**P0 の承認待ちと P1 は並行してよい**。

---

## 2. Work Items

- 書式: 各 Work Item を「ID — 名前」の見出しにし、その下に項目を並べる。
- 共通の Reviewer 基準 **R-0**（§0-2 の凍結項目に触れていない）は全 Work Item に適用する。
- 規模: S = 半日程度、M = 1〜2 Work 分、L = それ以上（分割済み）。

### P0. 物語接続設計

#### CS-01 — 第一章 後半の物語接続設計（村 → 幽霊船 → 時計塔 → 道）
- **Stage**: 全体
- **Category**: 仕様
- **元の CB**: CB-07、CB-10（仕様部分）
- **Goal**: 第一章③④の物語仕様を、村の終わりと道の始まりにつながる形で1本の文書にする。
- **Current State**
  - ③④は出撃前の4行（`CHAPTER1_JOIN_LINES`）と既存の周回用ストーリー（船長、七時十三分、管理人の娘）だけ。
  - 道の導入は時計塔のクリアに依存している（`shadowGuideSeated`、主人の「朝から戻っとらん」）。
- **Required Changes**: `docs/CHAPTER1_STORY.md`（新規）に次を書く。
  1. 各段の主人公と支援、物語上の目的、始まり（酒場）と終わり（撃破後 → 酒場）。
  2. 幽霊船の終わり方。何を持ち帰り、何が次の段へ残るか。
  3. 時計塔の始まりと終わり。屋上の跳躍（`towerCollapse`）を第一章の締めとしてどう扱うか。影の旅人の席が空くこととの関係。
  4. 道の導入との整合。現状の台詞を残すか、直すか。
  5. 同行者の会話の場所（ステージ内のどこで、誰が話すか）と、各キャラの口調の基準（`CHARACTERS.md` と洋館の人物表に合わせる）。
  6. 既存の周回用ストーリーとの関係。周回用は Chapter 2 以降のために残し、第一章では別の台詞を出す。
  7. 温室（植物園 Extra）への言及。第一章では伏線に留めるか、触れないか。
- **Dependencies**: なし
- **Expected Files**: `docs/CHAPTER1_STORY.md`（新規）、`.ai/reports/` の設計メモ
- **Test Requirements**: なし（文書）
- **Reviewer Criteria**
  - 新しい敵・ボス・システムを含まない。
  - 凍結ルールに反しない（交代の時期、一本道、再訪なし）。
  - キャラの口調が既存の基準に合う。
  - 既存のボス・マップ・ギミックの範囲で実装できる。
- **Human Decision Required?**: **Yes**。物語の中身は新しいゲーム仕様なので、承認が要る（HE-1）。Agent が案を作り、Human が承認する。HD-C1 の方針（b）は再確認しない。
- **Priority**: P0
- **Estimated Complexity**: M

### P1. 森の洋館

#### CM-01 — 洋館の仕様照合表と仕様書の矛盾修正
- **Stage**: 洋館
- **Category**: 仕様書
- **元の CB**: CB-03
- **Goal**: 「実装済み」と「完成確認済み」を項目ごとに分けた照合表を作り、仕様書の矛盾をなくす。
- **Current State**
  - `MANSION_SCENARIO.md:569`「同行はしない」が、:367 の同行の節およびコードと矛盾している。
  - 部屋数は想定の22に対して実際は25。照合表は存在しない。
- **Required Changes**
  - 次の各項目について、「仕様 / 実装 / 自動テスト / 実機確認」の4列の照合表を作る（WORK12 の形式）: 5戦、3フェーズのボス、6区画、25部屋、瓦礫イベント、Skill 2 の閃き、分離、異変空間、再会、撃破後の流れ、酒場への帰還、次キャラへの接続、演出、BGM / SE、通しプレイ。
  - :569 を同行の節に合わせて直す。
  - 部屋数の記述を `MANSION_ROOMS`（25）に合わせる。
- **Dependencies**: なし
- **Expected Files**: `MANSION_SCENARIO.md`、`.ai/reports/CHAPTER1-MANSION-checklist.md`（新規）
- **Test Requirements**: なし（文書）。照合表の各行に証拠（ファイルと行、またはテスト名）を付ける。
- **Reviewer Criteria**: 推測の行が無い（証拠の無い行は「未確認」と書く）。仕様の意味を変えていない。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: S

#### CM-02 — 分離・異変空間の自動テスト
- **Stage**: 洋館
- **Category**: テスト
- **元の CB**: CB-02 の一部
- **Goal**: 鍛冶士との分離と異変空間を、回帰で壊れたら気づける状態にする。
- **Current State**: `playMansionSplitScene` と `buildMansionAnomaly`（xFoyer / xCor / xHall、照明段階 0〜3）にテストが無い。
- **Required Changes**
  - unit: `smithEscort` の遷移 none → joined → separated → reunited。
  - unit: 照明段階の判定（`core/mansion-anomaly.js` / `mansion-lamp-zones.js` の範囲）。
  - 状態注入 E2E: 分離の直前から始め、分離の一幕 → 異変空間の部屋が組み上がる → 鍛冶士がいない、を確認する。
- **Dependencies**: CM-01（照合表で対象を確定）
- **Expected Files**: `tests/unit/mansion-split.test.js`、`tests/mansion-split.spec.js`（新規）
- **Test Requirements**: 新規テストが通る。既存テストに回帰が無い。
- **Reviewer Criteria**
  - 既存テストの assert を弱めていない。`test.skip`、余分な retry、過大な timeout が無い。
  - ゲームのコードは変えない。テストが要るなら最小限のフックのみ。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: M

#### CM-03 — 瓦礫イベントと Skill 2 の閃きの自動テスト
- **Stage**: 洋館
- **Category**: テスト
- **元の CB**: CB-02 の一部
- **Goal**: 瓦礫の場面で崩し斬りを閃く一連の流れを固定する。
- **Current State**: `beginManorInsight` は未テスト。閃いた後のボタンとセーブは E2E 済み（`chapter1-skill2.spec.js`）。
- **Required Changes**: 状態注入 E2E。瓦礫の手前 → 一幕 → `learnedSkill2` → HUD に Skill 2 → セーブ往復。
- **Dependencies**: CM-01
- **Expected Files**: `tests/mansion-insight.spec.js`（新規）
- **Test Requirements**: 同上
- **Reviewer Criteria**: Skill 2 のルール（凍結）に触れていない。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: S

#### CM-04 — ボス撃破後の流れの自動テスト
- **Stage**: 洋館
- **Category**: テスト
- **元の CB**: CB-02 の一部
- **Goal**: 撃破から酒場までの流れを、Arena を経由せず本編の経路で固定する。
- **Current State**: E2E のボスは Combat Arena から出すので、撃破後の経路（`normalizeMansionStructure` → `playMansionReunion` → 工具の回収 → `showBossResultScreen` → 酒場）を通っていない。
- **Required Changes**: 状態注入 E2E。主の間でボスを瀕死にして撃破する → 構造の復元 → 再会 → `smithJoined` / `smithToolsRecovered` → 結果画面 → 酒場 → ページエラー0。
- **Dependencies**: CM-01
- **Expected Files**: `tests/mansion-aftermath.spec.js`（新規）
- **Test Requirements**: 同上。所要時間は CI の 1/4 時間で現実的な範囲に収める。
- **Reviewer Criteria**: ボスの3フェーズ（凍結ではないが完成済み）の挙動を変えていない。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: M

#### CM-05 — 洋館の演出・BGM・SE の照合
- **Stage**: 洋館
- **Category**: 演出
- **Goal**: 洋館の演出を DoD-7 の基準で確認し、足りない物を特定して補う。
- **Current State**: 演出 3。BGM は手続き生成（`MOODS.mansion`）。HD-C2 により、第一章では手続き生成で可とする。
- **Required Changes**
  - チェック項目: カメラ、NPC、会話の話者名、ボスの登場と撃破、遷移、VFX、SE、環境音、BGM の切り替え（森 → 館 → 主の間 → 酒場）。
  - 欠けていたら補う。既存の SE や演出関数の範囲に限る。
- **Dependencies**: CM-01
- **Expected Files**: チェック表（`.ai/reports/`）。補う場合は `03-dungeons-mansion-temple.js` / `02-world-common.js` の該当箇所。
- **Test Requirements**: BGM キーが区画で正しく切り替わる unit（補った場合）。
- **Reviewer Criteria**: 新しいアセットを要求しない。演出の追加が既存の台詞基準（洋館の人物表）に反しない。
- **Human Decision Required?**: No
- **Priority**: P2
- **Estimated Complexity**: S〜M

#### CM-06 — 洋館の本編通し（自動の区間チェーン）
- **Stage**: 洋館
- **Category**: 検証
- **元の CB**: CB-01 の Agent 部分
- **Goal**: 森 → 洋館 → ボス → 酒場を、区間をつなげて本編経路で通したことを記録する。
- **Current State**: CI では歩いて食堂に着かない。通しの記録は無い。
- **Required Changes**
  - 区間（森、大広間、使用人区画、番人、地下奥、主の間、撃破後）ごとに、本編の状態を注入して始め、次の区間の入口に到達するまでを1本のスクリプトで順に実行する。
  - ページエラー、各区間の所要時間、気づきを記録する。
- **Dependencies**: CM-02、CM-03、CM-04
- **Expected Files**: `tests/mansion-chain.spec.js` または検証用スクリプト（scratch）、報告 `.ai/reports/CHAPTER1-MANSION-run.md`
- **Test Requirements**: 全区間でページエラー0。
- **Reviewer Criteria**: 注入した状態が、本編でその地点に着いたときと同じである（Test Mode の値を使っていない）。
- **Human Decision Required?**: No
- **Priority**: P0
- **Estimated Complexity**: M

#### CM-07 — 洋館の実機通しプレイ（Human）
- **Stage**: 洋館
- **Category**: 検証
- **元の CB**: CB-01 の Human 部分
- **Goal**: 新規開始から洋館をクリアして酒場に戻るまでを、人が実機で1回通す。
- **Current State**: 未実施。この環境では通せない。
- **Required Changes**: Agent が手順書（確認項目、記録の形式）を用意し、Human がプレイして記録する。
- **Dependencies**: CM-05、CM-06
- **Expected Files**: `.ai/reports/CHAPTER1-MANSION-playtest.md`
- **Test Requirements**: ページエラー0、所要時間、気づきの記録。
- **Reviewer Criteria**: 気づきのうち、バグは Bug Fix として切り出す。仕様に関わるものは Human Decision として切り出す。
- **Human Decision Required?**: No（Human の**作業**が要る。HE-2 を参照）
- **Priority**: P0
- **Estimated Complexity**: S（Agent 側）

### P2. 宵待ちの村

#### CA-01 — 村・道の自動生成 BGM（HD-C2）
- **Stage**: 村・道
- **Category**: 音
- **元の CB**: CB-04
- **Goal**: 村と道で無音をなくす。
- **Current State**: `MOODS` に `duskvillage` / `road` が無いので、`playBgm` は何も鳴らさない。
- **Required Changes**
  - `src/audio/procedural-bgm.js` の `MOODS` に `duskvillage` と `road` を追加する。既存の項目と同じ形式。
  - 村は夜で湖の静けさ（環境音の区画 `duskAmbienceZoneFor` と喧嘩しない音量）、道は朝で明るい。
  - 村の夜明けの後や、ボス戦で切り替えるかどうかは、既存の `setIntensity` の範囲に限る。
- **Dependencies**: なし
- **Expected Files**: `src/audio/procedural-bgm.js`、`tests/unit/procedural-bgm.test.js`（新規または追記）
- **Test Requirements**
  - unit: 第一章の5つのワールドキーすべてに mood がある。
  - unit: `startProceduralBgm` が `duskvillage` / `road` で null を返さない。
- **Reviewer Criteria**
  - 既存の mood（洋館など）を変えていない。
  - `BGM_TRACKS` の実音源の経路を壊していない。
  - 音量が環境音より前に出すぎない。
- **Human Decision Required?**: No（HD-C2 で決定済み）
- **Priority**: P1
- **Estimated Complexity**: S

#### CV-01 — 村の表示・負荷の確認（C 2件）
- **Stage**: 村
- **Category**: 検証
- **元の CB**: CB-05 の一部
- **Goal**: 商店街の同時最大（8体）の見え方と、実 GPU でのライト数の影響を判定する。
- **Current State**: WORK12 の C。
- **Required Changes**: 計測の手順と基準（fps、見え方）を決め、実機で測る。必要なら軽量化する（数値ではなく描画の範囲）。
- **Dependencies**: CA-01
- **Expected Files**: `.ai/reports/CHAPTER1-VILLAGE-perf.md`、必要なら `14-dungeon-duskvillage.js`
- **Test Requirements**: 軽量化したら既存の村の E2E に回帰が無い。
- **Reviewer Criteria**: 敵の数や配置（仕様）を変えていない。
- **Human Decision Required?**: No（実機の計測は HE-2 の Human 作業）
- **Priority**: P1
- **Estimated Complexity**: S〜M

#### CV-02 — 村の手触り・ボス戦の長さの確認（C 2件）
- **Stage**: 村
- **Category**: 調整
- **元の CB**: CB-05 の一部
- **Goal**: 主人公（魔法使い）と支援（剣士）での戦闘の手触り、村の残響戦の長さを判定する。
- **Current State**: WORK12 の C。WORK12.1 で HP 760 ≈ 27発、約16秒ぶん。
- **Required Changes**: 本編の顔ぶれで計測する（撃破までの時間、被弾、死亡率）。「受け入れ」か「数値調整案」かを報告する。
- **Dependencies**: CV-01
- **Expected Files**: `.ai/reports/CHAPTER1-VILLAGE-balance.md`
- **Test Requirements**: 計測の記録。
- **Reviewer Criteria**: 数値は変えない。変えるなら案を出して止まる。
- **Human Decision Required?**: **条件付き Yes**。数値を変える場合だけ（HE-3）。
- **Priority**: P1
- **Estimated Complexity**: S

#### CV-03 — 洋館 → 酒場 → 交代の一幕 → 村の本編接続
- **Stage**: 洋館 → 村
- **Category**: 検証
- **元の CB**: CB-06
- **Goal**: 洋館のクリアから村に入るまでの接続を、本編経路で確認する。
- **Current State**: unit（`joinSceneReady`）と「続きから」では確認済み。洋館を撃破して戻る経路では未確認。
- **Required Changes**: CM-04 の撃破後の E2E を延長する。酒場の表示 → 交代の一幕 → 魔法使い＋剣士 → 村の入口で剣士が合流。
- **Dependencies**: CM-04
- **Expected Files**: `tests/chapter1-mansion-to-village.spec.js`（新規）
- **Test Requirements**: ページエラー0。主人公・支援・武器・Skill の状態が仕様どおり。
- **Reviewer Criteria**: 交代の仕組み（凍結）に触れていない。
- **Human Decision Required?**: No
- **Priority**: P0
- **Estimated Complexity**: M

### P3. 幽霊船

#### CG-01 — 幽霊船の棚卸し（ギミック監査と第一章照合）
- **Stage**: 幽霊船
- **Category**: 監査
- **元の CB**: CB-08
- **Goal**: 既存の幽霊船を CS-01 の仕様と照合し、使う物・出さない物・足す物を確定する。
- **Current State**: ギミックは未監査。深部（★4）や周回の変異は第一章では出ない想定だが、確認していない。
- **Required Changes**
  - マップ、敵、強敵、ボス、ギミックを棚卸しする。
  - 第一章（★1・一本道）で出るものと出ないものを確定する。
  - CS-01 の照合表を作る。
- **Dependencies**: CS-01
- **Expected Files**: `.ai/reports/CHAPTER1-GHOSTSHIP-checklist.md`
- **Test Requirements**: なし（監査）
- **Reviewer Criteria**: 推測の行が無い。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: S

#### CG-02 — 幽霊船: 導入と道中の同行者会話
- **Stage**: 幽霊船
- **Category**: シナリオ
- **Goal**: 弓師＋魔法使いの第一章③として、乗船から船倉までの物語を実装する。
- **Current State**: ステージ内に第一章の台詞は無い。
- **Required Changes**
  - CS-01 で決めた地点に、会話イベントと同行者の台詞を置く（既存の `registerRoomEvent` の仕組み）。
  - 第一章（本編）のときだけ出す。周回用の既存台詞は Chapter 2 以降のために残す。
- **Dependencies**: CG-01
- **Expected Files**: `04-dungeons-ship-waterway.js`、必要なら `core/` に台詞表（新規）
- **Test Requirements**
  - unit: 本編（`legacyGrowth()` が false）のときは第一章の台詞、テストモードと周回では既存の台詞。
  - E2E: 状態注入で乗船 → 最初のイベント。
- **Reviewer Criteria**: 口調の基準を守っている。新しい敵・ギミックが無い。セーブの追加は純追加フィールドのみ。
- **Human Decision Required?**: No（CS-01 の承認範囲内）
- **Priority**: P1
- **Estimated Complexity**: M

#### CG-03 — 幽霊船: ボス前後・撃破後・酒場の痕跡
- **Stage**: 幽霊船
- **Category**: シナリオ／演出
- **Goal**: 「帰港を望む船長」戦の前後と、撃破から酒場までの流れを第一章③の締めにする。
- **Current State**: ボスの台詞は周回用。撃破後は共通の結果画面だけ。
- **Required Changes**
  - ボス前の会話（同行者の台詞を含む）。
  - 撃破後の締めの会話 → 結果画面 → 酒場。
  - 酒場に③の痕跡を置く（村の木彫りの舟と同じ形式）。
- **Dependencies**: CG-02
- **Expected Files**: `04-dungeons-ship-waterway.js`、`07-ai-combat.js`（ボスの台詞の分岐のみ）、`03-dungeons-mansion-temple.js`（酒場の痕跡）
- **Test Requirements**: E2E で撃破 → 締めの会話 → 酒場 → 痕跡。ページエラー0。
- **Reviewer Criteria**: ボスの戦闘性能（HP・攻撃）を変えていない。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: M

#### CG-04 — 幽霊船の自動テストと照合の完了
- **Stage**: 幽霊船
- **Category**: テスト
- **Goal**: CG-01 の照合表をすべて「一致」にし、山場のテストを揃える。
- **Current State**: 第一章用のテストは無い（`chapter1-progression` の進行確認だけ）。
- **Required Changes**: 照合表の未確認行を埋める。不足分のテストを追加する。
- **Dependencies**: CG-03
- **Expected Files**: `tests/ghostship-chapter1.spec.js`（新規）、チェック表の更新
- **Test Requirements**: 新規テストが通る。既存テストに回帰が無い。
- **Reviewer Criteria**: assert を弱めていない。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: S〜M

#### CG-05 — 幽霊船の踏破とバランスの確認
- **Stage**: 幽霊船
- **Category**: 検証
- **元の CB**: CB-09
- **Goal**: 弓師＋魔法使い（村から引き継いだ状態）で踏破できることを確認する。
- **Current State**: 交代後の顔ぶれで踏破した記録は無い。
- **Required Changes**: 区間チェーン（CM-06 と同じ方法）と計測。結果は「受け入れ」か「数値調整案」。
- **Dependencies**: CG-04
- **Expected Files**: `.ai/reports/CHAPTER1-GHOSTSHIP-run.md`
- **Test Requirements**: ページエラー0、撃破時間、死亡率。
- **Reviewer Criteria**: 数値は変えない。変えるなら案を出して止まる。
- **Human Decision Required?**: 条件付き Yes（数値を変える場合のみ。HE-3）
- **Priority**: P1
- **Estimated Complexity**: S

### P4. 時計塔

#### CT-01 — 時計塔の棚卸しと第一章照合
- **Stage**: 時計塔
- **Category**: 監査
- **Goal**: CG-01 と同じ。周回用（★3 の隠し歯車庫、深部）を第一章で出さないことの確認を含む。
- **Current State**: ギミックは 3。第一章としては未照合。
- **Required Changes**: 棚卸しと照合表。
- **Dependencies**: CS-01
- **Expected Files**: `.ai/reports/CHAPTER1-CLOCKTOWER-checklist.md`
- **Test Requirements**: なし
- **Reviewer Criteria**: 推測の行が無い。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: S

#### CT-02 — 時計塔: 導入と道中の同行者会話
- **Stage**: 時計塔
- **Category**: シナリオ
- **Goal**: 盗賊＋弓師の第一章④として、1F から番人の前までの物語を実装する。
- **Current State**: ステージ内に第一章の台詞は無い。
- **Required Changes**: CG-02 と同じ形式。中ボス「止まった番人」の前後の会話を含む。
- **Dependencies**: CT-01
- **Expected Files**: `03-dungeons-mansion-temple.js`（`buildClocktower`）、台詞表
- **Test Requirements**: CG-02 と同じ。
- **Reviewer Criteria**: CG-02 と同じ。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: M

#### CT-03 — 時計塔: 時喰らい・屋上の跳躍・道への接続
- **Stage**: 時計塔
- **Category**: シナリオ／演出
- **Goal**: 撃破 → `towerCollapse` → 跳躍 → 酒場 → 影の旅人の席が空く、を第一章④の締めとしてつなぐ。
- **Current State**
  - 撃破後の跳躍は既存の演出。
  - 席が空くのは `shadowGuideSeated()`（`scenarioClears('clocktower')`）で実装済み。
  - 物語の締めは無い。
- **Required Changes**
  - ボス前と撃破後の会話。
  - 跳躍の後の締め。
  - 酒場での道の導入（主人の「朝から戻っとらん」）との接続を CS-01 に合わせる。
- **Dependencies**: CT-02
- **Expected Files**: `07-ai-combat.js`（台詞の分岐）、`02-world-common.js`（`towerCollapse` の後）、`12-progression-ui.js`（必要なら）
- **Test Requirements**: E2E で撃破 → 跳躍 → 酒場 → 席が空いている → 道が次の行き先。ページエラー0。
- **Reviewer Criteria**: ボスの性能と `towerCollapse` の仕組みを変えていない。進行の判定（凍結）に触れていない。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: M

#### CT-04 — 時計塔の自動テストと照合の完了
- **Stage**: 時計塔
- **Category**: テスト
- **Goal / Required Changes / Test / Reviewer**: CG-04 と同じ。
- **Dependencies**: CT-03
- **Expected Files**: `tests/clocktower-chapter1.spec.js`（新規）
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: S〜M

#### CT-05 — 時計塔の踏破とバランスの確認
- **Stage**: 時計塔
- **Category**: 検証
- **元の CB**: CB-11
- **Goal / Required Changes**: CG-05 と同じ。盗賊＋弓師で、`towerCollapse` から酒場に戻り、道が開くまでを含む。
- **Dependencies**: CT-04
- **Expected Files**: `.ai/reports/CHAPTER1-CLOCKTOWER-run.md`
- **Human Decision Required?**: 条件付き Yes（HE-3）
- **Priority**: P1
- **Estimated Complexity**: S

### P5. 道

#### CR-01 — 道の敵の数値確定（HD-C3）
- **Stage**: 道
- **Category**: 敵・数値
- **元の CB**: CB-12
- **Goal**: `PROVISIONAL_ROAD_BEAST` / `PROVISIONAL_ROAD_SPITTER` の数値を確定し、PROVISIONAL を外す。
- **Current State**: 汎用の獣2種、2戦。数値は仮。
- **Required Changes**
  - 時計塔を出た時点の顔ぶれ（戦闘1は盗賊＋弓師、戦闘2は影の旅人＋盗賊）で、撃破時間と被弾を計測する。
  - 時計塔・村の敵との比較で値を決め、定数名から PROVISIONAL を外す。
  - **新しい敵は作らない。ボスと強敵も置かない。**
- **Dependencies**: CT-05（時計塔を出た時点の状態が確定してから）
- **Expected Files**: `src/legacy/parts/14-dungeon-road.js`、`tests/unit/road-enemies.test.js`（新規）
- **Test Requirements**
  - unit: 道の敵が既存の型（`charge` / `fire`）だけであること。`strongMob` / `isBoss` が無いこと。値が確定定数を参照していること。
  - 既存の `road.spec.js` に回帰が無い。
- **Reviewer Criteria**: 敵の種類と数は変えず、数値だけを変えている。決めた根拠（計測値）が報告にある。
- **Human Decision Required?**: No（HD-C3 で方針は決定済み。数値は計測に基づき Agent が決める）
- **Priority**: P2
- **Estimated Complexity**: S

#### CR-02 — 道の導入と締めの台詞の整合
- **Stage**: 道
- **Category**: シナリオ
- **Goal**: CS-01 で確定した時計塔の終わり方と、道の導入（酒場、道標、橋の人影）・締め（丘、第一章の最後の酒場）の台詞を一致させる。
- **Current State**: 道は WORK 11 で、時計塔に物語が無い前提で書かれている。
- **Required Changes**: CS-01 との差分だけを直す。差分が無ければ「変更なし」と報告して閉じる。
- **Dependencies**: CS-01、CT-03
- **Expected Files**: `14-dungeon-road.js`、`03-dungeons-mansion-temple.js`（酒場）、`14-hud-boot.js`（`playChapter1Finale` の台詞のみ）
- **Test Requirements**: 既存の `road.spec.js` と `chapter1-progression` #11 に回帰が無い。
- **Reviewer Criteria**: 出会いと交代の仕組み（`meetChapter1Protagonist`）を変えていない。影の旅人の正体を明かしていない（既存の方針）。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: S

#### CR-03 — 時計塔 → 道 → 第一章の終わりの本編接続
- **Stage**: 道
- **Category**: 検証
- **元の CB**: CB-13
- **Goal**: 時計塔クリア後の酒場から道を終えて、第一章の最後の酒場（Chapter 2 の入口）までを本編経路で確認する。
- **Current State**: 道の中身は Test Mode で通し、接続はクリア済みセーブで確認した。本編経路での通しは無い。
- **Required Changes**: 状態注入 E2E。時計塔クリア直後のセーブ → 酒場 → 道 → 出会い → 交代 → 丘 → 酒場 → Chapter 2 の入口。
- **Dependencies**: CR-01、CR-02、CA-01
- **Expected Files**: `tests/chapter1-tower-to-road.spec.js`（新規）
- **Test Requirements**: ページエラー0。第一章の終わりの状態（`chapter1Complete`）。
- **Reviewer Criteria**: Chapter 1 → 2 の境界に触れていない。
- **Human Decision Required?**: No
- **Priority**: P1
- **Estimated Complexity**: M

### P6. 第一章の通し

#### CQ-01 — 第一章の本編通し（5段）
- **Stage**: 全体
- **Category**: 検証
- **Goal**: 新規開始から第一章の終わりまで、5段を本編の顔ぶれで通す。
- **Current State**: 区間ごとにしか確認していない。
- **Required Changes**
  - Agent: 各段の区間チェーンをつないで1本にし、各段の境目のセーブを渡しながら通す。
  - Human: 実機で1回通す（HE-2）。
  - Agent が手順書と記録の形式を用意する。
- **Dependencies**: CM-07、CV-02、CV-03、CG-05、CT-05、CR-03
- **Expected Files**: `.ai/reports/CHAPTER1-FULL-run.md`
- **Test Requirements**: ページエラー0。各段の所要時間。死亡と撤退で進行が戻らないことを確認する（凍結ルールの確認のみ）。
- **Reviewer Criteria**: §4 の Content DoD を全段で満たしている。
- **Human Decision Required?**: No（Human の作業が要る）
- **Priority**: P0（最終ゲート）
- **Estimated Complexity**: M
- **Status（2026-10-09）**: 実機の手順・記録の形式・判定基準は `docs/CHAPTER1_PLAYTEST.md`（#64 と追補）。Expected Files の `CHAPTER1-FULL-run.md` は作らず、`.ai/reports/CQ-01-report.md` に置き換えた。Agent の5段を1本につないだ通しは、この環境（3〜7fps）で時計塔を登り切れないため未実施（区間ごとの E2E のみ）。**Human の実機プレイは未実施** → Chapter 1 Content Ready = HUMAN DEVICE CHECK REQUIRED

#### CD-01 — 第一章の仕様文書の更新
- **Stage**: 全体
- **Category**: ドキュメント
- **元の CB**: CB-15
- **Goal**: `docs/SCENARIOS.md` と `docs/README.md` の古い記述を実装と CS-01 に合わせる。
- **Current State**: 自動進行・ゲスト AI・5人目が「未実装」のまま。④と温室が「未確定」のまま。
- **Required Changes**
  - 実装済みの事実へ直す。
  - ④ = 時計塔（HD-C1）、温室 = 第一章クリア後の Extra（HD-C4）を反映する。
  - `CHAPTER1_STORY.md` へのリンクを張る。
- **Dependencies**: CS-01（文書の確定）。最終更新は CQ-01 の後。
- **Expected Files**: `docs/SCENARIOS.md`、`docs/README.md`
- **Test Requirements**: なし
- **Reviewer Criteria**: 決定済みの事項だけを書き、未決定を決定済みのように書いていない。
- **Human Decision Required?**: No
- **Status（2026-10-09）**: 実施済み（#64 の `.ai/reports/CD-01-report.md`、追補は `.ai/reports/CQ-01-CD-01-followup-report.md`）。`MANSION_SCENARIO.md` は未 merge の #38 / #42 と衝突しないよう触っていない
- **Priority**: P2
- **Estimated Complexity**: S

### P7. 植物園 Extra

#### CX-01 — 硝子の温室を第一章クリア後に開く（HD-C4）
- **Stage**: 植物園 Extra
- **Category**: 進行の接続
- **元の CB**: CB-14
- **Goal**: 第一章を終えた酒場から、温室に出撃できるようにする。
- **Current State**: `offeredScenarios` は第一章の後に空を返し、Chapter 2 の入口カード（出撃不可）だけが出る。温室にはどこからも行けない。
- **Required Changes**
  - 第一章を終えたとき（`chapter1Complete`）に限り、Chapter 2 の入口カードとは**別の**「Extra」カードとして温室を出す。
  - 顔ぶれは第一章の最終段（影の旅人＋盗賊）のまま。新しい交代は作らない。
  - 第一章の途中では出さない（一本道を守る）。
  - Chapter 2 の入口カードと `chapter1Complete` の判定は変えない。
- **Dependencies**: なし（本編5段に依存させない）。ただし着手は P6 の後。
- **Expected Files**: `12-progression-ui.js`（出撃一覧）、`src/core/chapter1-progress.js` に読み取り専用の関数を足すか、UI 側だけで判定するか（Implementer が最小の方を選ぶ）、`tests/unit/chapter1-extra.test.js`、`tests/chapter1-extra.spec.js`（新規）
- **Test Requirements**
  - unit / E2E: 第一章の途中は温室が出ない。第一章を終えると温室のカードが出て出撃できる。
  - Chapter 2 の入口カードが今までどおり出る。
  - 既存の `chapter1-progression` #9・#11 に回帰が無い。
- **Reviewer Criteria**: `CHAPTER1_ORDER` に温室を入れていない（第一章の完成判定に影響しない）。Chapter 1 → 2 の境界を変えていない。
- **Human Decision Required?**: No（HD-C4 で決定済み）
- **Priority**: P2
- **Estimated Complexity**: S

#### CX-02 — 硝子の温室の作り込み（後日）
- **Stage**: 植物園 Extra
- **Category**: コンテンツ
- **Goal**: Extra としての物語と演出。
- **Status**: **本計画では着手しない。** 本編5段の Content Ready の後に、別の Analyzer → Planner で扱う。
- **Human Decision Required?**: 後日（物語の中身）
- **Priority**: P3
- **Estimated Complexity**: —

### 本計画の外

#### CA-90 — 実音源 BGM の制作・刷新
- HD-C2 により別の Work Item とする。素材は Human が用意する。
- `BGM_TRACKS` に登録するだけで差し替わる（`ASSETS.md`）。
- 本計画のどの Work Item もこれに依存しない。

---

## 3. CB と Work Item の対応

| CB | Work Item |
| --- | --- |
| CB-01 | CM-06（Agent）、CM-07（Human の実機）、CQ-01 |
| CB-02 | CM-02、CM-03、CM-04 |
| CB-03 | CM-01 |
| CB-04 | CA-01（村・道）、CM-05（洋館は手続き生成で可）、CA-90（実音源、本計画の外） |
| CB-05 | CV-01、CV-02 |
| CB-06 | CV-03 |
| CB-07 | CS-01、CG-02、CG-03 |
| CB-08 | CG-01 |
| CB-09 | CG-05 |
| CB-10 | CS-01、CT-02、CT-03（④＝時計塔は HD-C1 で確定） |
| CB-11 | CT-05 |
| CB-12 | CR-01 |
| CB-13 | CR-03 |
| CB-14 | CX-01（CX-02 は後日） |
| CB-15 | CD-01 |

---

## 4. Work Item Dependency Graph

```
HD-C1 (決定済み: b)
  └─ CS-01 物語接続設計 ──[HE-1 Human 承認]──┐
                                              │
CM-01 照合表 ─┬─ CM-02 分離・異変              │
              ├─ CM-03 瓦礫・閃き              │
              ├─ CM-04 撃破後 ─── CV-03 洋館→村 │
              └─ CM-05 演出                     │
CM-02,03,04 ── CM-06 区間チェーン               │
CM-05,06 ───── CM-07 実機通し [HE-2]            │
                                              │
CA-01 村・道BGM ── CV-01 表示・負荷 ── CV-02 手触り [HE-3?]
                                              │
                 ┌────────────────────────────┘
                 ▼
        CG-01 ── CG-02 ── CG-03 ── CG-04 ── CG-05 [HE-3?]   (幽霊船)
        CT-01 ── CT-02 ── CT-03 ── CT-04 ── CT-05 [HE-3?]   (時計塔)
                            │                  │
                            ▼                  ▼
                       CR-02 台詞整合      CR-01 数値確定
                            └──────┬───────────┘
                                   ▼
                      CR-03 時計塔→道→終わり（＋CA-01）
                                   │
CM-07, CV-02, CV-03, CG-05, CT-05, CR-03
                                   ▼
                        CQ-01 第一章の本編通し [HE-2]
                                   ▼
                        CD-01 文書更新（最終）
                                   ▼
                        CX-01 温室を第一章クリア後に開く
                                   ┆
                        CX-02 温室の作り込み（後日） / CA-90 実音源（本計画の外）
```

要点:
- **HD-C1 → CS-01 → 幽霊船（CG-*）・時計塔（CT-*）→ 道（CR-02 → CR-03）**。時計塔の終わり方（CT-03）が、道の導入（CR-02）を決める。
- **幽霊船と時計塔の実装は、CS-01 さえ確定すれば互いに独立**。ただし基本順に従って幽霊船を先に行う。
- 洋館（P1）と村（P2）は CS-01 に依存しない。
- 温室（CX-01）は本編のどの Work Item にも依存されない。

---

## 5. Recommended Execution Order

| 順 | Work Item | 備考 |
| --- | --- | --- |
| 0 | （PR #36 の merge を待つ） | 着手条件 |
| 1 | **CS-01** 物語接続設計 → HE-1 で Human に承認を依頼 | 承認待ちの間は 2〜 を進める |
| 2 | CM-01 | 洋館の照合表と仕様書の修正 |
| 3 | CM-02 → CM-03 → CM-04 | 洋館の山場のテスト |
| 4 | CM-05 | 洋館の演出 |
| 5 | CM-06 → **CM-07**（Human の実機） | **洋館 Content Ready** |
| 6 | CA-01 | 村・道の BGM（1回で両方入れる） |
| 7 | CV-03 → CV-01 → CV-02 | **村 Content Ready** |
| 8 | CG-01 → CG-02 → CG-03 → CG-04 → CG-05 | **幽霊船 Content Ready**（CS-01 の承認が前提） |
| 9 | CT-01 → CT-02 → CT-03 → CT-04 → CT-05 | **時計塔 Content Ready** |
| 10 | CR-02 → CR-01 → CR-03 | **道 Content Ready** |
| 11 | **CQ-01**（Agent の通し＋Human の実機） | **Chapter 1 Content Ready** |
| 12 | CD-01 | 文書の最終更新 |
| 13 | CX-01 | 植物園 Extra の解放 |

順番の補足:
- **CV-03 を村の先頭に置く。** CM-04 の撃破後の E2E を延長するだけなので、続けて行う方が安い。
- **CA-01 を村に入る前に置く。** CV-01 の表示・負荷の計測を、BGM が鳴る状態で行うため。
- **道では CR-02 を CR-01 より先に行う。** 台詞の整合で道の流れが変わると、計測をやり直すことになるため。

**PR の単位**: 1つの Phase（ステージ）を1本の PR にし、Work Item ごとにコミットを分ける。1本の PR が大きくなりすぎる場合（幽霊船・時計塔）は、「CG-01〜02」と「CG-03〜05」のように2本に分けてよい。

---

## 6. Content Definition of Done（案）

**Chapter 1 System Definition of Done（PROGRESSION-010）は変更しない。** 以下はそれとは別の、コンテンツの完成条件の**案**。採用するときは Human Decision として記録する。

### 6-1. ステージ単位（Stage Content Ready）

| # | 条件 | 確認方法 |
| --- | --- | --- |
| D1 | **到達**: 本編の進行（Test Mode ではない）で出撃できる | `chapter1-progression` の E2E |
| D2 | **シナリオ**: 始まり（酒場）→ 目的 → 山場 → 終わり（撃破後 → 酒場）が仕様書にあり、自己矛盾がない | 仕様書＋照合表 |
| D3 | **実装の照合**: 仕様の全項目が照合表で「一致」。証拠の無い行がない | 照合表（WORK12 形式） |
| D4 | **マップ**: 全区画に到達でき、進行不能の地点がない | 区間チェーン |
| D5 | **敵配置**: 通常敵・強敵が仕様どおり。周回用の変異（★）が第一章で出ない | 照合表＋unit |
| D6 | **ボス**: 登場 → フェーズ → 撃破 → 撃破後の流れが本編の経路で動く（仕様上ボスの無い道は除く） | E2E |
| D7 | **ギミック**: 仕様のギミックがすべて動く | E2E か unit |
| D8 | **演出**: 会話の話者名、同行者の台詞、ボスの登場と撃破、遷移、VFX が揃う | チェック表 |
| D9 | **BGM / SE**: 無音の区間がない（手続き生成で可。実音源は CA-90）。SE が鳴る | unit＋チェック表 |
| D10 | **数値**: `PROVISIONAL` が残っていない。残すなら Human が承認した記録がある | grep＋報告 |
| D11 | **自動テスト**: 山場ごとに unit か状態注入 E2E が1本以上。既存テストに回帰がない | CI green |
| D12 | **単体の通し**: そのステージの区間チェーン（Agent）でページエラー0 | 報告 |
| D13 | **前後の接続**: 前の酒場 → ステージ → 次の酒場（交代の一幕を含む）が本編経路で動く | E2E |
| D14 | **残課題**: C 区分は閉じたか、Human が「受け入れ」と記録している | 報告 |
| D15 | **Reviewer**: R-0（凍結項目）と、Work Item ごとの Reviewer 基準が PASS | Review 記録 |

### 6-2. 章単位（Chapter 1 Content Ready）

- 本編5段（洋館・村・幽霊船・時計塔・道）がすべて Stage Content Ready。
- **新規開始から第一章の終わりまでの本編通し**を、Agent の区間チェーンと Human の実機プレイで各1回行い、ページエラー0で記録している（CQ-01）。
- 第一章の仕様文書（`SCENARIOS.md`、`CHAPTER1_STORY.md`、`MANSION_SCENARIO.md`）が実装と一致している（CD-01）。
- **植物園 Extra は章の判定に含めない。** CX-01 の完了は、別項目「Extra 解放」として記録する。

---

## 7. Human Escalation

HD-C1〜C4 は決定済みなので、再確認しない。以下は、それ以外で**Human にしか決められない、または Human にしかできない**ものだけ。

| ID | 内容 | 種類 | 推奨 | 回答形式 |
| --- | --- | --- | --- | --- |
| HE-1 | **CS-01 の物語仕様の承認**。幽霊船・時計塔の第一章での物語の中身（何が起き、どう終わるか）は新しいゲーム仕様になる。Agent が既存の設定と台詞基準から案を作るので、Human は承認か修正指示をする | 仕様の承認（1回） | 案を見てから判断 | `HE-1: 承認 / 修正（指示）` |
| HE-2 | **実機の通しプレイを誰が行うか**。この環境（software rendering、ゲーム時間 1/4）では洋館を歩いて通せない。CM-07 と CQ-01 の実機プレイには人と実機が要る | 作業の担当 | (a) Human が実機で行う。Agent は手順書と区間チェーンを用意する | `HE-2: a / b（Agent の区間チェーンのみで実機確認とみなす）` |
| HE-3 | **バランス調整で数値を変える場合**（CV-02、CG-05、CT-05）。発生したときだけ、Agent が計測値と案を添えて個別に聞く | 条件付き | — | そのつど |

Escalation に**しない**もの（Agent が決める）:
- 道の敵の具体的な数値（CR-01。HD-C3 で方針は決定済みで、計測に基づいて決める）
- 温室の解放カードの見せ方、温室での顔ぶれ（CX-01。第一章の最終段のまま）
- BGM の mood の具体値（CA-01）
- テストの方式（状態注入 E2E と unit の使い分け）
- 仕様書の矛盾修正（CM-01、CD-01）

---

## 8. Implementation Boundary

- 今回の Planner では、**コード・テスト・仕様書を一切変更していない**。作ったのはこの計画書だけ。
- PR は作っていない。
- 実装は、次の指示（Agent Autonomous Execution への移行）を受けてから、§5 の順で始める。

---

## 9. 判定

**第一章コンテンツ制作は、この Work Item 順で Agent Autonomous Execution に移行可能: YES（条件付き）**

| 条件 | 内容 |
| --- | --- |
| 着手条件 | PR #36（第一章システム凍結）が `main` に merge されていること |
| 自律で進められる範囲 | P1 洋館（CM-01〜06）、P2 村（CA-01、CV-01〜03）、CX-01、CD-01。Human の判断を待たずに進められる |
| Human 待ちになる地点 | ① CS-01 の承認（HE-1）: P3 幽霊船以降の着手前。② 実機プレイ（HE-2）: CM-07 と CQ-01。③ 数値変更が要る場合のみ（HE-3） |

HE-1 と HE-2 は計画の進行を止めない位置に置いた。CS-01 の承認待ちの間に洋館と村を進め、実機プレイは各ステージ完成の最後に置いてある。

---

### Autonomy Metrics（CHAPTER1-CONTENT Planner）
- Human Escalation Count: 2（HE-1、HE-2）＋条件付き1（HE-3）
- Human Decision Count: 4（HD-C1〜C4。指示により確定）
- Auto Fix Count: 0
- Reviewer Round Count: 1
- Test Retry Count: 0

---

## 追記（2026-10-07）: CS-01 の確定

- **CS-01 は DONE。** HE-1 で B 案を承認（`.ai/decisions/DEC-004-chapter1-story.md`）。確定した仕様は `docs/CHAPTER1_STORY.md`。
- **CR-02 の範囲を広げる**（N-4 の追加条件）:
  - 加入前は、酒場の隅の NPC を含めて名前を出さない（話者名「？？？」）。
  - 加入の瞬間に「影の旅人」を開示する。
  - `tests/shadow-guide.spec.js` と `tests/road.spec.js` の期待値は、新仕様に合わせて更新する。
- **CT-03 の範囲を明確にする**: 名も無い島から見える人影（加入前のグラフィック、遅れる影）、翌朝の酒場（時計を返す、管理人の生還）を含む。
- 幽霊船・時計塔・道のコード実装（CG-02 以降、CT-02 以降、CR-02）は、PR #36 の merge 後に着手する。
