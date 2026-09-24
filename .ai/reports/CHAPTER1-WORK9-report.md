# WORK 9 レポート ―― Chapter 1 全体回帰・完成判定

対象: **Chapter 1 全体**（森の洋館 → 宵待ちの村 → 幽霊船 → 時計塔 → 道）
前段: WORK 2〜8（宵待ちの村）/ `.ai/reports/CHAPTER-STRUCTURE-analysis.md`

Status: **DONE**（回帰確認のみ。ゲームコードの変更は0件）

---

## 1. Chapter 1 全体構成

まず用語を実装と突き合わせた。

| 用語 | 実装での姿 | 判定 |
| --- | --- | --- |
| Chapter 1 = 第一章全体 | **runtime state は存在しない** | ✅ 仕様どおり |
| `state.chapter` / `chapterState` / `chapterProgress` / `chapterProgression` | **参照 0 件** | ✅ 新設していない |
| `CHAPTER_CAST` | `01-character-creation.js:229` の固定表 | ✅ キャラクター構成の表であって runtime state ではない |

```js
const CHAPTER_CAST = [
  null,
  {chapter:1, classKey:'warrior', guestClassKey:null,      dungeonKey:'mansion'},
  {chapter:2, classKey:'mage',    guestClassKey:'warrior', dungeonKey:'duskvillage'},
  {chapter:3, classKey:'archer',  guestClassKey:'mage',    dungeonKey:'ghostship'},
  {chapter:4, classKey:'rogue',   guestClassKey:'archer',  dungeonKey:'clocktower'},
  {chapter:5, classKey:null,      guestClassKey:'rogue',   dungeonKey:null},
];
```

**中身は正式仕様（§2）と完全に一致している** ―― 主人公の順序も、支援AIに回る
直前主人公も、担当ダンジョンも。

ただし **フィールド名 `chapter:` が誤解を招く**。ここに並んでいるのは
「第1章〜第5章」ではなく、**Chapter 1 の中の Scenario 1〜5**（＝キャラクター
アーク）である。これは `.ai/reports/CHAPTER-STRUCTURE-analysis.md` で既に
指摘済みの命名のずれで、**意味は正しい**ため §3 の禁止事項に従って
名前は変更していない（要判断事項 20-1）。

## 2. Scenario 一覧

`SCENARIO_DEFS`（`12-progression-ui.js:1447`）の現状:

| key | 名前 | minLevel | unlocked | Chapter 1 の位置づけ |
| --- | --- | --- | --- | --- |
| `mansion` | 囚われの洋館 | 1 | ✅ | **Scenario 1** |
| `ghostship` | 幽霊船 | 6 | ✅ | **Scenario 3** |
| `temple` | 古代神殿 | 10 | ✅ | 章外（既存の周回ダンジョン） |
| `clocktower` | 狂いの時計塔 | 11 | ✅ | **Scenario 4** |
| `waterway` | 埠頭の地下水路 | 18 | ✅ | 章外 |
| `conservatory` | 硝子の温室 | 22 | ✅ | 幽霊船の関連（§2「関連:温室」） |
| `duskvillage` | 宵待ちの村 | 26 | ✅ | **Scenario 2** |
| `pyramid` / `volcano` | — | — | ❌ | 未実装 |
| **「道」** | — | — | **存在しない** | **Scenario 5 が未実装** |

**確認できたこと**: Scenario 1〜4 に相当するダンジョンは全部あり、単体では動く。
**確認できたこと（問題）**: シナリオ選択は **レベル制の一覧**であって、
章の順番ではない。宵待ちの村が minLevel 26、幽霊船が 6 なので、
**正式仕様の順序（村 → 幽霊船）とプレイ順が逆になる**。

## 3. Character progression

**正式仕様（§5）**: 洋館クリア → 魔法使い playable / 剣士 support → …

**実装の現状**:

| 経路 | 主人公 | 支援AI |
| --- | --- | --- |
| 本編（タイトル →「はじめる」） | **常に剣士**（`applyChapterCast(1)`） | **常に無し**（`CHAPTER_CAST[1].guestClassKey = null`） |
| Scenario Test Mode | 4職から選択 | 4職から選択 |

`state.guestClassKey` を書き換える経路は **2つだけ**:

```
14-hud-boot.js:1249  finishEnteringGame → CHAPTER_CAST[1].guestClassKey（= null 固定）
14-hud-boot.js:1346  beginTestMode → テストモードのゲスト選択
```

→ **本編では主人公の交代も支援AIの同行も起きない。**
コード側にもその旨が明記されている（`08-loot-equipment.js:977`「章の自動進行
(洋館クリア→魔法使いへ交代、等)はまだ実装しておらず」）。

**これが WORK 9 でいちばん重要な確認結果**で、§31 の分類では **C** に当たる。
ただし「壊れている」のではなく「まだ実装されていない」既知の状態であり、
`docs/README.md` の Known Implementation Differences にも記録済み。

メニューから主人公を自由に変更する仕組みは**追加されていない**（§5 の禁止事項）。

## 4. Tavern transition

| 確認 | 結果 |
| --- | --- |
| Dungeon → Tavern の帰還 | ✅ 全シナリオ共通経路（`returnToTown`）。E2E で往復を確認 |
| 酒場NPC | ✅ 店主・鍛冶士（洋館クリア後）・影の旅人 |
| 会話 | ✅ シナリオごとの導入台詞＋再訪台詞 |
| 次シナリオへの導線 | ✅ 店主 → シナリオ一覧（**レベル制**。章の順序ではない ―― §2） |
| ミニマップ場所名 | ✅ WORK 7 の共通修正が効いている（§9） |
| シナリオ痕跡 | ✅ 洋館 → 鍛冶士が住み着く / 宵待ちの村 → 棚の木彫りの舟 |

**次のキャラクターの登場**は、上記のとおり未実装。

## 5. Support AI

`buildGuestCompanion(classKey)`（`08-loot-equipment.js:992`）が実体を作り、
AIは既存の COMPANION 骨格（追従・索敵・攻撃）を流用している。
**職業別の新しいAIシステムは作られていない**（§7 の禁止事項を満たす）。

実機では Test Mode 経由で以下の組み合わせを確認済み（WORK 3〜8）:

| 主人公 | 支援AI | 確認 |
| --- | --- | --- |
| 魔法使い | 剣士 | ✅ 宵待ちの村で通し（会話・戦闘同行） |
| 剣士 | 魔法使い | ✅ 宵待ちの村のボス戦 |
| 弓師 / 盗賊 の組み合わせ | — | §16 のとおり本編経路が無く、**未確認** |

## 6. Skill progression

| 職 | Skill 2 | 実装 | 判定 |
| --- | --- | --- | --- |
| 剣士 | **崩し斬り** | `defaultSkill2Def('warrior') → CRUSH_SLASH`（`core/crush-slash.js`） | ✅ 仕様どおり |
| 魔法使い | **観測の灯** | `SKILL2_BY_CLASS.mage` | ✅ 仕様どおり |
| 弓師 | 爆弾投げ | `SKILL2_BY_CLASS.archer` | ✅ 既存仕様 |
| 盗賊 | 三連投げナイフ | `SKILL2_BY_CLASS.rogue` | ✅ 既存仕様 |

回帰の有無:

| 確認項目 | 結果 |
| --- | --- |
| 勝手に別Skillへ置き換わる | ❌ 起きない（`defaultSkill2Def` が一元管理。旧「地裂斬」は枠として残るだけ） |
| 本編開始時から未習得 | ✅ **仕様どおり**（Chapter 1 は Skill 1 だけで出発。洋館の瓦礫イベントで閃く） |
| Test Mode だけで使える | ❌ `hasSkill2()` は `learnedSkill2 ‖ testMode`。本編でも閃けば使える |
| Save/Load で消える | ❌ `learnedSkill2` を保存・復元。旧セーブ（キー無し）は習得済み扱い |

### 6-1. Skill 選択の取りこぼし監査（§9）

WORK 4 で見つけた「条件なし Skill が固定配列に載っておらず一覧から消える」
バグの同型を、**4職すべてで機械的に洗った**:

| 職 | Skill 1 バリアント | 一覧に出ないもの |
| --- | --- | --- |
| 剣士 | dash, retreat, spin, barrier, cleave, smite | **なし** |
| 盗賊 | dash, retreat, spin, barrier, poison, bloodrush | **なし** |
| 魔法使い | dash, retreat, phantom, spin, barrier, chain, nova | **なし** |
| 弓師 | dash, retreat, spin, barrier, pierce, skyPierce | **なし** |

固定配列に無いものはすべて `unlockKey`（`skill1Alt` / `job`）を持ち、
解放後に一覧へ出る経路がある。**同種のバグは他キャラクターに存在しない。**

## 7. Combat

| 項目 | 確認 |
| --- | --- |
| 通常攻撃 / Auto Combo / 長押し | ✅ E2E `auto-combo` / `air-actions` |
| hit stop / small hit VFX | ✅ 既存のまま |
| target control / dodge / skill | ✅ E2E `execution-break` / `job-traits` |
| 旧 Charge Attack の復活 | ❌ 無し（通常攻撃側の溜めは撤去済み。`updateHoldInputs` のコメント参照） |

### 7-1. Combat cleanup（§22）

`disposeWorld()`（`02-world-common.js:344〜`）が世界の切り替えで落とすもの:

```
enemies / projectiles / itemDrops / platforms / decals / surfaces / ambience
mageOrbs / observeLightT / decoys(幻影) / attackSnapshot / posHistory
memoryNets(記憶の網) / keeperEchoes(残響) / anomalyRifts / thornGates / sporeZones
```

宵待ちの村で足した一時状態（WORK 4〜6）は**すべてここに入っている**。
前シナリオの敵・エフェクト・狙いが次のシナリオへ持ち越される経路は見つからなかった。

撃破演出の後始末は `core/combat-cleanup.js` が一覧を持ち、ユニットテストで固定。

## 8. Camera / Weapon

### 8-1. Camera（§12）

| | 仕様 | 実装 |
| --- | --- | --- |
| 非戦闘 | distance 7.0 / height 8.6 | `EXPLORE_CAMERA = {dist:7.0, height:8.6}` |
| 戦闘 | distance 6.0 / height 8.0 | `COMBAT_CAMERA = {dist:6.0, height:8.0}` |
| FOV | 50 | `new THREE.PerspectiveCamera(50, …)` |

**シナリオごとの上書きは存在しない** ―― `state.camDist/camHeight` を書くのは
`13-update-loop.js:2127` の1箇所だけで、値は上の2つの定数から来る。
Tavern / Mansion / Dusk Village / Ghost Ship / Clock Tower のどれでも同じ。

### 8-2. Weapon（§11）

非戦闘=収納 / 戦闘=展開 の状態機械は `core/weapon-state.js` に一本化されており、
宵待ちの村の実装はこれに一切触れていない。E2E `weapon-stow` が回帰を担保。

## 9. Minimap

WORK 7 の共通修正（ワールドが変わったら場所名を捨てる）を再確認した。

```
宵待ちの村 → 帰還ポータル → 酒場
  AREA: 港町の酒場 / ROOM: ""      ← 実機で確認（WORK 8）
```

他シナリオへの副作用は E2E（`mansion-scenario` / `save-load` が酒場↔ダンジョンを
往復する）で確認。Dungeon A → Dungeon B の直接移動は本編に経路が無く、
Test Mode では毎回タイトルから入り直すため、そもそも持ち越しが起きない。

## 10. Save / Load

保存されるもの（`09-save-load.js`）に**新しいフィールドは追加していない**。
Chapter 1 に関わる既存フィールド:

```
selectedClass / guestClassKey / smithJoined / smithGreeted / learnedSkill2
skillChoice / skill2Choice / ultChoice / unlockedSphereNodes / spherePoints
scenarioClears / bossClears / learnedBossAbilities / …
```

- `learnedSkill2` は純追加フィールドで、旧セーブ（キー無し）は習得済み扱い
- **Scenario Test Mode は本編セーブを汚染しない** ―― `saveGame()` が
  `state.testMode` の間は即 return する（WORK 1 から変更なし）
- 宵待ちの村が WORK 4〜7 で足した state（`decoys` / `attackSnapshot` /
  `posHistory` / `observeLightT`）は**いずれも保存対象外**

## 11. Scenario Test Mode

| 確認 | 結果 |
| --- | --- |
| Scenario selection | ✅ `SCENARIO_DEFS` の unlocked なものが並ぶ |
| Location jump | ✅ 宵待ちの村に9地点（入口/広場/魚屋/住宅/船小屋/商店街/水門前/水門/村の奥/水鏡の跡） |
| Boss jump | ✅「水鏡の跡」 |
| Village Back / Water Gate | ✅ |
| 各シナリオ開始 | ✅ Chapter 1 の7シナリオすべてを想定の構成で起動できた（§16-1） |
| 本編セーブを汚染しない | ✅ E2E `scenario-test-mode` が実セーブを seed して検証 |

Test Mode 専用処理の漏れ: `state.testMode` を読んでいるのは
`saveGame` / `hasSkill2` / Arena パネル / 地点ジャンプ / `beginTestMode` のみで、
**本編の進行分岐には現れない**。

## 12. Scenario transition

```
Scenario A → Tavern → Scenario B
```

- `launchScenario(key)` → `fadeTransition` → `launchScenarioNow(key)`（単一経路）
- `returnToTown()` で酒場へ。どちらも `disposeWorld()` を通る
- **宵待ちの村が新しい起動経路を作っていないこと**を確認（WORK 5 §24 で確認済み）

持ち越しの確認は §7-1 のとおり。BGM/SE は `resetAmbience()` が世界ごとに落とす。

## 13. Common systems

Dusk Village 専用コードが他シナリオへ漏れていないか:

| 確認 | 結果 |
| --- | --- |
| `currentWorldKey === 'duskvillage'` によるガード | 14箇所。**すべて村の演出（波紋・水面）に限定** |
| `_spawnWorldKey === 'duskvillage'` | 敵配置の1箇所のみ |
| 村の敵AI（mirror/foam/copy/fisher/keeper） | `en.atkType` の分岐に追加。他シナリオの敵は別の `atkType` なので経路に入らない |
| `en.onDefeat`（WORK 6） | 設定しているのは水門守のみ。他は `undefined` で素通り |
| `defersResultScreen`（WORK 7） | `duskvillage` のみ true。ユニットテストで他6シナリオが false であることを固定 |
| ミニマップ場所名のリセット（WORK 7） | **共通処理**（意図的に全シナリオへ効く） |

## 14. E2E 結果

| | WORK 8 時点 | WORK 9（今回） |
| --- | --- | --- |
| `npm run build` | PASS | **PASS** |
| `npm run test:unit` | 1430件 PASS | **1430件 PASS** |
| 全E2E | 99 passed / 3 failed / 1 flaky | **101 passed / 2 failed / 0 flaky**（1.4時間・全103件） |
| Chapter 1 横断確認（新規・スクラッチ） | — | **7/7 PASS** |

WORK 8 と WORK 9 のあいだにゲームコードの変更は**0件**（WORK 8 の commit 以降、
今回も1行も変えていない）。総件数103は両回で同じで、内訳だけが揺れている。

## 15. E2E failure classification

§25 の A〜E で分類する。

| テスト | 今回 | WORK 8 | 分類 | 根拠 |
| --- | --- | --- | --- | --- |
| `mansion-butler` フェーズ移行 → Phase 2 | FAIL | PASS | **C（低FPS/環境依存）＋ D（flake）** | HP閾値の瞬間に `SHIFT` 状態を**観測窓で拾う**テスト。3〜7fps では状態表示の更新（0.5秒に1回）と観測ループがすれ違う。WORK 8 では通っている |
| `mansion-escort` Relaxed Stance | FAIL | FAIL | **C（低FPS/環境依存）** | **落ちる場所が毎回違う**（WORK 8:「4方向とも1歩も進めず」/ 今回:「立ち止まっても休めの姿勢へ戻らない relax=0.88 < 0.9」）。どちらも固定の実時間待ち（2500ms / 400ms×8）でクロスフェード（0.5秒）や歩行の完了を待つ作り。ゲーム内時間が実時間の1/5〜1/10しか進まないため足りない |
| `base-class-identity` 盗賊 Back Attack | PASS | FAIL→再実行PASS | **D（flake）** | WORK 8 で再実行済み |
| `execution-break` Break→EXECUTE | PASS | FAIL→再実行PASS | **D（flake）** | 同上 |
| `job-traits` Turn Assist | PASS | flaky（自動リトライで通過） | **D（flake）** | spec 自身が「タイミング依存(自動リトライあり)」と明記 |

**A（今回の変更による回帰）は0件**（そもそもゲームコードを変更していない）。
**B（既存不具合）も0件** ―― 失敗2件はいずれもゲーム挙動ではなくテストの待ち時間が
足りないことに起因し、実機のフレームレートでは起きない性質のもの。

§25 の指示どおり、**低FPSが原因の失敗をゲームコードで無理に通すことはしていない。**
§26 の「なぜ落ちているか分からないテストは残さない」も満たしている
（2件とも失敗点と原因を特定できている）。

## 16. 実機確認

### 16-1. Chapter 1 横断（今回の新規確認）

Scenario Test Mode で、**Chapter 1 の全シナリオを想定の主人公・支援AIの
組み合わせで起動**し、コンソールエラーが無いこと・場所名が出ることを確認した。

| シナリオ | 構成 | AREA | ROOM | 結果 |
| --- | --- | --- | --- | --- |
| 囚われの洋館 | 剣士 単独 | 囚われの洋館 | 古い森道 | ✅ |
| 宵待ちの村 | 魔法使い ＋ 剣士 | 宵待ちの村 | 湖畔の森道 | ✅ |
| 幽霊船 | 弓師 ＋ 魔法使い | 幽霊船 | (部屋表なし) | ✅ |
| 狂いの時計塔 | 盗賊 ＋ 弓師 | 狂いの時計塔 | 1階 塔の門 | ✅ |
| 古代神殿 | 剣士 単独 | 古代神殿 | 入口の間 | ✅ |
| 埠頭の地下水路 | 剣士 単独 | 埠頭の地下水路 | (部屋表なし) | ✅ |
| 硝子の温室 | 弓師 ＋ 魔法使い | 硝子の温室 | 硝子の正門 | ✅ |

**7/7 でコンソールエラー0件。** §2 の主人公・支援AIの組み合わせは
（本編経路は無いものの）**すべて実際に成立する**ことが確認できた。

幽霊船・地下水路の ROOM が空なのは、その2シナリオに `roomNameAt` の部屋表が
無いため（WORK 7 の修正で「前の場所名を持ち越さない」ようになった結果、
空欄が正しく空欄になっている）。

### 16-2. これまでの実機確認（再掲）

| 区間 | 確認 | いつ |
| --- | --- | --- |
| 洋館 → 酒場 | E2E `mansion-scenario`（酒場↔洋館の往復を毎回同じように組み上げる） | 今回の全E2E |
| 宵待ちの村（通し） | 入口 → 記憶 → 複合戦闘 → 水門 → ボス → 夜明け → 酒場 | WORK 3〜8 |
| 酒場のミニマップ名 | `AREA:港町の酒場 / ROOM:""` | WORK 8 |
| 村の痕跡（酒場の木彫りの舟） | クリア済みのときだけ棚に出る | WORK 7 |

## 17. 未確認項目

| 項目 | 理由 |
| --- | --- |
| **Chapter 1 の通し（洋館 → 村 → 幽霊船 → 時計塔 → 道）** | **本編にその経路が無い**（§3）。各シナリオ単体と、Test Mode での構成再現までが確認の限界 |
| 幽霊船・時計塔を「弓師/盗賊＋支援AI」で**戦闘まで**通す | 起動は確認済み。戦闘の通しは1シナリオあたり15分以上かかり、今回の範囲では実施していない |
| 4職の細かな戦闘比較 | 低FPS＋自動入力では狙いが付かず、手触りの比較にならない（WORK 8 と同じ理由） |
| 長時間テンポ・徒歩所要時間 | ゲーム内時間が実時間の1/5〜1/10 |
| 複数敵の細かい手触り | 同上 |
| 「道」シナリオ | **存在しないため確認対象が無い** |

§28 のとおり、いずれも「推測で問題なし」とはしていない。

## 18. 既知問題

| # | 問題 | 分類 | 影響範囲 |
| --- | --- | --- | --- |
| 1 | **本編で主人公が交代しない**（常に剣士・支援AI無し） | 未実装 | Chapter 1 の Scenario 2〜5。単体シナリオは Test Mode で全構成を再現できる |
| 2 | **「道」シナリオが存在しない** | 未実装 | Chapter 1 の終端・5人目への接続 |
| 3 | **シナリオ順序がレベル制**（村 minLevel 26 / 幽霊船 6 ―― 仕様順と逆） | 未実装 | 章としての順番。単体プレイには支障なし |
| 4 | `CHAPTER_CAST` のフィールド名 `chapter:` が Scenario 番号を指している | 命名 | 読み手の誤解のみ。意味は正しい |
| 5 | `mansion-escort` の Relaxed Stance テストが低FPS環境で落ちる | 環境依存 | テストのみ。ゲーム挙動ではない |

1〜3 はいずれも **`docs/README.md` の Known Implementation Differences と
コード内コメントに既に記録済み**で、今回新しく見つかった不具合ではない。

## 19. Chapter 1 完成判定

§31 の3分類で記録する。

| 対象 | 判定 | 根拠 |
| --- | --- | --- |
| 森の洋館（Scenario 1） | **A. 完成** | 主人公・鍛冶士・瓦礫イベント・Skill 2・ボス・帰還まで通し。E2E が回帰を担保 |
| 宵待ちの村（Scenario 2） | **B. 実装完了・環境依存未確認** | WORK 8 の判定を維持。未確認は「4職の手触り比較／商店街の同時8体／ボス戦の長さ／実時間テンポ」 |
| 幽霊船（Scenario 3） | **B** | 単体では動く（横断確認済み）。弓師×魔法使い支援の**本編経路が無い**ため、その構成での通しは未確認 |
| 時計塔（Scenario 4） | **B** | 同上（盗賊×弓師支援） |
| 道（Scenario 5） | **C. 明確な実装が必要** | **存在しない**。Chapter 1 の終端と5人目への接続が未実装 |
| Tavern transitions | **A** | 全シナリオ共通経路。ミニマップ名の持ち越しも解消済み |
| Character progression | **C. 明確な実装が必要** | 本編で交代が起きない（§3）。影響範囲は `state.guestClassKey` を書く経路と酒場の登場イベント |
| Support AI | **B** | 基盤は動く（村で実機確認済み）。本編経路が無いため弓師/盗賊構成は未確認 |
| Skill progression | **A** | 4職とも一覧・保存・閃きが仕様どおり |
| Combat / Camera / Weapon / Minimap / Save-Load | **A** | いずれも共通基盤で、村の実装は触っていない |
| Scenario Test Mode | **A** | 本編セーブを汚染しない |
| **Chapter 1 全体** | **C** | 各シナリオは A または B だが、**章として繋がっていない**（交代・順序・終端が未実装） |

つまり:

> **「第一章の部品はすべて揃っていて、単体ではどれも動く。
> しかし『第一章として一本に繋がった状態』にはまだなっていない。」**

## 20. 要判断事項

### 20-1. `CHAPTER_CAST` の `chapter:` フィールド名

中身は Chapter 1 の Scenario 1〜5（キャラクターアーク）だが、フィールド名が
`chapter:` になっている。**意味は正しい**ので §3 に従って変更していない。
名前を `arc:` / `scenario:` 等へ変えるかどうかは判断待ち（変えるなら
参照は `applyChapterCast` の1箇所だけなので影響は小さい）。

### 20-2. Chapter 1 の章進行をどう実装するか（既知問題 1〜3）

WORK 9 は回帰確認の回なので実装していない。実装する場合に決めることは:

1. 交代の起点 ―― 洋館クリア時か、酒場での会話か
2. 支援AIの入り方 ―― `state.guestClassKey` を進行に応じて書くだけで足りるか
3. シナリオ順序 ―― レベル制の一覧を残したまま章の順序を重ねるか、
   章の進行中は一覧を絞るか
4. 「道」をシナリオとして作るか、酒場の演出として作るか

いずれも **新しい Chapter runtime state を足さずに**（既存の
`scenarioClears` / `bossClears` / `smithJoined` と同じ形で）表現できる範囲かの
検討が要る。

### 20-3. WORK 8 からの持ち越し（再掲・いずれも保留）

- 村の残響の `BOSS_ABILITIES` 登録
- 商店街の混戦時の泡沫上限（4 → 3 の候補）
- 写し身が写せる攻撃の範囲

§30 のとおり、WORK 9 では決定していない。
