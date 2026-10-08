# CD-01 Report — Chapter 1 Documentation Cleanup

| 項目 | 内容 |
| --- | --- |
| Work Item ID | CD-01 |
| 目的 | Chapter 1 の仕様を1か所から追えるようにし、古い記述・「予定」と「実装済み」の混在を整理する。仕様の意味は変えない |
| 変更ファイル | `docs/README.md`、`docs/SCENARIOS.md`、`docs/CHARACTERS.md`、`docs/PROGRESSION.md`、`docs/GAME_DESIGN.md`、`docs/CHAPTER1_STORY.md`（§7 のみ）、新規 `docs/CHAPTER1_PLAYTEST.md`（CQ-01） |

## 監査結果と対応

| # | 文書 | 古い／矛盾する記述 | 根拠（決定・実装） | 対応 |
| --- | --- | --- | --- | --- |
| 1 | README.md | Chapter 1 の仕様の入口が無い（各文書に散在） | ― | **Chapter 1 Index** を追加（構成・物語・各ステージ・5人目・基本ルール・装備・スキル・異空間・進行と保存・通しの判定・凍結の正本を1表に） |
| 2 | README.md D-02 | 奥義の環が Chapter 1 で開放されている | WORK 12.1（`legacyGrowthEnabled`、`sphereValue()` が本編で 0） | Status = 解消 を追記（元の記述は経緯として残す） |
| 3 | README.md D-03 | 章とダンジョンの対応が未決定 | HD-C1（④ = 時計塔）、WORK 11（⑤ = 道）、HD-C4（温室 = クリア後 Extra） | Status = 解消。温室の接続だけ未実装（CX-01）と明記 |
| 4 | README.md D-04 | 章の自動進行・支援AIが未実装 | WORK 10 / 11（`core/chapter1-progress.js`） | Status = 解消 |
| 5 | README.md D-05 | ボス能力は誰でも獲得 | `bossAbilityValue()` が本編で 0 | 第一章の本編では効かないことを追記。決定は未実施のまま（変えていない） |
| 6 | SCENARIOS.md | 主要シナリオ表が原案（③ 幽霊船 → 温室、④ 村の別展開）のまま、`CHAPTER_CAST` 第5段が null、`applyChapterCast(1)` 固定 | HD-C1 / HD-C4 / WORK 11 / 実装 | 5段の確定表に置き換え。原案は「経緯」として1行残した。実装の表を現在の `CHAPTER_CAST` に更新 |
| 7 | SCENARIOS.md | 時計塔・温室・名もなき街道が「未確定」 | HD-C1 / HD-C4 / WORK 11 / HD-C3 | 確定として書き直し。温室は「まだ出撃できない（CX-01）」 |
| 8 | SCENARIOS.md | ダンジョン表に道が無い | `SCENARIO_DEFS` | 追加。推奨Lv は本編では使わないと注記 |
| 9 | SCENARIOS.md | 洋館の手記「3点だけ」 | 実装は5点（CM-05 の照合） | 実装事実として5点と注記（`MANSION_SCENARIO.md` は CM-05 の PR #42 で訂正予定なので、ここでは触らない ―― 衝突回避） |
| 10 | SCENARIOS.md | 酒場の常駐NPC「影の旅人」、ゲスト切り替え未実装 | DEC-004 N-4 / CR-02、WORK 10 | 加入前は「？？？」、時計塔クリアで席を立つ。支援の切り替えは実装済み |
| 11 | CHARACTERS.md | 影の旅人「戦闘には一切関わらない」「第五章 classKey:null」「プレイアブル化の条件は未確定」 | WORK 11 / CR-02 / DEC-005 | 加入前・加入後に分けて記述。加入条件（道の出会い）を実装事実として書き、専用戦闘スタイル・Skill・素手のモーション・正体だけを未確定に残した |
| 12 | CHARACTERS.md | HDR-T4-10「食い違いはまだ直していない」 | CR-02（加入前の姿 = 演出用のメッシュ、加入後 = 操作キャラのリグ） | 「同じ人物の加入前と加入後の姿」として整理 |
| 13 | CHARACTERS.md Party | 章に連動したゲスト切り替えは未実装 | WORK 10 / 11 | 実装済みに更新 |
| 14 | PROGRESSION.md | 「奥義の環はロックされておらず常時開放」（同じ文書内の WORK 12.1 の決定と矛盾） | WORK 12.1 | 実装済みに更新。Uncertain から D-02 を外した |
| 15 | PROGRESSION.md | Level / Stats・Equipment の「実装事実」が本編でも動くように読める | WORK 12.1 | 「仕組みは存在するが本編では動かない」と注記 |
| 16 | PROGRESSION.md | ボス能力 | `bossAbilityValue()` | 本編では効かないと追記 |
| 17 | GAME_DESIGN.md | 影の旅人のプレイアブル化条件が未確定 | WORK 11 / CR-02 | 条件は確定済みとし、未確定は専用の戦闘スタイルだけに |
| 18 | CHAPTER1_STORY.md §7 | 実装前の対応表（「着手は #36 の後」） | #50〜#63 | 状態列（実装済み・PR）を追加。CR-01 / CR-03 の行を追加 |

## 変えていないもの
- 仕様の中身（Chapter 1 System Freeze、Skill 1 / Skill 2 の固定、成長・装備のルール、異空間の禁止、交代の順、影の旅人の未決定事項）
- ルートの一次資料（`MANSION_SCENARIO.md` / `ARCHITECTURE.md` / `COMBAT_DESIGN.md` など）。洋館の文書は未 merge の #38・#42 が直しているため、衝突を避けて触らない
- D-01 / D-06 / D-07（Chapter 1 の範囲外、または Human の判断待ち）
- `.ai/` の過去の記録（経緯として残す）

## Reviewer
- PASS（Round 1）。変更は決定済み・実装済みの事実に合わせるものだけで、未決定を決定済みに書き換えていない（影の旅人の戦闘スタイル・Chapter 2・ピラミッド／火山・D-05 の決定は未確定のまま）。仕様の意味を変えていない
