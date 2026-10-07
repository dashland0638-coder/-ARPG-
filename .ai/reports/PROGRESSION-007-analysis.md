# PROGRESSION-007 Analyzer report（HD-2 鍛冶屋施設の役割 / HD-3 ショップ を第一章へ反映）

| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-007 |
| Branch | `claude/chapter1-smith-shop-hd2-hd3`（最新 `main` = `c6d3259` から作成） |
| Persisted by | Agent（Orchestrator。AGENTS.md §5.2） |
| 日付 | 2026-10-05 |
| 出典 | Human Decision HD-2 / HD-3（2026-10-05）、UI-002-F 再監査 HD-2 / HD-3 / W-3、PROGRESSION-004 / 005 |

## 0. 判定の仕組み（FACT）

| 判定 | 実体 | 意味 |
| --- | --- | --- |
| 第一章（本編）か | `legacyGrowth()` = `legacyGrowthEnabled(state.testMode)`（`core/chapter1-rules.js`） | 本編 = 第一章は false。旧システム（Chapter 2 の基盤）はテストモードでだけ true。**旧セーブ判定ではない** |
| Test Mode | `state.testMode`（`14-hud-boot.js` の `state.testMode = (world==='training')` だけが書く） | 開発用。セーブしない |
| 施設があるか | `smithFacilityAvailable(state)` = `testMode ‖ smithJoined`（PROGRESSION-004） | 鍛冶士の加入前の本編は施設なし |
| 第一章後（Chapter 2） | 実行時の状態は存在しない（再監査 X-7） | 第一章後の機能は、いまはテストモードからだけ動く |

新しい章の判定は作らない（第一章の制限はすべて `legacyGrowth()`、施設の有無は `smithFacilityAvailable`）。

## 1. 施設の入口（PROGRESSION-004 のまま）

| 入口 | 本編・加入前 | 本編・加入後 | テストモード |
| --- | --- | --- | --- |
| 鍛冶士の前の I キー・十字キー下・インタラクト（`toggleAppraisal` / `nearbySmith`） | 開かない（`smithFacilityAvailable`） | 開く | どこでも開く |
| 仮設の作業台（`buildTavern`） | 建たない | （鍛冶士・金床・炉） | 加入前は建つ |
| 洋館のチェックポイント（`useCheckpoint`） | 回復だけ | 開く | 開く |

## 2. 施設の中身（鑑定所 `#appraisal-overlay`）

| タブ / 機能 | 処理 | 本編（第一章）の現在 | HD-2 / HD-3 |
| --- | --- | --- | --- |
| 装備品: 装備する / 外す / 最強装備 | `equipItem` / `unequipSlot` / `equipBestGear` | 使える（武器種の制限 `weaponUsableBy`） | 許可 ✔ |
| 装備品: 性能表示・比較 | `renderGearPanel` / `gearCompareChip` | 出る（Item Level は出さない） | 許可 ✔ |
| 装備品: 売却 / まとめて売却 | `sellEquipment` / `sellAllJunk` | 使える | 許可 ✔ |
| 装備品: 鑑定 / 一括鑑定 | `identifyEquipment` / `identifyAllEquipment` | 処理側で止まっている（WI-A3）・ボタンなし | 禁止 ✔ |
| 武具強化 | `renderEquipPanel`（`EQUIP_COSTS`） | タブも DOM（`#ap-panel-equip`）も無い（呼ばれても何もしない） | 禁止 ✔ |
| ステータス配分 | `stat` タブ | 隠れている（`LEGACY_AP_TABS`） | 禁止 ✔ |
| 奥義の環（スフィア盤・やり直し `respecSphere`） | `sphere` タブ | 隠れている（`LEGACY_AP_TABS`）。効果も 0（PROGRESSION-001） | 禁止 ✔ |
| スキル: Skill 1 | `skill1VariantUsable` | 職業の既定に固定・押せない（PROGRESSION-005） | 第一章だけ固定 ✔ |
| スキル: Skill 2 | `skill2AltAvailable` | 閃きで習得、別の技へ付け替え不可（PROGRESSION-003） | ✔ |
| スキル: 必殺技 | `ultAltAvailable` | 固定（PROGRESSION-003） | ✔ |
| スキル: スキル3 / パッシブ（能力の強化・仲間を雇う） | `LEGACY_SKILL_SUBTABS` | サブタブが出ない | 禁止 ✔ |
| 鍛造・クラフト | — | 処理が存在しない | 禁止 ✔（作らない） |
| ランダム装備生成 | `maybeDropEquipmentAt` / `maybeGrantEquipmentInstant` | 本編は止まっている（WORK 12.1）。異空間の報酬は PR #33（PROGRESSION-006） | 禁止 ✔ |
| **商店（購入）** | `shop` タブ・`renderShopPanel` の `[data-shop]` クリック | **本編でもタブが出て、薬草・魔力の雫・宿の一夜をゴールドで買える** | **HD-3: 禁止 ✘** |

### 2.1 ショップのコードパス（全数）

- 入口は鑑定所の「商店」タブだけ（`index.html` の `.ap-tab[data-tab="shop"]`）。NPC・メニュー・イベントからの購入経路は無い（`state.inventory.gold -=` の全 6 か所を確認: 鑑定 2・スフィアのやり直し・武具強化（DOM なし）・撤退の損失・商店）。
- 購入処理は `renderShopPanel` の中のクリック処理（`SHOP_ITEMS` の 3 品）。直接呼べる購入関数は無い。

## 3. 表示の文言（W-3）

| 場所 | 現在 | 問題 |
| --- | --- | --- |
| インタラクト（`updateInteractPrompt`、02） | 加入後「🔨 鍛冶士と話す(鑑定・強化)」 | 本編に鑑定・強化は無い（誤解を招く） |
| 画面の見出し（`index.html` `.appraisal-title`） | 「鑑定所」 | 本編に鑑定は無い |
| メニューの操作説明（`index.html`） | 「鑑定所(鍛冶士の前で)」 | 同上 |

## 4. 根本原因

第一章の制限は「旧ハクスラ系のタブ」（`LEGACY_AP_TABS = ['stat','sphere']`）と「処理の入口」（鑑定・ドロップ・成長値）に入っているが、商店は旧システムとして扱われておらず、本編でもタブと購入処理がそのまま動く。施設の文言は鑑定所時代のまま。

## 5. 方針（Planner への入力）

- 商店を、本編で隠すタブ（`LEGACY_AP_TABS`）に加える（ステータス配分・スフィア盤と同じ仕組み）。表示だけでなく、`renderShopPanel` は本編では購入ボタンを作らず、クリック処理でも同じ判定で止める（処理側のゲート）。テストモードは従来どおり。
- 文言: 本編は「鍛冶屋」「🔨 鍛冶士と話す(装備の管理)」。テストモードは従来の「鑑定所」「(鑑定・強化)」のまま（テストモードには鑑定・強化がある）。新しい世界観の台詞は書かない。
- 装備・売却・スキル画面は変更しない（既に HD-2 を満たしている）。
- Skill 1 の固定は第一章（本編）の規則であることを `core/chapter1-rules.js` と記録に明記する（第一章後は習得済みの技から自由に編成する本来の仕組み。いまはテストモードで動く）。
- 決めないこと: 第一章後（Chapter 2）のショップ・育成の仕様、商店の品ぞろえ・価格、第一章の消耗品の入手量。
