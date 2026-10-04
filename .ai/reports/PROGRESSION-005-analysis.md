# PROGRESSION-005 Analyzer report（第一章の Skill 1 を職業固有の既定の技に固定）

| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-005 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| 基準 SHA | `a395f3e`（UI-002-F 再監査） |
| Persisted by | Agent（Orchestrator。AGENTS.md §5.2） |
| 日付 | 2026-10-04 |
| 出典 | UI-002-F 再監査 W-1 / X-5、Human Decision C-1（第一章の Skill 1 は職業固有の既定の技に固定し、プレイヤーは付け替えられない）。HD-1（各職の具体的な技）は未決定 |

## 1. Skill 1 の経路（FACT）

| 経路 | 場所 | 本編での現在の挙動 |
| --- | --- | --- |
| 技の解決（発動・溜めリング・ボタンの icon・glyph） | `activeSkill1Variant()`（12-progression-ui.js、PROGRESSION-003） | `state.skillChoice` の技が `skill1VariantUsable` なら使う。基本の技（解放条件なし）は常に可 → **保存された基本の技（ダッシュ・回転・バリア等）がそのまま使われる** |
| 鑑定所「スキル1」サブタブ | `renderSkillPanel` | 基本の技を一覧し、すべて `data-variant` 付き（押せる）。見出し「スキル(専用ボタン・付け替え可能)」 |
| 付け替えの書き込み | `bindSkillPanelHandlers` の `.ap-charge-card[data-variant]` | **`state.skillChoice` を書き換える**（表示だけでなく値が変わる。次のセーブで保存される）。Loadout Change Rule の鍵（`loadoutLockState`）は探索中なら通る |
| ロード | `09-save-load.js` | 保存された `skillChoice` を復元（その職の技で、未解放の新技・上位職の技でなければ） |
| 主人公の交代 | `switchProtagonist`（14-hud-boot.js） | `defaultSkill1For(新しい職)` に置く |
| 新規開始・テストモード開始 | 14-hud-boot.js | `retreat`（新規開始はその後の交代処理・`defaultSkill1For` で職の既定） |
| `skillChoice` を書く他の所 | スフィア盤のリセット（`unlockKey` 付きなら `retreat`。テストモードの画面） | 本編では到達しない |
| 施設 | PROGRESSION-004 | 鍛冶士の加入前は施設が無いので、付け替えの画面に入れるのは加入後だけ |

## 2. 根本原因

PROGRESSION-003 は「解放条件の付いた技（新技・上位職の技）」だけを本編で止めた。基本の技（解放条件なし）は本編でも常に使える扱いのままで、鑑定所のスキル1 サブタブも基本の技を付け替えられる。C-1（固定）の判定がどこにも無い。

## 3. 方針（Planner への入力）

- 判定は PROGRESSION-003 の `skill1VariantUsable(v)` に入れる: 本編（`!legacyGrowth()`）では「職業の既定の技（`defaultSkill1For(職)`）」だけが使える。どの技が既定かは `defaultSkill1For` / `CHAPTER1_SKILL1` のまま（HD-1 で後から差し替えられる）
- これで `activeSkill1Variant()`（戦闘・HUD）とスキル1 サブタブの一覧が、同じ判定で既定の技だけになる
- サブタブ: 本編ではカードを押せない形（既存の Skill 2・必殺技の「固定」と同じ見た目: `data-*` 無し・`cursor:default`）、見出しを「固定」（既存の文言の切り替え）
- セーブの値（`skillChoice`・`unlockedSkill1Alt`・`job`）は書き換えない。押せるカードが無いので、本編で `skillChoice` が書き換わる経路は交代（既存の仕様）だけになる
- テストモード: `legacyGrowth()` が true の分岐は変更前と同じ（基本の技は常に可、新技・上位職の技は解放・転身済みなら可、付け替え可能）
- 決めないこと: どの技を正式な Skill 1 とするか（HD-1）。剣士・盗賊・弓師が `retreat` 系なのは既存の既定のままで、正式とは記録しない
