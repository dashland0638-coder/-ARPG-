# UI-002-E Production Integration Plan

- Task: UI-002-E（Swordsman の承認済み 4 glyph の production integration）
- Role: Planner（READ ONLY。書いたのは本 report だけ）。実装・Human Approval・commit / push はしていない。
- 状態: Swordsman Pilot approved / Formal SVG technical specification approved / Swordsman SVG catalog approved / **Production integration pending** / **Plan: WAITING FOR HUMAN APPROVAL**
- 表記: **FACT** = コード・既存 report から確認した事実（`path:line`）/ **HD** = Human Decision（既存）/ **PROPOSAL** = Planner の提案（Human Approval まで未確定）

---

## 1. Baseline

- FACT: ブランチ `claude/ui-002-c1-impl` @ `dd2e96c25f61a6e5e7f48cd50fb2dd79d49ec978`。`src/`・`index.html`・`tests/` に未 commit の変更なし。
- 入力:
  - Analyzer report: `.ai/reports/UI-002-E-production-integration-analysis.md`（§1〜§20 + Human Decisions §21〜§23）。remote には未 push（Artifact Handoff は未成立。AGENTS.md §5.2 の Persistence は Human が行う）。
  - Task: `.ai/tasks/UI-002-E.md`（Status: DRAFT。HD-EPI-01〜08 を記録済み）
  - SVG catalog: `.ai/reports/UI-002-E-swordsman-svg-catalog/`（`glyphs.js` / `index.html`）
  - 正式 SVG 仕様: `.ai/reports/UI-002-E-swordsman-pilot-formal-svg-spec.md`
- 追加で確認した FACT（Analyzer の後）:
  - legacy parts は `src/legacy/concat-plugin.js` の `HEADER` で core モジュールを import してから連結される（`concat-plugin.js:27-60`。例: `import { CRUSH_SLASH, … } from '../core/crush-slash.js'`）。
  - Vite の `base` は production で `/-ARPG-/`（GitHub Pages）（`vite.config.js:10, 18`）。
  - `npm run test:unit` = `node --test`、`npm test` = `playwright test`（`package.json`）。
  - 影の旅人の `state.classDef`: `recomputeStats` で `own.kit` があると `Object.assign({}, CLASSES[kitKey], own, {key: kitKey, charKey: selectedClass})` になる。つまり **`key` は `'warrior'` のまま、`charKey: 'wanderer'` が付く**（`12-progression-ui.js:1744-1746`、`cdef = Object.assign({}, base, …)` `:1816`）。剣士は `own.kit` が無く、`charKey` を持たない。
  - 上位職（戦騎士）に転身しても `key` は `'warrior'` のままで、`name` / `icon` だけ差し替わる（`12-progression-ui.js:1822-1825`、`state.job`）。

## 2. Human Decisions

| ID | 決定（要約） |
|---|---|
| HD-EPI-01 | 承認済み glyph だけを SVG 化。未承認の技・武器・職業は現行表示を維持。SVG と emoji / text の混在を許可 |
| HD-EPI-02 | Ultimate は正式 semantic ID 決定まで対象外。`PILOT_ULTIMATE_WARRIOR` を production で使わない |
| HD-EPI-03 | `#btn-attack` に glyph 用 DOM 構造を追加。「攻撃」の文字は当面残す |
| HD-EPI-04 | UI semantic ID と glyph 定義は既存 `ui-icons.js` を拡張して管理。本番参照化・SVG 配置・読み込み方式は Planner で設計。catalog の `glyphs.js` をそのままコピーすることは決定していない |
| HD-EPI-05 | 基本サイズ: Weapon Badge = 現行 18px の器 / Action buttons = 24px / Skill・Ultimate = 24px。48px は検証用。既存 CSS の px 値を変更しない |
| HD-EPI-06 | スキル選択画面・閃きトーストは対象外。HDE-E77 は維持 |
| HD-EPI-07 | 影の旅人は対象外。`state.classDef.key` だけを根拠に Swordsman glyph を表示しない |
| HD-EPI-08 | 既存 FAIL / FLAKY の分類を変更しない。新規 FAIL / 既存 FAIL / FLAKY / NOT_RUN を区別。テストを弱めない |

対象 glyph（HD）: `weapon.greatsword` / `attack.greatsword` / `skill.warrior.retreat` / `skill.warrior.crushSlash` の 4 つ。渾身の斬撃は対象外。

## 3. Architecture（PROPOSAL）

```
ゲーム側の既存 state（変更しない）
  state.classDef.key / .charKey, state.job,
  weaponDefFor(...).key, state.skillChoice, activeSkill2Def(...).key
        │  （既存の key を読むだけ）
        ▼
src/core/ui-icons.js（拡張。純粋関数・データのみ。state / DOM / THREE に依存しない）
  ├─ UI_ICONS（既存の意味名 → emoji 表。変更しない）
  ├─ UI_GLYPHS（新: semantic ID → { paths }。承認済み 4 つだけ）
  └─ resolveSwordsmanGlyphIds({ classKey, charKey, job, weaponKey, skillChoice, skill2Key })
       → { weapon, attack, skill1, skill2 }（各 semantic ID または null）
        │
        ▼
legacy HUD（14-hud-boot.js / 12-progression-ui.js）
  └─ setGlyphOrText(el, glyphId, fallbackText)
       glyphId があれば <svg viewBox="0 0 24 24"><path fill="currentColor" d=…/></svg>
       無ければ従来どおり el.textContent = fallbackText（emoji / 文字）
        │
        ▼
Button Component（既存の .action-btn / .weapon-badge。外形・状態は変更しない）
```

- game logic 側（`CHARGE_VARIANTS_BY_CLASS` / `CRUSH_SLASH` / `CLASSES` / `WEAPON_TYPES` の定義）には UI glyph 情報を足さない（HD-EPI-04）。解決は `ui-icons.js` の中で、既存の key を入力として行う。
- `ui-icons.js` は `src/core/` の作法（state・THREE・DOM に依存しない）を守る。DOM を作る関数は legacy 側に置く。

## 4. SVG loading strategy candidates（PROPOSAL。最終選択は Human Approval まで確定しない）

| 方式 | 内容 | Vite build / GitHub Pages | legacy concat | 変更量 | 評価 |
|---|---|---|---|---|---|
| **(a) JS 内の path データ + 実行時に inline SVG を生成**（推奨案） | `ui-icons.js` に path の `d` 文字列を持ち、HUD 側で `createElementNS` で `<svg>` を作る | JS モジュールに含まれるだけで、URL・`base` パスの問題が無い | `concat-plugin.js` の `HEADER` に import 1 行を足せば legacy parts から使える（既存 core モジュールと同じやり方） | 小 | 既存 C2 Prototype（`ui-proto-icons.js`、`claude/ui-002-c2-impl`）と同じ系統。`currentColor` で色を受けられる |
| (b) `index.html` に inline SVG を直接書く | 各ボタンの中に `<svg>` を静的に置く | 問題なし | 不要 | 中 | 装備・職業で切り替えるには結局 JS が要る。HD-EPI-01 の「未承認は現行表示」と両立させにくい |
| (c) 外部 SVG ファイル（`public/` 等）を `<img>` / `<use href="file.svg#id">` で参照 | 別ファイル | `base: /-ARPG-/` を URL に含める必要がある。`<img>` だと `currentColor` が効かない | 不要 | 中 | 色を semantic token から与える仕様（formal SVG spec §6.1 #3）と相性が悪い |
| (d) SVG sprite（`<symbol>` を `index.html` に 1 回置き、`<use href="#id">` で参照） | 1 か所に定義 | 問題なし | 不要 | 中 | 同じ id を持つ要素が文書に 1 つだけになる制約。catalog では id を持たない方針（formal SVG spec §6.2 の提案）と相性が要確認 |

- PROPOSAL: (a) を推奨。path データは catalog の `glyphs.js` から **同じ `d` 文字列を `ui-icons.js` へ転記**する（ファイルのコピーではない。HD-EPI-04）。転記元の SHA-256 を実装結果に記録する（OQ-4）。

## 5. Semantic mapping（PROPOSAL）

`resolveSwordsmanGlyphIds(input)` の入力はすべて既存の値（新しい game logic ID は作らない）。

| semantic ID | 解決条件（すべて満たすとき） | 入力の出所（FACT） |
|---|---|---|
| `weapon.greatsword` | 剣士本人（`classKey === 'warrior'` かつ `charKey` が無い）かつ `weaponKey === 'greatsword'` | `state.classDef.key` / `.charKey`、`weaponDefFor(state.classDef.key, state.usingAltWeapon).key` |
| `attack.greatsword` | 同上 | 同上 |
| `skill.warrior.retreat` | 剣士本人 かつ `skillChoice === 'retreat'` | `state.skillChoice`（Skill1 の variant key） |
| `skill.warrior.crushSlash` | 剣士本人 かつ `skill2Key === 'crushSlash'` | `activeSkill2Def(state.classDef.key).key` |

- slot（`btn-charge` / `btn-skill2`）ではなく、装備中の技の key から解決する（HDE-E39 / E40 / E76）。
- `charKey` があれば（影の旅人）すべて `null`（HD-EPI-07。`key` だけを根拠にしない）。
- 上位職（`state.job`）転身中の扱いは OQ-1（既定の提案: `null` にして現行表示を維持）。
- 条件を満たさない場合は `null` → 現行表示（§10）。

## 6. Weapon Badge（PROPOSAL）

- `updateWeaponBadge()`（`14-hud-boot.js:353-360`）で、`el.textContent = def.icon` の代わりに `setGlyphOrText(el, ids.weapon, def.icon)` を使う。`el.title = def.name` と `.secondary` の切り替えは変えない。
- 器は現行の 18×18px（`main.css:652-656`）のまま（HD-EPI-05）。既存の px 値は変えない。`.weapon-badge svg` の大きさは新しい CSS ルールとして追加する（値は OQ-2。器の内側に収まる大きさ）。
- alt 武器（`spear`）は glyph 未承認なので現行表示（HD-EPI-01）。
- `updateHUD()` から毎回呼ばれるので、表示中の glyph ID を要素に覚えておき、変わったときだけ DOM を作り直す。

## 7. Attack（PROPOSAL）

- `index.html:194` の `#btn-attack` に、glyph 用の子要素（例: `<span class="action-glyph" id="btn-attack-glyph" aria-hidden="true"></span>`）を追加し、既存の「攻撃」の文字は残す（HD-EPI-03）。文字は既存のテキストノードのまま、または `<span class="action-label">攻撃</span>` に包む（OQ-3）。
- glyph は `ids.attack`（`attack.greatsword`）のときだけ SVG を入れ、`null` のときは空のまま（現行の見た目 = 文字だけ）。
- 表示タイミング: 職業の反映（`12-progression-ui.js:1832-1842` の並び）と武器の持ち替え（`updateWeaponBadge` と同じ契機）。
- glyph サイズは 24px（HD-EPI-05）。ボタン 82px の中で glyph と文字をどう並べるか（縦並び等）は新しい CSS ルールで行い、既存の `#btn-attack` の px 値（`main.css:797`）は変えない。

## 8. Skill1 / Skill2（PROPOSAL）

- Skill1: `updateSkillButtonIcon()`（`12-progression-ui.js:2473-2478`）で、`icon.textContent = variant.icon` の代わりに `setGlyphOrText(icon, ids.skill1, variant.icon)`。
- Skill2: `12-progression-ui.js:1840-1842`（職業の反映）と `:2328-2329`（閃き時）の 2 か所で、`textContent = def.icon` の代わりに `setGlyphOrText(icon, ids.skill2, def.icon)`。
- glyph サイズ 24px（HD-EPI-05）。ボタン寸法（`#btn-charge` 44px / `#btn-skill2` 42px、`main.css:799-800`）は変えない。
- 未承認の技（dash / spin / barrier / skill2alt、他職業）は現行 emoji のまま（HD-EPI-01）。

## 9. Ultimate exclusion（HD-EPI-02）

- `#btn-ult-icon` の書き換え（`12-progression-ui.js:1837-1838`）は変更しない。`cdef.ult.icon`（`💥` 等）のまま。
- `ui-icons.js` の `UI_GLYPHS` に渾身の斬撃を登録しない。`PILOT_ULTIMATE_WARRIOR` を production のどのファイルにも書かない。
- テストで「Ultimate の表示が変わっていない」ことを確認する（§13）。

## 10. Fallback（PROPOSAL）

- `setGlyphOrText(el, glyphId, fallbackText)`:
  - `glyphId` が `UI_GLYPHS` にあれば、`el` の中身を `<svg>` 1 つに置き換える。
  - 無ければ（`null`・未知の ID・データ欠落）、`el` の中身を従来どおり `textContent = fallbackText` にする。
  - どちらの場合も `el` の属性・クラス（ボタンの状態）には触れない。
- fallback は表示だけの分岐で、game logic（技の選択・発動・クールダウン）を変えない。
- 例外を投げない（未知の ID は fallback）。

## 11. State handling（PROPOSAL / FACT）

- FACT: Pressed = `.pressed`（`10-input.js:104-120`）、未習得 = `.locked`、Skill3 未装着 = `.unequipped`、Cooldown = `--cd-pct` のリング（`14-hud-boot.js:720-733`）、Ready = `#btn-ult.ready`（`14-hud-boot.js:810`）。いずれもボタン要素側で、icon の中身は変えていない。
- PROPOSAL: glyph は icon の子要素の中だけに置き、状態のクラス・リング・`#ult-btn-cd` には触れない。glyph の path は状態で変えない（formal SVG spec §6.1 #7）。
- glyph の色は `fill="currentColor"` で親の `color`（`.action-btn` の `color:var(--text)`、`main.css:777-783`）を受ける。新しい semantic color は作らない。

## 12. PC / Touch（FACT / PROPOSAL）

- FACT: PC とタッチは同じ DOM（`#touch-controls` 内の `.action-btn`）を共有する。タッチ（パッド操作）では `.active`、それ以外のプレイ中（PC を含む）は `.gamepad-min`（action ボタンは `opacity:0.9; pointer-events:none` の表示専用）（`10-input.js:23-36`、`main.css:749-758`）。
- PROPOSAL: glyph は同じ要素に入るので、PC・タッチの両方に同じ glyph が出る。表示・配置の条件（D Task の範囲）は変えない。
- E2E で、タッチ相当（`.active`）と PC 相当（`.gamepad-min`）の両方で glyph の DOM があることを確かめる（§13）。

## 13. Test plan（PROPOSAL）

**unit（`npm run test:unit`、`tests/unit/`）**

| テスト | 内容 |
|---|---|
| U-1 semantic mapping | `resolveSwordsmanGlyphIds`: 剣士 + greatsword + retreat + crushSlash → 4 つの ID。spear → weapon / attack が null。dash / spin / barrier → skill1 null。skill2alt → skill2 null。他職業 → すべて null |
| U-2 影の旅人 | `charKey: 'wanderer'`（`key: 'warrior'`）→ すべて null（HD-EPI-07） |
| U-3 上位職 | `job` がある場合の扱い（OQ-1 の決定に合わせる） |
| U-4 glyph データの仕様 | `UI_GLYPHS` のキーが承認済み 4 つだけ / 各 `d` が図形コマンドと数字だけ / Ultimate と `PILOT_ULTIMATE_WARRIOR` を含まない / freeze |
| U-5 既存 | `tests/unit/ui-icons.test.js` の既存の検査（`UI_ICONS`・`uiIconGlyph`）はそのまま通る（弱めない） |

**E2E（`npm test`、新しい spec を追加。既存 spec は弱めない）**

| テスト | 内容 |
|---|---|
| E-1 Weapon Badge | 剣士で `#weapon-badge` に `svg[viewBox="0 0 24 24"]` があり、`path` が `fill="currentColor"`。`title` は「大剣」のまま |
| E-2 Attack | `#btn-attack` に glyph の SVG があり、「攻撃」の文字も残っている |
| E-3 Skill1 / Skill2 | 剣士の retreat → `#btn-charge-icon` が SVG。dash に付け替えると `⚡`（既存 `auto-combo.spec.js:205` と同じ）に戻る。崩し斬り習得後 `#btn-skill2-icon` が SVG |
| E-4 fallback | 魔法使いなど他職業では、`#btn-charge-icon` / `#btn-skill2-icon` / `#weapon-badge` が従来の emoji のまま（既存 `chapter1-progression.spec.js:197`、`chapter1-dusk-basics.spec.js:101` と整合） |
| E-5 Ultimate unchanged | `#btn-ult-icon` が SVG を含まず、従来の文字（`cdef.ult.icon`）のまま |
| E-6 PC / touch DOM | `.active` と `.gamepad-min` の両方の状態で E-1〜E-3 の glyph が存在する |
| E-7 state | `.pressed` / `.locked` の付け外し・`--cd-pct` の変化・`#btn-ult.ready` の前後で、glyph の `innerHTML` が変わらない |
| E-8 影の旅人 | テストで影の旅人の状態を作れる場合、glyph が出ず現行表示であること（作れない場合は NOT_RUN として理由を記録） |

**既存テストと分類（HD-EPI-08）**

- `npm run build` / `npm run test:unit` / `npm test` を実行し、結果を「新規変更による FAIL / 既存 FAIL（mansion-escort / execution-break）/ FLAKY（job-traits）/ NOT_RUN」に分けて記録する。既存の分類は上書きしない。
- 既存の期待値を変える必要が出た場合は、仕様変更に基づく変更だけとし、理由を記録する。テストを弱めない。

## 14. Work Items（PROPOSAL）

### WI-EPI-1 — `ui-icons.js` の glyph registry と semantic mapping

- Purpose: 承認済み 4 glyph の path データと、既存の key から semantic ID を解決する純粋関数を `ui-icons.js` に置く（P1 / P2 / P3）。
- Scope: `UI_GLYPHS`（4 つ）・`resolveSwordsmanGlyphIds`・glyph データの検証用の小さな関数。既存の `UI_ICONS` / `UI_ICON_NAMES` / `uiIconGlyph` は変更しない。
- Files To Change: `src/core/ui-icons.js`、`tests/unit/ui-icons.test.js`（追加のみ）または新しい unit テストファイル。
- Files Not To Change: §17 の全ファイル。特に game logic の定義。
- Dependencies: なし（OQ-1・OQ-4 の決定が要る）。
- Implementation notes: path の `d` 文字列は catalog `glyphs.js` から転記（ファイルのコピーではない）。`state` / DOM / THREE に依存しない。すべて freeze。
- Test requirements: U-1〜U-5。
- Acceptance criteria: 4 ID だけが登録され、Ultimate / `PILOT_ULTIMATE_WARRIOR` を含まない。解決関数が §5 の条件どおり（影の旅人・他職業・未承認の技で null）。既存の unit テストが変更なしで通る。
- Out of Scope: DOM 生成、HUD への反映、CSS。

### WI-EPI-2 — legacy への接続と DOM ヘルパー

- Purpose: legacy parts から `ui-icons.js` を使えるようにし、`setGlyphOrText` を用意する（P1 本番参照化 / P2 / P8）。
- Scope: `concat-plugin.js` の `HEADER` に import 1 行。HUD 側に `setGlyphOrText(el, glyphId, fallbackText)`（`createElementNS` で `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">` と `<path fill="currentColor">` を作る。変更が無いときは作り直さない）。
- Files To Change: `src/legacy/concat-plugin.js`（HEADER の import のみ）、`src/legacy/parts/14-hud-boot.js`（ヘルパーの追加）。
- Files Not To Change: 他の legacy parts の既存関数の中身（この WI では呼び出しを変えない）。
- Dependencies: WI-EPI-1。
- Implementation notes: legacy parts を ES Module に分離しない（AGENTS.md §13）。ヘルパーは例外を投げず、未知の ID は fallback。
- Test requirements: `npm run build` が通る。WI-EPI-3〜5 の E2E で間接的に確認。
- Acceptance criteria: build 成功。ヘルパーを呼んでいない現状では表示が変わらない。
- Out of Scope: 各ボタンへの反映。

### WI-EPI-3 — Weapon Badge

- Purpose: 剣士の Weapon Badge に `weapon.greatsword` を表示する（P4）。
- Scope: `updateWeaponBadge()` の表示部分を `setGlyphOrText` に置き換え。`.weapon-badge svg` の大きさの CSS ルールを追加。
- Files To Change: `src/legacy/parts/14-hud-boot.js`、`src/styles/main.css`（新しいルールの追加のみ。既存の px 値は変えない）。
- Files Not To Change: `.weapon-badge` の既存宣言（18px の器・`font-size`・`border-radius`）、`weaponDefFor`・`WEAPON_TYPES`。
- Dependencies: WI-EPI-2。
- Implementation notes: `title` と `.secondary` は変えない。alt 武器は現行表示。
- Test requirements: E-1、E-4（Badge 部分）、既存 `ui-foundation.spec.js:57-60` が変更なしで通る。
- Acceptance criteria: 剣士 + greatsword で SVG、それ以外で現行の emoji。器の既存スタイルが同じ。
- Out of Scope: 器のサイズ変更、Portrait（`#hud-portrait-icon`）。

### WI-EPI-4 — Attack button

- Purpose: `#btn-attack` に glyph 用 DOM を追加し、`attack.greatsword` を表示する（P5）。
- Scope: `index.html` の `#btn-attack` に glyph の子要素を追加（「攻撃」は残す）。表示を反映する呼び出し。glyph と文字を並べる CSS ルールの追加。
- Files To Change: `index.html`（`#btn-attack` の中身だけ）、`src/legacy/parts/12-progression-ui.js` または `14-hud-boot.js`（反映の呼び出し）、`src/styles/main.css`（新しいルールの追加のみ）。
- Files Not To Change: `#btn-attack` の既存の px 値（`main.css:797`）、`.action-btn` の既存宣言、input（`10-input.js`）の攻撃入力。
- Dependencies: WI-EPI-2。
- Implementation notes: glyph 24px（HD-EPI-05）。glyph が null のときは空の子要素で、見た目は現行と同じ。
- Test requirements: E-2、E-5 と同じ spec で「攻撃」の文字が残ることを確認、E-6、E-7（Pressed）。
- Acceptance criteria: 剣士で glyph + 「攻撃」、他職業で「攻撃」だけ。押下（`.pressed`）の動きが変わらない。
- Out of Scope: 「攻撃」の文字の削除、ボタンの大きさ・配置。

### WI-EPI-5 — Skill1 / Skill2

- Purpose: 剣士の retreat / crushSlash を SVG 表示する（P6）。
- Scope: `updateSkillButtonIcon()`・Skill2 の 2 か所（職業の反映・閃き時）の `textContent` 書き換えを `setGlyphOrText` に置き換え。`#btn-charge-icon svg` / `#btn-skill2-icon svg` の大きさの CSS ルールを追加。
- Files To Change: `src/legacy/parts/12-progression-ui.js`（上記 3 か所のみ）、`src/styles/main.css`（新しいルールの追加のみ）。
- Files Not To Change: `CHARGE_VARIANTS_BY_CLASS`・`CRUSH_SLASH`・`SKILL2_ALT_BY_CLASS` の定義（`icon` フィールドを含む）、スキル選択画面（`:3180-3290` 付近、HD-EPI-06）、閃きトーストの文字列（`:2325-2326`、HD-EPI-06）、`#btn-ult-icon` の書き換え（HD-EPI-02）。
- Dependencies: WI-EPI-2。
- Implementation notes: glyph 24px。ボタン寸法は変えない。未承認の技は emoji。
- Test requirements: E-3、E-4、E-5、E-6、E-7。既存 `auto-combo.spec.js:205`・`chapter1-progression.spec.js:197`・`chapter1-dusk-basics.spec.js:101`・`chapter1-skill2.spec.js` が変更なしで通る。
- Acceptance criteria: 剣士 retreat / crushSlash で SVG、それ以外で現行 emoji。Ultimate の表示が変わらない。
- Out of Scope: スキル選択画面・トースト・Skill3・Ultimate。

### WI-EPI-6 — 統合テストと回帰の記録

- Purpose: E2E（E-1〜E-8）を追加し、全体の回帰を HD-EPI-08 の分類で記録する（P9 / P10 / P11）。
- Scope: 新しい E2E spec 1 つ。`npm run build` / `npm run test:unit` / `npm test` の実行と記録。
- Files To Change: `tests/`（新しい spec の追加。必要なら `tests/helpers.js` へのヘルパー追加のみ）、Task の Implementation Result。
- Files Not To Change: 既存 spec の期待値（仕様変更に基づく場合を除く。変える場合は理由を記録）。
- Dependencies: WI-EPI-3・WI-EPI-4・WI-EPI-5。
- Implementation notes: 影の旅人の状態をテストで作れない場合は E-8 を NOT_RUN とし理由を書く。
- Test requirements: §13 全体。
- Acceptance criteria: 新規変更による FAIL が無い。既存 FAIL / FLAKY の分類が上書きされていない。
- Out of Scope: 既存 FAIL / FLAKY の修正。

## 15. Dependency graph

```
WI-EPI-1（ui-icons.js: registry + mapping + unit）
   │
   ▼
WI-EPI-2（concat HEADER import + setGlyphOrText）
   │
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
WI-EPI-3        WI-EPI-4       WI-EPI-5
Weapon Badge    Attack         Skill1 / Skill2
   │              │              │
   └──────────────┴──────────────┘
                  ▼
            WI-EPI-6（E2E + 回帰の記録）
```

- WI-EPI-3〜5 は互いに独立（同じ `main.css` に別々のルールを足すので、並行する場合は衝突に注意）。
- 承認単位は WI ごと（AGENTS.md §6 / §7.2）。

## 16. Files To Change（PROPOSAL）

| ファイル | WI | 変更の範囲 |
|---|---|---|
| `src/core/ui-icons.js` | 1 | `UI_GLYPHS` と解決関数の追加。既存の export は変更しない |
| `tests/unit/ui-icons.test.js`（または新しい unit ファイル） | 1 | 検査の追加のみ |
| `src/legacy/concat-plugin.js` | 2 | `HEADER` に import 1 行 |
| `src/legacy/parts/14-hud-boot.js` | 2 / 3 | `setGlyphOrText` の追加、`updateWeaponBadge()` の表示部分 |
| `src/legacy/parts/12-progression-ui.js` | 4 / 5 | Attack の反映の呼び出し、Skill1 / Skill2 の 3 か所 |
| `index.html` | 4 | `#btn-attack` の中身（glyph の子要素） |
| `src/styles/main.css` | 3 / 4 / 5 | 新しいルールの追加のみ（既存宣言の px 値は変えない） |
| `tests/*.spec.js`（新規） / `tests/helpers.js` | 6 | 追加のみ |

## 17. Files Not To Change

- `basefile.html`（凍結）
- `src/styles/tokens.css`（新しい semantic color を作らない）
- `src/legacy/parts/10-input.js`（入力）、`09-save-load.js`（セーブ）
- game logic の定義: `01-character-creation.js`（`CLASSES`）、`11-combat-actions.js`（`WEAPON_TYPES`・`weaponDefFor`）、`12-progression-ui.js` の `CHARGE_VARIANTS_BY_CLASS` / `SKILL2_ALT_BY_CLASS` / `ULT_ALT_BY_CLASS` / `JOB_ULT_BY_JOB` の定義、`src/core/crush-slash.js`
- `#btn-ult-icon` の書き換え（Ultimate、HD-EPI-02）、スキル選択画面・閃きトースト（HD-EPI-06）
- `.action-btn` / `#btn-*` / `.weapon-badge` の既存宣言の px 値（HD-EPI-05）、D Task の配置・表示条件
- `.ai/reports/UI-002-E-swordsman-svg-catalog/`、`UI-002-E-swordsman-pilot-visual/`、formal SVG spec・catalog review の決定内容
- 既存 E2E / unit の期待値（仕様変更に基づく場合を除く）

## 18. Risks

- R1: 剣士で SVG、他職業・剣士の未承認技で emoji が混在する（HD-EPI-01 で許可済み。見た目のばらつきは既知）。
- R2: `updateHUD()` は頻繁に呼ばれる。glyph を毎回作り直すと負荷・ちらつきの原因になる → 変わったときだけ作る（WI-EPI-2）。
- R3: Weapon Badge の器 18px（`border` 1px を含む）に glyph を収めると、16px 前後になる。16px は承認済みの最小実用サイズだが、器との余白が小さい。
- R4: `#btn-attack` に glyph を足すと、82px のボタンの中の文字の位置が変わる（HD-EPI-03 で DOM 追加は決定済み。並べ方は OQ-3）。
- R5: `concat-plugin.js` の `HEADER` の変更は全 legacy parts に効く。import 名の衝突に注意。
- R6: 影の旅人の判定を `charKey` の有無で行う。将来 `kit` を使う別のキャラクターが増えた場合も同じく対象外になる（安全側）。
- R7: 上位職（戦騎士）転身中の扱いが未決定（OQ-1）。
- R8: E2E で影の旅人・上位職の状態を作れない場合、E-8 / U-3 の一部が NOT_RUN になる。

## 19. Open Questions（Human Approval 時に決める）

1. **OQ-1 上位職（戦騎士）**: 転身中（`state.job` あり、`key` は `'warrior'`）に Swordsman の glyph を出すか。既定の提案: 出さない（HD-EPI-01 の「未承認の職業は現行表示」に合わせる）。
2. **OQ-2 Weapon Badge の glyph の大きさ**: 器 18px の内側の glyph を何 px にするか（例: 14px / 16px）。HD-EPI-05 は「18px の器を基本」「16px でも成立」。既存 CSS の px 値は変えない。
3. **OQ-3 Attack の glyph と文字の並べ方**: 縦並び（glyph 上・文字下）/ 横並び / 文字をテキストノードのまま残すか `<span>` で包むか。
4. **OQ-4 path データの出所の固定方法**: catalog `glyphs.js` の `d` を転記し、転記元の SHA-256 を実装結果に記録する方法でよいか（HD-EPI-04 はファイルのコピーを決めていない）。
5. **OQ-5 SVG の読み込み方式**: §4 の (a) JS 内の path データ + 実行時の inline SVG 生成でよいか。
6. **OQ-6 アクセシビリティ**: SVG は `aria-hidden="true"` とし、意味は既存の文字（「攻撃」）・`title`（Weapon Badge の「大剣」）に任せる、でよいか。Skill ボタンには現在文字ラベルが無い（emoji が唯一の表示）。

## 20. Human Approval Required

- Plan 全体（§3〜§17）と各 WI（WI-EPI-1〜6）の承認。承認単位は WI ごと（AGENTS.md §6）。
- §4 の SVG 読み込み方式の最終選択（OQ-5）。
- §19 の OQ-1〜OQ-6。
- Persistence（commit / push の許可）とブランチ。現在は許可されていない。
- Task の `Status` は DRAFT のまま。Human が承認するまで、Implementation Approved の状態にしない。

## 21. Out of Scope

- Ultimate の semantic ID と production mapping（HD-EPI-02）
- 影の旅人の glyph・仕様（HD-EPI-07）、他職業の新しい glyph
- スキル選択画面・閃きトースト（HD-EPI-06）
- 新しい visual design、新しい game logic ID、新しい semantic color
- D Task の仕様変更（ボタンの配置・大きさ・表示条件）
- 実装・commit / push
