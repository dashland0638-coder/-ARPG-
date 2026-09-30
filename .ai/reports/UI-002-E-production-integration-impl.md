# UI-002-E Production Integration Implementation Record

- Task: UI-002-E（Production Integration WI-EPI-1〜WI-EPI-6）
- Role: Implementer（記録のみ）。この report は HDE-EPI-07 の転記記録（traceability record）で、新しい仕様を追加しない
- Branch: `claude/ui-002-e-production-integration-impl`（base `dd2e96c25f61a6e5e7f48cd50fb2dd79d49ec978`）
- Reviewer PASS・Human Final Confirmation は未実施

## 1. 転記元（HDE-EPI-07）

| 項目 | 値 |
|---|---|
| Catalog path | `.ai/reports/UI-002-E-swordsman-svg-catalog/glyphs.js` |
| Catalog SHA-256 | `dbb7e5145b9d11c3b3d1a89222e6f9bf62102767b40205dbb40150840ed9a330` |
| Catalog git blob（`git hash-object`、参考） | `8825c2c17728343b9496f7014a557fd4c76edf9f` |
| Catalog の git 上の状態 | 未 commit（untracked）。本 Production Integration の commit には含めない |
| 転記方式 | path の `d` 文字列を production へ転記（HDE-EPI-03 / 07）。production から catalog を import しない |

## 2. 対応表

Production 側の定義はすべて `src/core/ui-icons.js` の `UI_GLYPHS`（`export const UI_GLYPHS`、62 行目）。

| semantic ID | Catalog 側の定義（`glyphs.js`） | Production 側の定義 | path 数 | 一致 |
|---|---|---|---|---|
| `weapon.greatsword` | `key: "badge"`（13 行目）、source `revision-18.html #badge` | `src/core/ui-icons.js` `UI_GLYPHS['weapon.greatsword'].paths`（63 行目） | 4 | 一致 |
| `attack.greatsword` | `key: "atk"`（27 行目）、source `revision-16.html #atk-16a` | `src/core/ui-icons.js` `UI_GLYPHS['attack.greatsword'].paths`（72 行目） | 5 | 一致 |
| `skill.warrior.retreat` | `key: "retreat"`（42 行目）、source `revision-18.html #r18-c` | `src/core/ui-icons.js` `UI_GLYPHS['skill.warrior.retreat'].paths`（82 行目） | 3 | 一致 |
| `skill.warrior.crushSlash` | `key: "crush"`（55 行目）、source `revision-16.html #crush-16a` | `src/core/ui-icons.js` `UI_GLYPHS['skill.warrior.crushSlash'].paths`（90 行目） | 3 | 一致 |

- **4 glyph の path は承認済み catalog と一致することを確認済み。**
  - 確認方法: catalog の各エントリ（`semanticId` で対応付け）の `paths` 配列と、`UI_GLYPHS[id].paths` を文字列の配列として完全一致で比較した（4 つとも true）。
  - 同じ比較は `tests/unit/ui-glyphs.test.js` の「path は承認済み SVG catalog の d 文字列と同じ(転記)」にもある。catalog が checkout に無い場合、このテストは skip になる。
- catalog の `key: "ult"`（`semanticId: null`、`visualTestId: "PILOT_ULTIMATE_WARRIOR"`）は転記していない（HDE-EPI-10）。

## 3. Production 側の関連定義（参考）

| 定義 | 場所 |
|---|---|
| glyph の取得 `uiGlyph(id)` | `src/core/ui-icons.js` 104 行目 |
| semantic ID の解決 `resolveSwordsmanGlyphIds(input)` | `src/core/ui-icons.js` 123 行目 |
| inline SVG の生成と fallback `setGlyphOrText(el, glyphId, fallbackText)` | `src/legacy/parts/14-hud-boot.js` 358 行目 |
| runtime の key を集める `currentSwordsmanGlyphIds()` | `src/legacy/parts/14-hud-boot.js` 384 行目 |

## 4. 既知の実装上の注意点（上位職の判定）

本 Production Integration の追加仕様ではなく、現在の実装についての注意点として記録する。

- FACT: 上位職の除外は `state.job` の値で行っている（`src/legacy/parts/14-hud-boot.js` の `currentSwordsmanGlyphIds()` が `job: state.job` を渡し、`src/core/ui-icons.js` 126 行目で `o.job` があれば全 null）。
- FACT: 上位職が実際に有効か（`recomputeStats` の `jobActive`）を見る新しい判定は、今回実装していない。
- INFERENCE: 本編（上位職が無効）で `job` の値が残っている古い save を読むと、HUD の表示は剣士なのに glyph が出ず、既存の emoji 表示へ fallback する可能性がある。
- 表示の意味を保つ fallback 側の挙動なので、今回は変更しない。
- `jobActive` を使う判定への変更は、仕様変更として別 Task が必要。
