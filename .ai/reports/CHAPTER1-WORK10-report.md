# WORK 10 レポート ―― Chapter 1 進行基盤・主人公交代・固定シナリオ順序

対象: **Chapter 1 本編の進行**（森の洋館 → 宵待ちの村 → 幽霊船 → 時計塔 → 道）
前段: WORK 2〜8（宵待ちの村）/ WORK 9（Chapter 1 全体回帰）

Status: **DONE**（道のシナリオ本体は未実装 ―― §9 / §16）

---

## 0. 結論（先に）

Chapter 1 は「個別シナリオの集合」から、**一本につながった進行**になった。

- 新規開始 → 剣士ひとり → 洋館しか開かない
- 洋館クリア → 酒場へ戻った所で **魔法使いが主人公**／剣士が支援AI → 次は宵待ちの村
- 宵待ちの村クリア → **弓師**＋魔法使い → 幽霊船
- 幽霊船クリア → **盗賊**＋弓師 → 時計塔
- 時計塔クリア → 一覧に **「道」が『次はここ』として現れる**（中身はまだ無い）

そして **Chapter 用の runtime state も save field も 1 つも増えていない**。

---

## 1. 既存進行システム調査結果

指示書 §3 の検索語で既存実装を洗った。結果は以下。

### Character

| 探したもの | 実装での姿 | 場所 |
| --- | --- | --- |
| current / active character | `selectedClass`（共有スコープの変数）＋ `state.classDef` | `01-character-creation.js` |
| playable | 「操作しているクラス」を表す独立した state は無い。`selectedClass` がそれ | ― |
| support / companion / ally | `companion`（買う使い魔）と **`guestCompanion`（章のゲスト）** の2系統 | `08-loot-equipment.js:974-1120` |
| party | パーティ配列は無い。プレイヤー＋最大2体の随伴という形 | `13-update-loop.js:1405` |
| character selection | 作成画面は廃止済み。`applyChapterCast(n)` が固定キャストを流し込む | `01-character-creation.js:241` |

### Scenario

| 探したもの | 実装での姿 |
| --- | --- |
| `SCENARIO_DEFS` | `12-progression-ui.js:1449-` の配列。`{key,name,levelRange,minLevel,desc,unlocked}` |
| scenario unlock | `unlocked`（＝**実装済みか**のフラグ）と `minLevel`（レベル条件）の2段構え |
| scenario selection | `renderScenarioList()` → 出撃ボタン → `launchScenario(key)` |
| `launchScenario` / `launchScenarioNow` | フェード → ワールド構築。進行の判断はしていない |
| scenario clear | `onBossDefeated()` が `state.scenarioClears[key]++`（`12-progression-ui.js:1030`） |
| finishScenario 相当 | `returnToTown()` → `returnToTownNow()`（`12-progression-ui.js:1264`） |

### Tavern

| 探したもの | 実装での姿 |
| --- | --- |
| tavern / return to tavern | `buildWorld('tavern')` を `returnToTownNow()` が呼ぶ |
| tavern state | 専用 state は無い。`state.smithJoined` のような**個別のフラグ**で酒場の中身が変わる |
| tavern NPC / conversation | 酒場の主人（`BARTENDER_POS` の近くで KeyF）、鍛冶士、影の案内人 |
| character join | **既存の「登場」の作法**＝`state.smithJoined` を立てて `buildTavern()` が本人を建てる |

### Save

`09-save-load.js` の `snapshot()`。今回関係するのは既にある2つだけ:

- `selectedClass` / `selectedGender` / `selectedPersonality` … 主人公
- `scenarioClears: {key: 周回数}` … **どこまで進んだか**
- `guestClassKey` … 支援AIのクラス（#41 で枠だけ用意されていた）

### 既存の固定データ

`CHAPTER_CAST`（`01-character-creation.js:229`）が Chapter 1 の正式順序を
そのまま持っている ―― 主人公・性別・性格・**支援に回る直前主人公**・担当ダンジョン。

---

## 2. 採用した既存 state

**新設 0。使ったのは既にセーブされている次の2つだけ。**

| 使った既存 state | 役割 |
| --- | --- |
| `state.scenarioClears` | 進行そのもの（何段目か） |
| `selectedClass` | いま操作している主人公（交代したかの判定） |

書き込む先も既存のものだけ:

| 書き込む先 | いつ |
| --- | --- |
| `selectedClass` / `selectedGender` / `state.classDef`（`applyChapterCast`） | 交代時 |
| `state.guestClassKey` | 交代時（＝支援AIのクラス） |

`state.chapter` / `chapterState` / `chapterProgress` / `chapterProgression` は
**1件も作っていない**（`grep` 結果は §15）。

---

## 3. Playable character 導出

新モジュール `src/core/chapter1-progress.js`（state・THREE・scene 非依存）。

```js
export const CHAPTER1_ORDER = ['mansion', 'duskvillage', 'ghostship', 'clocktower', 'road'];

export function stageFor(clears){
  let n = 0;
  while(n < CHAPTER1_ORDER.length && cleared(clears, CHAPTER1_ORDER[n])) n++;
  return n + 1;
}
```

`stageFor` は **頭から連続でクリアした数**で段を数える。途中を飛ばした記録が
あっても前に詰めない ―― 章は一本道で、飛び級は無い。

段が決まれば主人公は `CHAPTER_CAST` を**読むだけ**で出る:

```js
export function resolveCast(stage, cast){
  const here = cast[stage];
  if(here.classKey) return {classKey: here.classKey, guestClassKey: here.guestClassKey || null, ..., playable: true};
  const prev = cast[stage - 1];          // 5人目はまだ戦闘キットが無い
  return {classKey: prev.classKey, guestClassKey: prev.guestClassKey || null, ..., playable: false};
}
```

| `scenarioClears` | 段 | 主人公 | 支援 |
| --- | --- | --- | --- |
| （なし） | 1 | 剣士 | なし |
| mansion | 2 | 魔法使い | 剣士 |
| ＋duskvillage | 3 | 弓師 | 魔法使い |
| ＋ghostship | 4 | 盗賊 | 弓師 |
| ＋clocktower | 5 | （盗賊のまま据え置き） | （弓師のまま） |

5段目で主人公をすり替えないのは、**5人目に戦闘キットが無い**ため
（`CHAPTER_CAST[5].classKey === null`）。操作できないキャラクターに
すり替わる事故を防いでいる。支援も据え置きにしてある ―― 表どおりに
`guestClassKey:'rogue'` を採ると、主人公も支援も盗賊という妙な並びになるため。

## 4. Support character 導出

支援AIは **既存の GUEST COMPANION（#41）をそのまま使った**。新しい Support AI
システムは作っていない。

- 実体の構築: `buildGuestCompanion(classKey)`（`08-loot-equipment.js`）
- AI: 既存の追従／索敵／接敵／攻撃／再配置（`13-update-loop.js`）
- state: `state.guestClassKey`（既存・保存済み）
- 実体の同期: `syncAlliesToState()`（既存。`state` と画面上の実体を突き合わせる）

今回足したのは「`state.guestClassKey` を進行から毎回導いて書く」ことだけ。

```js
function chapter1GuestKey(){
  const cast = chapter1CastNow();
  const key = cast && cast.guestClassKey;
  return (key && CLASSES[key]) ? key : null;
}
```

`#41` の時点では「`state.guestClassKey` を実際に書き換える経路が今は無い」と
コメントにあった（テストモードの『同行ゲスト』だけが唯一の経路だった）。
その経路が本編に繋がったので、コメントも更新してある。

## 5. Scenario progression

`renderScenarioList()` の解放判定だけを変えた。

```js
const mainline    = isMainlineScenario(sc.key);
const storyLocked = mainline && !mainlineAvailable(sc.key, state.scenarioClears);
const levelLocked = sc.unlocked && !mainline && state.level < sc.minLevel;
const isNext      = mainline && sc.key === nextKey;
```

```js
export function mainlineAvailable(key, clears){
  if(!isMainline(key)) return true;      // 章の外はここでは決めない
  if(cleared(clears, key)) return true;  // 周回はいつでも
  return key === nextScenario(clears);
}
```

表示は4通り:

| 状態 | 表示 |
| --- | --- |
| 次に行く所 | 見出しに `▶ 次はここ` |
| まだ来ていない本編 | `🔒 その前に行くところがある` |
| 実装されていない（道） | `🌒 ここから先は、まだ誰も歩いていない` |
| 章の外でレベル不足 | `🔒 Lv.N以上で挑戦可能`（従来どおり） |

**クリア済みの本編へはいつでも戻れる**（★の育成・周回のため）。

## 6. Tavern transition

交代が起きるのは **`returnToTownNow()` の中の1行だけ**。

```js
closeAllDoors();
state.sortied = false;
advanceChapter1Cast({rebuild:true});   // ← ここ
repositionAlliesToPlayer();
```

- ダンジョンの中では絶対に入れ替わらない（呼ばれるのが酒場帰還時だけ）
- **撤退・全滅で戻ったときは何も起きない** ―― `scenarioClears` が増えていないので
  `shouldSwitchCast()` が false を返す
- 何度酒場へ戻っても交代は各シナリオの直後に一度きり

`advanceChapter1Cast()` がやること（`14-hud-boot.js`）:

```js
function advanceChapter1Cast(opts){
  if(state.testMode) return false;                 // テストモードの構成は進行に触らせない
  const cast = chapter1CastNow();
  if(!shouldSwitchCast(selectedClass, cast)){ state.guestClassKey = chapter1GuestKey(); return false; }
  const prevClass = selectedClass;
  if(!applyChapterCast(chapter1Stage(state.scenarioClears))) return false;
  recomputeStats();
  if(opts.rebuild){ /* player リグを組み直す */ }
  grantStarterGear();  /* 武器だけ差し替え、防具は引き継ぐ */
  recomputeStats();
  state.hp = state.maxHp; state.mp = state.maxMp;
  state.skillChoice = 'retreat'; state.skillCD = 0; state.skill2CD = 0;
  resetWeaponState(state.weapon);
  state.guestClassKey = chapter1GuestKey();
  if(opts.rebuild){ syncAlliesToState(); refreshTouchControls(); playChapter1JoinScene(prevClass, selectedClass); }
}
```

引き継ぐもの: **レベル・所持金・スフィア・インベントリ・★・防具**
持ち替えるもの: **クラスと武器・Skill 1 の選択**

武器はクラス固有なので必ず差し替える（魔法使いが古びた剣を持ったままには
しない）。前の武器は捨てずに持ち物に残る。**防具は引き継ぐ** ―― 前の主人公が
拾った胸当てを「擦り切れた〜」へ戻してしまうのは、レベルも所持品も引き継ぐ
という この交代の考え方に合わないため。

原案の「主人公と一緒に育っていく」に合わせてある ―― 交代のたびに
Lv.1 からやり直しにはならない。

### 登場の一幕

メニューから「魔法使いを選択してください」とは**させていない**（§10）。
酒場へ戻ると、既存の会話システムで4行だけ流れる:

```
酒場の主人: 連れが増えたな。そっちの嬢ちゃんは、さっきから湖の話ばかりしている。
魔法使い  : ……失礼。人のいない村の話を聞いて、確かめに行きたくなっただけです。
剣士      : ひとりで行く気か。
魔法使い  : いいえ。ついて来てくださるなら、助かります。
```

弓師・盗賊にも同じ長さで1本ずつ。どれも**行き先を説明しない**
（行き先は従来どおり酒場の主人＝シナリオ一覧が出す）。

## 7. Level 条件の扱い

`minLevel` / `levelRange` は**消していない**。変えたのは本編の解放条件だけ。

| 用途 | WORK 10 後 |
| --- | --- |
| 推奨レベル表示（`levelRange`） | **そのまま**（全シナリオで表示） |
| 敵の強さ・★倍率 | **そのまま**（`scenarioStars` 系は無変更） |
| 章の外（神殿・水路・温室…）の解放 | **そのまま `minLevel`** |
| **Chapter 1 本編の解放** | **`minLevel` を見ない**（前のシナリオを終えたか） |

つまり「Lv.26 になったから宵待ちの村」は無くなり、「洋館を終えたから宵待ちの村」
になった。宵待ちの村のカードには今も `推奨レベル: 26〜85(★8)` と出る。

## 8. CHAPTER_CAST 確認

**1文字も変更していない**（`git status` に `01-character-creation.js` は出ない）。

| フィールド | 意味 | 今回の扱い |
| --- | --- | --- |
| `chapter:` | Chapter 1 内の Scenario 1〜5（WORK 9 で指摘済みの命名のずれ） | **改名しない**（§32） |
| `classKey` | その段の主人公 | 読むだけ |
| `gender` / `personality` | 固定の性別・性格 | 読むだけ |
| `guestClassKey` | その段の支援（＝直前主人公） | 読むだけ |
| `dungeonKey` | 担当ダンジョン | `CHAPTER1_ORDER` と一致することを unit test で固定 |

進行状態としては一切使っていない ―― `chapter1-progress.js` が返すのは
「表の何段目か」だけで、表そのものは読み取り専用。

## 9. Road 接続

**Road: C ―― シナリオ本体は未実装。入口までの接続のみ完成。**

`SCENARIO_DEFS` に1件だけ追加した:

```js
{key:'road', name:'🌒 道', levelRange:'—', minLevel:1, unlocked:false,
 desc:'時計塔を出たあと、二人はまだ名の無い道を歩くことになる。その先で誰と会うのかは、まだ誰も知らない。'},
```

`unlocked:false` なので**出撃ボタンは出ない**。時計塔クリア後、一覧に

```
🌒 道  ▶ 次はここ
🌒 ここから先は、まだ誰も歩いていない
```

として並ぶところまで。マップ・敵・ボス・5人目の詳細・道中イベント・
Chapter 1 終了演出は **勝手に決めていない**（§31、要判断事項 §16）。

## 10. Save / Load

**新しい save field は 0。save schema は無変更**（`09-save-load.js` の
`snapshot()` / `loadGame()` の項目は 1 件も増減していない）。

復元の筋道:

```
セーブの scenarioClears
  → stageFor()
  → resolveCast(stage, CHAPTER_CAST)
  → selectedClass / guestClassKey
```

`finishEnteringGame()`（つづきから）では、`buildPlayer()` の**前**に
`advanceChapter1Cast({rebuild:false})` を呼んでいる ―― セーブに残っている
クラスは「その時に操作していた主人公」だが、正しい主人公は進行から決まるため。
交代の一幕はここでは出さない（酒場へ戻った時のものなので）。

E2E で確認済み: 洋館クリア済みのセーブに `selectedClass:'warrior'` が
入っていても、続きから入ると主人公は**魔法使い**になる。

## 11. Test Mode

**無変更**（§29）。

- `beginTestMode()` の中身も、Scenario Test Mode の地点ジャンプも触っていない
- 本編側の `advanceChapter1Cast()` は先頭で `if(state.testMode) return false;`
  ―― 進行がテストモードの構成を上書きしない
- テストモード画面の「同行ゲスト」の選択も従来どおり優先される
- 逆に、本編コードに「テストモードならこうする」という分岐は足していない
  （§37。足したのは上記の1行のガードだけで、これは
  「テストモードでは進行を触らない」という本編側の約束）

## 12. E2E

### `tests/chapter1-progression.spec.js`（新規・8件）

**8 passed**。実際にダンジョンを踏破するのは この環境の FPS では現実的でないため、
既存の `save-load.spec.js` / `duskvillage.spec.js` と同じく
**クリア済みのセーブを仕込んで「つづきから」入る**形にしてある。

| # | 内容 | 結果 |
| --- | --- | --- |
| 1 | 新規開始は剣士ひとり、洋館だけ出撃可（村・船は不可） | ✓ |
| 2 | 洋館クリア後 → 魔法使い | ✓ |
| 3 | 村クリア後 → 弓師 | ✓ |
| 4 | 船クリア後 → 盗賊 | ✓ |
| 5 | 時計塔クリア後 → 道が「次はここ」・出撃不可 | ✓ |
| 6 | 交代後のセーブに主人公と支援が残る／入り直しても同じ（§36 Test 6） | ✓ |
| 7 | クリア済みへはいつでも戻れる（周回） | ✓ |
| 8 | 章の外（神殿・水路・温室）は今までどおりレベルで開く | ✓ |

テスト6では `chapter` / `chapterProgress` が**保存されていないこと**も固定している。

### 全体

（下の「全体 E2E」節に記録）

## 13. 実機確認

この環境は SwiftShader ソフトウェア描画で 3〜7fps しか出ないため、
「通しで洋館→村→船→塔を踏破する」実機確認はできていない（WORK 8/9 と同じ）。
代わりに、**進行から導かれた顔ぶれが実際に画面に出ているか**を各段で確認した。

| 段 | HUD の主人公 | セーブの `guestClassKey` | ミニマップの支援ドット(#ffd27a) | 画面 |
| --- | --- | --- | --- | --- |
| 洋館クリア後 | 魔法使い Lv.30 | `warrior` | **found** | `test-results/work10-02-mage-warrior.png` |
| 村クリア後 | 弓師 | `mage` | **found** | `test-results/work10-03-archer-mage.png` |
| 船クリア後 | 盗賊 | `archer` | **found** | `test-results/work10-04-rogue-archer.png` |

スクリーンショットでは、交代後の主人公（帽子とローブの魔法使い）が
酒場に立ち、その傍らに支援AIの人型が出ている。

**確認できたこと**
- 主人公が進行に従って自然に交代している（メニュー選択なし）
- 直前主人公が支援AIの実体として実際に構築・配置されている
- 入り直しても同じ顔ぶれに戻る

**確認できていないこと** → §14

## 14. 未確認項目

| 項目 | 理由 |
| --- | --- |
| 実際にボスを倒して酒場へ戻る経路での交代（`rebuild:true` 側） | 低FPSで通し踏破ができない。ロード側（`rebuild:false`）と `returnToTownNow` の呼び出しは同じ関数で、差は「リグを組み直すか」「一幕を出すか」だけ |
| 交代の一幕（会話4行）の実表示 | 同上。文面と分岐は実装済みだが、画面で読んだのはまだ |
| 支援AIが**戦闘中に**実際に攻撃する様子（魔法使い＋剣士 等の組み合わせ） | 既存の GUEST COMPANION AI をそのまま使っており、AI 自体は #41 の時点で動作確認済み。今回の変更は「どのクラスを立てるか」だけ |
| 幽霊船・時計塔を主人公交代後の顔ぶれで踏破したときのバランス | 通し踏破ができないため。引き継ぎ（レベル・装備・スフィア）は実装済み |
| 道の中身 | 未実装（§9） |

## 15. 既知問題

| # | 内容 | 影響 |
| --- | --- | --- |
| 15-1 | `CHAPTER_CAST` の `chapter:` フィールドは実際には「Chapter 1 内の段」を指す（WORK 9 で指摘済み） | 命名のみ。§32 により改名していない |
| 15-2 | 全滅直後に「HP半減で酒場へ」の処理が走るが、交代が起きる段ではその後 `state.hp = state.maxHp` で上書きされる | 交代は**クリア帰還時にしか起きない**ため実害なし（全滅では `scenarioClears` が増えない） |
| 15-3 | 段5（時計塔クリア後）は主人公・支援とも段4のまま据え置き | 5人目の戦闘キットが未実装なため意図的（§3）。道の実装時に解消される |
| 15-4 | 低FPS由来の E2E flake（WORK 8/9 から継続） | ゲームコードの問題ではない。§39 の C/D |

## 16. 要判断事項

| # | 内容 |
| --- | --- |
| 16-1 | **道（Scenario 5）の仕様が未確定。** マップ・敵・ボス・5人目の詳細・道中イベント・Chapter 1 終了演出、いずれも正式仕様に記載が無いため、こちらでは決めていない（§31）。入口の説明文だけは既存の作風に合わせて書いたので、正式な文面が決まり次第差し替えたい |
| 16-2 | **5人目「影の旅人」の扱い。** 現状は「クラスが無いので主人公は盗賊のまま据え置き」。正式には (a) 5人目を操作可能クラスとして実装する のか、(b) 道では盗賊のまま進み5人目は同行者なのか、判断が要る |
| 16-3 | **Chapter 1 完了後の遷移先。** `chapter1Complete()` は実装してあるが、呼び出し先（Chapter 2 への入口）が無い。道の実装と合わせて決まるもの |
| 16-4 | **周回時の顔ぶれ。** 今は「クリア済みの本編へ戻るときも、主人公は最新の段のまま」。洋館へ戻っても魔法使いで入る。原案が「その章の主人公で入り直す」を想定しているなら変更が要る（★育成のための周回なので、現状のほうが自然と判断した） |
| 16-5 | **`CHAPTER_CAST.chapter` の改名**（WORK 9 の 20-1 から継続。§32 により据え置き） |

---

## 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `src/core/chapter1-progress.js` | **新規**。進行の式（state 非依存） |
| `src/legacy/concat-plugin.js` | 上記の import |
| `src/legacy/parts/14-hud-boot.js` | `advanceChapter1Cast()` / `chapter1CastNow()` / `chapter1GuestKey()` / `playChapter1JoinScene()` / `CHAPTER1_JOIN_LINES`、`finishEnteringGame` での呼び出し |
| `src/legacy/parts/12-progression-ui.js` | `returnToTownNow` での呼び出し、`renderScenarioList` の解放判定、`SCENARIO_DEFS` に `road` を追加 |
| `src/legacy/parts/08-loot-equipment.js` | コメント更新のみ（GUEST COMPANION の説明） |
| `src/legacy/parts/09-save-load.js` | コメント更新のみ（`guestClassKey` の説明） |
| `src/styles/main.css` | `.sc-next` の見出し用スタイル |
| `tests/unit/chapter1-progress.test.js` | **新規**（24件） |
| `tests/chapter1-progression.spec.js` | **新規**（8件） |

ゲームの既存システム（AI・カメラ・武器・戦闘・セーブ形式）には手を入れていない。

## なぜ新しい Chapter runtime state を作らずに実現できたか

**「いま何段目か」は、すでにセーブされている情報から一意に決まるから。**

必要なのは次の3つだけだった:

1. **どこまで進んだか** … `state.scenarioClears`（既存・保存済み）
2. **各段の顔ぶれ** … `CHAPTER_CAST`（既存の固定設計データ・不変）
3. **正式な順序** … `CHAPTER1_ORDER`（定数。`CHAPTER_CAST` の `dungeonKey` と同じ並び）

1 は「進行」そのもので、2 と 3 は「表」―― 表は変わらないのだから、
**進行 ＋ 表 → 顔ぶれ** は毎回その場で計算できる。保持する必要がない。

```
scenarioClears  →  stageFor()  →  resolveCast(stage, CHAPTER_CAST)  →  主人公 / 支援 / 次のシナリオ
  （保存済み）        （式）            （読むだけの表）
```

もし `state.chapter = 2` のような変数を作っていたら、

- `scenarioClears` と `state.chapter` の**二重管理**になり、片方だけ壊れる事故が起きる
- セーブに項目が増え、旧セーブとの互換の面倒がひとつ増える
- 「どちらが正しいのか」を決める規則がさらに要る

いずれも、既にある情報から導けば最初から起きない。派生させた値
（`selectedClass` / `state.guestClassKey`）はセーブにも入るが、それは
**結果の写し**であって進行そのものではない ―― 壊れても次のロードで
同じ式が同じ答えを出して上書きする。

`chapter1-progress.js` が何も保持しない純関数の集まりなのも同じ理由で、
unit test が式そのものを固定できる（24件）。
