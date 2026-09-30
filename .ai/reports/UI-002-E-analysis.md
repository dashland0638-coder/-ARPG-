# UI-002-E Analysis

- Role: Analyzer（READ ONLY。書いたのは本ファイルのみ）
- Task: `.ai/tasks/UI-002-E.md`（Status: DRAFT。変更していない）
- Date: 2026-09-29
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）
- 調査対象:
  - 本番コード: `main` = `40644f3ab3589fc2d73cd4d62bc3f60c9ab867d4`（作業ツリー `claude/ui-002-c1-impl` @ `02ba8db` と tree 一致。UI-002-D §15.2.1）
  - C2 Prototype: `claude/ui-002-c2-impl` @ `3e54909838e672a324584b2661bbcdfbef908c00`（C2 / V DONE 記録済み。main 未 merge）
  - C2 の撮影（2026-09-29。スクラッチ領域 `c2/`・`c2x/`）
- 表記: **FACT**（`path:line`）/ **INFERENCE**（推測）/ **DESIGN CONSTRAINT**（Human Decision から来る制約）/ **OPEN QUESTION**
- 対象アイコン: Attack / Skill 1 / Skill 2 / Ultimate / Heal / Weapon Badge

---

## 1. FACT

### 1.1 各操作のゲーム上の意味（Chapter 1）

| 操作 | 実体 | 根拠 |
| --- | --- | --- |
| Attack | 通常攻撃（押しっぱなしでオートコンボ）。入力は `#btn-attack`（`bindHoldButton`）・クリック・J | `10-input.js:127`、`13-update-loop.js` |
| Skill 1 | クラスごとの「チャージ技」variant。`state.skillChoice` で選ばれ、Chapter 1 の既定は `defaultSkill1For(classKey)` = 魔法使いのみ `phantom`（幻影歩法）、他は `retreat` | `chapter1-rules.js:42-53`、`12-progression-ui.js:2473-2478` |
| Skill 1（剣士 `retreat`） | 「切り下がり」: 強打を叩き込み、素早く後方へ引く（icon `⬇️`） | `12-progression-ui.js` CHARGE_VARIANTS_BY_CLASS.warrior.retreat |
| Skill 1（他の主人公） | 魔法使い `phantom` 幻影歩法 `👣`、弓師 `retreat` 五月雨射ち `🎯`、盗賊 `retreat` 影退きの一閃 `👤`、影の旅人は kit = warrior のため剣士と同じ | 同上、`01-character-creation.js:107`、`12-progression-ui.js:1739-1746` |
| Skill 2 | 閃くまで無い（`hasSkill2`）。剣士 = **崩し斬り**（`CRUSH_SLASH`、icon `🌀`）: 足元を崩して体幹を大きく削る。**回転斬りではない**（仕様 6-2 で禁止） | `chapter1-skills.js:25-28`、`12-progression-ui.js:2341-2344`、`crush-slash.js:1-20, 109-113` |
| Skill 2（他の主人公） | 盗賊 三連投げナイフ `🔪`、魔法使い 観測の灯 `🔍`（ダメージ無し）、弓師 爆弾投げ `💣`。スフィア盤の alt は Chapter 1 では使わない（INFERENCE: `unlockedSkill2Alt` はスフィア盤で解放） | `12-progression-ui.js:2278-2288` |
| Ultimate | クラスごとの必殺技。剣士 渾身の斬撃 `💥`、盗賊 影閃乱舞 `🌀`、魔法使い メテオフォール `☄️`、弓師 八方の矢 `🏹`、影の旅人 影送り `◐` | `01-character-creation.js:27, 40, 65, 83, 114` |
| Heal | 薬草（`usePotion`）。HP を最大 HP の 20% 回復。入力は V キー・`#loot-potion-btn` | `08-loot-equipment.js:469-487`、`09-save-load.js:331`、`12-progression-ui.js:1731` |
| Weapon Badge | 主人公の現在の武器（`weaponDefFor(kitKey, usingAltWeapon)` の `icon` / `name`） | `14-hud-boot.js:353-360`、`11-combat-actions.js:104-131` |

- Chapter 1 の主人公の順: 剣士 → 魔法使い → 弓師 → 盗賊 → 影の旅人（`chapter1-progress.js` 冒頭コメント）。

### 1.2 発動条件と状態

| 操作 | normal | pressed | disabled / 使用不可 | cooldown | ready |
| --- | --- | --- | --- | --- | --- |
| Attack | 常時 | CSS `:active` 等（部品ごと） | 未開始・ポーズ・会話・回避中・麻痺・処刑再生中 | 攻撃間隔（`atkCooldown`）。HUD 表示なし | — |
| Skill 1 | 常時表示 | 同上 | 上記＋空中（`blockedInAir`）・CD 中 | `state.skillCD`（満了 1.6 秒 × rank × sphere）。HUD はリング（`--cd-pct`） | — |
| Skill 2 | 閃くまで `.locked`（`display:none`） | 同上 | 上記＋未習得・CD 中・攻撃 / 溜め中・**MP 不足**（`hasRes`）・抜刀待ち | `state.skill2CD`（剣士 9 秒）。リング | — |
| Ultimate | 常時 | 同上 | 上記＋ゲージ不足・`ultLockT` 中・照準中 | ゲージ（`ultGauge` / 100）。HUD は ％（`#ult-btn-cd`）とリング | `ultReady()` = ゲージ満タンかつ `ultLockT<=0`。HUD は `#btn-ult.ready` の **常時パルス**（`@keyframes ultReady … infinite`） |
| Heal | チップ常時 | — | 未開始・ポーズ・会話・所持 0（拒否音＋トースト）・HP 満タン（トーストのみ、消費しない） | — | — |

根拠: `11-combat-actions.js:1019-1035, 1564-1569, 1754-1762`、`13-update-loop.js:196-239`、`12-progression-ui.js:2058`、`14-hud-boot.js:720-745`、`main.css:220, 228, 785-808`、`08-loot-equipment.js:469-487`。

- Skill 1 / Skill 2 は MP（`state.mp`、`resCost`）を消費する（`11-combat-actions.js:1564-1565`）。MP は HD-D10 で廃止の方針（別 Task 化の可能性あり）。

### 1.3 現在の UI アイコン実装

| 種類 | 所在 | 内容 |
| --- | --- | --- |
| 対応表 | `src/core/ui-icons.js`（C1） | 意味名 → 現在の emoji / 記号。**画面から参照されていない**（`tests/unit/ui-icons.test.js` だけが参照） |
| C2 Prototype | `src/core/ui-proto-icons.js`（C2 ブランチのみ） | インライン SVG 11 種（attack / weaponGreatsword / ultimate / heal / skill1 / skill2 / interact / hp / portrait / close / board）。`?dev=1&uiproto=1` の見本だけが使う |
| HUD の emoji（DOM テキスト） | `index.html:86-105, 179-195` と JS の書き換え | 肖像 `⚔`（クラス icon、`12-progression-ui.js:1832`）、武器バッジ（`WEAPON_TYPES.icon`）、Skill 1 / 2・Ultimate（各定義の `icon`、`12-progression-ui.js:1837-1841, 2473-2478`）、所持品チップ `☰ 🧪 🔷`、カメラ `⟲ ⟳` |
| 文字ラベル | `index.html` | 攻撃「攻撃」・`JUMP`・「回避」、HP / MP / スタミナのバーラベル |
| CSS の疑似要素 | `main.css` | インタラクト `✋`（`#interact-btn::before`）、処刑 `✦`、進めない分岐 `🔒`、会話の続き `▼` |
| Canvas | `14-hud-boot.js:541-640`（ミニマップ） | 図形（四角・菱形・円・宝箱形）と文字「!」。emoji なし |
| トースト / ログ | `spawnToast` 呼び出し（192 箇所） | 文頭に emoji（例 `🧪 薬草を使った!`） |

### 1.4 16〜24px の視認性（C2 撮影、DPR 1）

| アイコン | 16px | 20px | 24px | 根拠 |
| --- | --- | --- | --- | --- |
| Attack（大剣＋斬撃の弧） | 大剣は判別可。弧は剣と一体化 | 判別可 | 判別可 | `c2x/3c-dpr1-16-20-24-x8.png` |
| Ultimate（輪＋八芒星＋中心） | 星が潰れ「輪＋中心の点」 | 星がやや判別 | 星を判別可 | 同上 |
| Heal（薬瓶＋十字） | 瓶は判別可、十字はほぼ見えない | 十字がやや見える | 判別可 | 同上 |
| Skill 1（下向き矢印＋地面） | 形を維持 | 同 | 同 | 同上 |
| Skill 2（斜線で断たれた円） | 形を維持 | 同 | 同 | 同上 |
| 既存 emoji（`💥` `⬇️` `🌀` `🧪` `🗡️`） | 環境の emoji フォント依存（OS ごとに形が違う） | — | — | INFERENCE: emoji はフォントで描かれる |

- グレースケール: C2 の状態（pressed / disabled / cooldown / ready）は色なしで区別できた（`c2/pc-gray.png`）。

### 1.5 semantic color / token

| 意味 | token（C1 / C2） | 備考 |
| --- | --- | --- |
| Background / Surface / Border / Text / Muted | `--ui-surface-*` / `--ui-line` / `--ui-text` / `--ui-text-muted`（C1） | main にあり |
| Selected / Danger / Recovery / Special / Disabled / Outline | `--ui-selected` / `--ui-danger` / `--ui-recovery` / `--ui-special` / `--ui-disabled` / `--ui-outline`（**C2 で追加。C2 ブランチのみ・main 未 merge**） | すべて既存値の再利用 |
| HP / MP / スタミナのバー | `--ui-hp-*` / `--ui-mp-*` / `--ui-stamina-*`（C1） | バー専用 |
| Attack / Skill / Cooldown / Ready 専用 | **無い** | Ready は C2 では `--ui-special`、Cooldown は overlay（色 token なし） |
| 職業色 | `CLASSES` の `color` / `trim`、`src/render/player-palette.js` | UI token とは別（tokens.css の決まり） |

### 1.6 Weapon Badge の現状

| 事項 | FACT | 根拠 |
| --- | --- | --- |
| 表示 | 肖像の右下の小円（18px） | `index.html:86`、`main.css:652-658`、D0 実測 |
| 内容 | `weaponDefFor(kitKey, usingAltWeapon).icon`。剣士 🗡️（大剣）、盗賊 🗡️（双剣）、魔法使い 🪄（杖）、弓師 ➶（小弓）、影の旅人は kit = warrior → 🗡️（大剣） | `11-combat-actions.js:104-131`、`12-progression-ui.js:1745-1756` |
| 大剣と双剣 | **同じ emoji 🗡️**（形で区別できない） | 同上 |
| サブ武器 | `.secondary` で色だけ変わる（Chapter 1 はサブ武器を使わない） | `main.css:658`、`chapter1-rules.js:25-33` |
| 更新 | `updateHUD()` → `updateWeaponBadge()`。`animate()` の通常プレイ分岐でだけ動く | `14-hud-boot.js:353-372, 1147` |
| 「M」問題 | `index.html:86` の初期文字 `M` が、最初の通常フレームまで残る（導入会話中に表示、D0 §15.2.6）。修正は **UI-002-D WI-D1**（HD-D06、APPROVED・実装未着手） | D0 report、`.ai/tasks/UI-002-D.md` |
| 主人公交代 | 交代時は `refreshHudName()` だけが呼ばれ、バッジは次の通常フレームまで前の武器のまま（INFERENCE。実測は UNCONFIRMED、WI-D1 の範囲） | `14-hud-boot.js:1489` |
| 見えにくさ | `#hud-loot` がバッジの大部分を覆う（D0 §15.2.4）。配置は D の責務 | D0 report |

### 1.7 PC / タッチでの見え方

| 場所 | PC（非タッチ） | タッチ | 文字併記 |
| --- | --- | --- | --- |
| Action ボタン（Attack / Skill / Ultimate） | `.gamepad-min` で表示（押せない） | 押せる | 攻撃だけ文字（「攻撃」）。他はアイコン単体 |
| Heal（`#loot-potion-btn`） | 押せる | 押せる | 所持数の数字を併記 |
| Weapon Badge | 表示 | 表示 | 無し（title 属性に武器名） |
| 操作ヒント `#hud-hint` | 文字の一覧（「K 必殺技」等） | 非表示 | 文字のみ |
| メニュー・鑑定所のスキル一覧 | アイコン＋名前＋説明 | 同 | 文字を併記できる |

根拠: `10-input.js:23-35`、`main.css:749-808`、D0 §15.2。

---

## 2. INFERENCE

- I-1: C2 の Skill 1 アイコン「下向き矢印＋地面」は、剣士の Skill 1「切り下がり」の既存 emoji `⬇️` の形をなぞったもので、技の意味（強打して後方へ引く）とは一致しない。技の意味に合わせるなら「斬撃＋後退」を示す形が候補（1.1）。
- I-2: C2 の Skill 2「斜線で断たれた円」は、崩し斬りの意味（足元を崩す・体幹を削る）に近い。一方、現行の emoji `🌀` は回転を想起させ、仕様 6-2（回転斬りではない）と合わない（`crush-slash.js:1-20`）。
- I-3: Skill 1 / Skill 2 / Ultimate は主人公（クラス）ごとに中身が違う。アイコンを技ごとに作ると、Chapter 1 だけで最低 Skill 1 × 4 種、Skill 2 × 4 種、Ultimate × 5 種になる（影の旅人の Skill は剣士と共通）。「操作の種類」を示す共通の枠＋技ごとの中身、という 2 層の設計が必要になる可能性が高い。
- I-4: 小サイズで意味を保つには、中身の細部ではなく**外形（枠の形）**で操作の種類を区別する方が確実。C2 の「円 = Attack、角丸四角 = Skill、菱形 = Ultimate」は 16px でも崩れない（撮影で枠は判別できた）。
- I-5: Weapon Badge の 18px では大剣と双剣を emoji で区別できない。シルエットを分ければ区別できる見込み。
- I-6: MP が廃止されると（HD-D10）、Skill の「MP 不足で使えない」という disabled 条件は無くなる。E の状態設計は MP に依存しない方がよい。
- I-7: 既存の Ultimate ready の常時パルス（`main.css:228`）は、V（常時発光を使わない）と合わない。正式アイコンの適用時に扱いを決める必要がある。

## 3. DESIGN CONSTRAINT（Human Decision から）

| # | 制約 | 出所 |
| --- | --- | --- |
| DC-1 | Emoji / Unicode 記号を新規 UI アイコンに使わない。ゲーム固有のピクトグラム（厚い輪郭・塗りのシルエット・単純な幾何形状） | V-5 |
| DC-2 | 16px を最小実用サイズとして検討する。細部だけに意味を依存しない | V（C2 / V DONE 時の引き継ぎ） |
| DC-3 | 色だけで意味・状態を伝えない | V-6、引き継ぎ |
| DC-4 | Ultimate は、小サイズでも「特殊技 / Ultimate」と分かる形。Ready は明確な状態差＋満タン到達時の 1 回の反応。常時発光・ループアニメーションを使わない | 引き継ぎ、V-2、V-6 |
| DC-5 | Attack は大剣シルエットを維持する方向 | 引き継ぎ |
| DC-6 | Heal は瓶シルエットを維持し、回復を補助的に示す形を検討する | 引き継ぎ |
| DC-7 | Skill 1 / Skill 2 は C2 の仮アイコンを出発点とする | 引き継ぎ |
| DC-8 | UI semantic token を優先する。キャラクターパレットと UI の意味色を混同しない | V-7、AP-C2-02〜04 |
| DC-9 | D の HUD レイアウト・位置・ボタンサイズに踏み込まない。844×390 の仮配置は E の問題にしない | HD-D14、引き継ぎ |
| DC-10 | C2 の SVG を無条件に正式採用しない（必要なら簡略化・再設計） | Human の指示 |
| DC-11 | icon の形式（ファイル形式・配信方法）は E で調査・設計する。C2 のインライン SVG は Prototype 限定 | E Task、H-5 |

## 4. OPEN QUESTION

| # | 問い |
| --- | --- |
| OQ-1 | Skill / Ultimate のアイコンは「操作の種類」（Skill 1 枠・Skill 2 枠・Ultimate 枠）を示すのか、「技そのもの」（切り下がり・崩し斬り等）を示すのか。両方なら 2 層（外形＝種類、中身＝技）にするか |
| OQ-2 | 技ごとのアイコンを作る範囲: Chapter 1 の主人公 5 人分（Skill 1 / 2 / Ultimate）か、剣士だけか、Chapter 2 以降の技（スフィア盤・転身）も含むか |
| OQ-3 | Weapon Badge の範囲: Chapter 1 の武器 4 種（大剣・双剣・杖・小弓）か、サブ武器・上位職の武器も含むか |
| OQ-4 | Ultimate の小サイズでの意味: 菱形の外形だけで足りるか、中身を単純化した共通の紋章にするか、技ごとの中身にするか |
| OQ-5 | Heal の回復の補助形状: 十字をやめるか、別の形（葉・上向きの形・雫など）にするか |
| OQ-6 | 正式アイコンの形式: インライン SVG / SVG sprite / SVG ファイル / CSS。配信（ビルド）と `ui-icons.js` の対応表の関係 |
| OQ-7 | E で本番 HUD のアイコンを実際に差し替えるか、D3 / D4（Action Zone / Character Zone）と同時に差し替えるか。差し替えの順序と D の依存 |
| OQ-8 | C2 で追加した semantic token（C2 ブランチのみ）を main へ入れる手順（C2 の merge を先に行うか、E で改めて入れるか） |
| OQ-9 | 既存の Ultimate ready の常時パルス（`main.css:228`）を E で止めるか、D3 で扱うか |
| OQ-10 | トースト・ログ・メニュー・鑑定所の emoji（192 箇所のトースト等）を E の範囲に含めるか（E Task の Out of Scope「台詞・固有名詞の中の記号」との境界） |
| OQ-11 | MP 廃止（HD-D10）前に Skill の disabled 条件（MP 不足）をアイコン設計でどう扱うか |

## 5. 現行アイコン一覧（本番 = main）

| 対象 | 現在のアイコン | 種類 | 可変 |
| --- | --- | --- | --- |
| Attack | 文字「攻撃」 | テキスト | 固定 |
| Skill 1 | 剣士 `⬇️` / 盗賊 `👤` / 魔法使い `👣` / 弓師 `🎯` | emoji | クラス・選択で変わる |
| Skill 2 | 剣士 `🌀`（崩し斬り）/ 盗賊 `🔪` / 魔法使い `🔍` / 弓師 `💣` | emoji | クラスで変わる |
| Ultimate | 剣士 `💥` / 盗賊 `🌀` / 魔法使い `☄️` / 弓師 `🏹` / 影の旅人 `◐` | emoji / 記号 | クラスで変わる |
| Heal | `🧪` ＋所持数 | emoji | 固定 |
| Weapon Badge | 大剣・双剣 `🗡️` / 杖 `🪄` / 小弓 `➶` | emoji / 記号 | 主人公で変わる |
| 肖像 | 剣士 `⚔` / 盗賊 `🗡` / 魔法使い `✦` / 弓師 `➶` / 影の旅人 `◐` | 記号 / emoji | 主人公で変わる |

- 盗賊の Ultimate と剣士の Skill 2 が同じ `🌀`、大剣と双剣が同じ `🗡️`、弓師の肖像と小弓が同じ `➶` ―― 意味の違うものに同じ記号が使われている。

## 6. Skill の意味とアイコンの意味の対応表（剣士を中心に）

| 操作 | ゲーム上の意味 | 現行 emoji が示すもの | C2 アイコンが示すもの | 一致 |
| --- | --- | --- | --- | --- |
| Attack | 大剣の通常攻撃 | 文字 | 大剣＋斬撃 | C2 は一致 |
| Skill 1（切り下がり） | 強打して後方へ引く | `⬇️` 下向き矢印 | 下向き矢印＋地面（振り下ろし） | **どちらも弱い**（I-1） |
| Skill 2（崩し斬り） | 足元を崩し体幹を削る（回転ではない） | `🌀` 渦（回転） | 斜線で断たれた円 | 現行は**不一致**（I-2）、C2 は近い |
| Ultimate（渾身の斬撃） | 大範囲の強力な一撃 | `💥` 爆発 | 菱形＋八芒星の紋章（技の中身は示さない） | C2 は「特別」を示すだけ |
| Heal（薬草） | HP を 20% 回復 | `🧪` 試験管 | 薬瓶＋十字 | 概ね一致（16px で十字が消える） |
| Weapon Badge | 現在の武器（大剣） | `🗡️` 短剣 | 大剣シルエット | C2 は一致、現行は大剣と双剣が同形 |

## 7. 16px 視認性評価（まとめ）

| アイコン | 16px の評価 | 潰れる箇所 | 正式化時の注意 |
| --- | --- | --- | --- |
| Attack | 可 | 斬撃の弧が剣と重なる | 弧を省くか、剣から離す |
| Ultimate | **不可（細部）** | 八芒星の角・中心の石 | 外形と太い単純形で意味を持たせる（DC-4） |
| Heal | 可（瓶のみ） | 十字 | 十字を大きく / 別の補助形状（OQ-5） |
| Skill 1 | 可 | — | 意味との対応を見直す（I-1） |
| Skill 2 | 可 | 斜線（輪郭色）が細い | 斜線の太さを保つ |
| Weapon Badge（18px の枠内） | 大剣は可 | 柄頭・鍔 | 武器ごとの外形差を大きく（I-5） |

- stroke / fill: C2 は塗り（`fill:currentColor`）＋外側の輪郭（`stroke` 1.6、`paint-order:stroke`）。16px では輪郭が面積の多くを占め、内部の空白（十字・星の隙間）が埋まる（撮影から）。

## 8. semantic color / token 状況（まとめ）

- main には意味色 5 種（Background〜Muted）だけ。Selected / Danger / Recovery / Special / Disabled / Outline は C2 ブランチにだけあり、main には無い（OQ-8）。
- Attack / Skill / Cooldown / Ready の専用 token は無い。C2 では Ready = Special、Cooldown = 暗い overlay、Disabled = Disabled 色＋斜線で表した。
- 職業色は UI token に入れない（tokens.css の決まり、V-7）。アイコンの accent に職業色を使うかは未決定（V-7 は「icon accent に限定して使える」）。

## 9. Weapon Badge 現状（まとめ）

- 役割: 主人公の現在の武器を示す。表示条件は HUD 常時（HD-D09 で常時表示に確定）。
- 武器の種類（Chapter 1）: 大剣（剣士・影の旅人）・双剣（盗賊）・杖（魔法使い）・小弓（弓師）の 4 種。
- 問題: 大剣と双剣が同じ emoji、18px で `#hud-loot` に覆われる（配置は D）、初期文字「M」（D1）、交代時の同期（D1）。
- E で扱えるのは**絵柄**（4 種のシルエット）だけ。表示条件・同期・位置・大きさは D（WI-D1 / D2 / D4）。

## 10. E で決めるべき Human Decision 候補

| # | 判断事項 | 候補 |
| --- | --- | --- |
| HDE-1 | アイコンの 2 層構造（外形＝操作の種類、中身＝技）を採用するか | 採用 / 技ごとの単一アイコン / 操作の種類だけ |
| HDE-2 | 技アイコンの作成範囲 | 剣士のみ / Chapter 1 の 5 人分 / Chapter 2 以降も |
| HDE-3 | Ultimate の正式形 | 菱形の外形＋単純化した共通紋章 / 外形＋技ごとの中身 |
| HDE-4 | Heal の補助形状 | 太い十字 / 別形状（候補を Planner が出す） |
| HDE-5 | Skill 1（切り下がり）・Skill 2（崩し斬り）の意味に合わせた再設計の有無 | C2 仮アイコンを簡略化して採用 / 技の意味に合わせて再設計 |
| HDE-6 | Weapon Badge の範囲 | Chapter 1 の 4 武器 / サブ武器・上位職も |
| HDE-7 | アイコンの形式と配信 | インライン SVG（core の文字列）/ SVG sprite / SVG ファイル |
| HDE-8 | 本番 HUD への適用時期 | E で差し替える / D3・D4 と同時 / E は資産と規則だけ作り適用は D |
| HDE-9 | 既存 Ultimate ready の常時パルスの扱い | E で止める / D3 で扱う |
| HDE-10 | トースト・ログ・メニュー等の emoji を E に含めるか | 含めない（HUD のみ）/ 段階的に含める |
| HDE-11 | 職業色を icon accent に使うか | 使う（V-7 の範囲）/ 使わない |
| HDE-12 | C2 の token を main に入れる手順 | C2 を先に merge / E で改めて入れる |

## 11. Scope / Out of Scope

**Scope（E の候補）**
- Attack / Skill 1 / Skill 2 / Ultimate / Heal / Weapon Badge の正式アイコンの絵柄と規則（グリッド・輪郭・塗り・最小サイズ・状態）
- icon の形式・配信方法の設計
- `ui-icons.js` の対応表を正式アイコンへつなぐ設計
- 16 / 20 / 24px とグレースケールでの検証方法

**Out of Scope（E では扱わない）**
- HUD のレイアウト・位置・ボタンサイズ・表示条件（D）。Weapon Badge の「M」・同期・位置（D1 / D2 / D4）
- 844×390 の配置問題（D）
- MP 廃止（HD-D10）
- 技の性能・モーション・VFX・戦闘ロジック
- 3D 空間内の表示（看板・マーカー）、ミニマップの Canvas（E Task の Out of Scope）
- 台詞・固有名詞の中の記号（E Task の Out of Scope。HDE-10 で範囲を決める）
- C2 Prototype のコード・R-1 / N-1 / N-2

## 12. Planner へ渡す前提条件

1. 本 report の Artifact Handoff（`../AGENTS.md` §5.2: Human が 1 ファイル 1 commit で remote に置き、Source SHA / Blob SHA を記録）。
2. HDE-1〜HDE-3（アイコンの構造・範囲・Ultimate の形）が決まっていること。これが無いと Work Item の数が決まらない。
3. HDE-8（本番 HUD への適用時期）と D の進行（WI-D1 は APPROVED・未着手、D2〜D6 は未承認）の関係が整理されていること。
4. C2 ブランチ（`claude/ui-002-c2-impl`）を main へ merge するか（HDE-12 / OQ-8）。E の実装がどのブランチから始まるかに影響する。
5. UI-002-D の未 commit 変更（作業ツリー `claude/ui-002-c1-impl`）の Persistence。Decision record（V-1〜V-7 の転記、H-8）が同じファイルにあるため。
6. E Task file（`.ai/tasks/UI-002-E.md`）には作業ツリー上に未 commit の追記（C2 との境界）がある。E の Task の正本をどれにするか。

## 13. 変更したファイル

- `.ai/reports/UI-002-E-analysis.md`（新規、本ファイル）のみ。ソース・Task file・Decision record・C2 / V の記録・D の未 commit 変更は変更していない。commit / push はしていない。
