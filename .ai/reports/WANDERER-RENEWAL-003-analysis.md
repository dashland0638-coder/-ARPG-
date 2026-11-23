# WANDERER-RENEWAL-003 Analysis

## Task
WANDERER-RENEWAL-003 / PR #145 の影の旅人の攻撃モーションを少し遅くして重量感を出す。CI の失敗（ui-production-glyphs.spec.js:226）を直す。完了後に PR #145 を base `claude/road-visual-003-r3-7` へ merge（Human 許可済み）。

## Current Behavior（FACT）
- 本人の動作の長さ（`core/wanderer-style.js` の `WANDERER_CLIP_DUR`）: 突き上げ 0.40 / 薙ぎ払い 0.40 / 握砕 0.62 / 影残し 0.40 / 影渡り 0.50 / 回避攻撃 0.34 / 切り上げ 0.38 / 影送り 0.80 秒。キーフレームは割合（0〜1）で書かれているので、長さを伸ばすと溜め（`e:'slow'`）と余韻（`e:'settle'`）がそのまま伸びる
- 影の手の当たる時刻（`WANDERER_STRIKE.delay`）0.16 / 0.14 / 0.18 秒、握砕の握り潰し 0.45 秒（`WANDERER_ECHO_LAG`）は、本人の動作の長さと別に管理されている（`planStrike` / `queueWandererEcho`）→ 動作を遅くしても判定の時刻は変わらない
- 決めの姿勢の実時間（割合 × 長さ）: 突き上げ 0.12 / 薙ぎ払い 0.12 / 握砕の腕を広げる 0.149・握り込み 0.347 秒 → 影の手（0.16 / 0.14 / 0.18 / 0.45）より早い。握砕の握り込みは握り潰しより 0.10 秒早い
- 影の手の動き（17 の `applyShadowHand`）: 当たった後に留まる・沈む時間は 0.14〜0.30 秒
- 攻撃間隔 `atkCooldown` 0.44 は動作の長さと独立（コンボの次の段は動作の途中でも出る）。回避は共通のロール（0.2 秒）＋ `DODGE_MOTION.wanderer`
- 必殺技の当たる時刻は `ULT_IMPACT_FRAC.ult`（0.45）× 長さ、上限 0.30 秒（`ULT_MAX_IMPACT_DELAY`）。長さを伸ばしても上限で止まり、`ultClipWarp` が見た目の接触を当たる瞬間へ合わせる
- CI: `ui-production-glyphs.spec.js` の影の旅人のテストが Skill 1 のアイコンを `⬇️`（剣士の切り下がり）、Skill 2 を `🌀` と期待。実装は `WANDERER_SKILL1.icon` 🌘 / `WANDERER_SKILL2.icon` 👥（WANDERER-RENEWAL-001 で定義、docs/CHARACTERS.md・PR に記載）→ テストの期待値が古い

## Scope of Change
1. `WANDERER_CLIP_DUR` を 2〜3 割伸ばす（キーフレームの割合は変えない）。決めの姿勢が影の手の時刻に重なる値を選ぶ。握砕の握り込みの割合を定数にして 0.45 秒に重ねる
2. 影の手の当たった後の留まり・沈みを少し長く（当たる時刻は変えない）。必殺技の倒れ込みを少しゆっくり
3. 回避は本人の型（`DODGE_MOTION`）を変えない（軽快さを維持）。小さな手の沈みだけわずかに長く
4. `ui-production-glyphs.spec.js` の期待値を 🌘 / 👥 へ（剣士の glyph が出ないことの検査は残す）

## Risks
- 動作が長くなると `state.swinging` の間（移動速度 0.45 倍・Skill 2 の受付不可）が伸びる → 伸び幅を 2〜3 割に抑える
- 変更禁止事項（倍率・間隔・範囲・大きさ・造形・配色・セーブ・閃き・他職）に触れない

## Unknowns
ESCALATION 候補なし。
