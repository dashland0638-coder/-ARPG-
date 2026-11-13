# CLOCKTOWER-002 — 時計塔の根本的再設計・不具合修正・体験品質改善

Status: DONE（Agent 側）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: PR #121（`claude/dazzling-maxwell-y3msf3` @ `eff29e5`、未マージ）の上に積む。main へはマージしない（DEC-019）。
調査: `.ai/reports/CLOCKTOWER-002-analysis.md` / 設計: `-design.md` / 試験: `-test-report.md` / レビュー: `-review.md`
Human Decision: `.ai/decisions/DEC-019-clocktower-vertical-climb.md`

## Approval
- [x] Approved — Human Request（2026-11-11「CLOCKTOWER-002：時計塔の根本的再設計・不具合修正・体験品質改善」）
- Escalation Check: None（依頼に判断が含まれる。実装の詳細は Agent の判断として DEC-019 に記録）

## Work Items

| Phase | 内容 | 状態 | 確認 |
| --- | --- | --- | --- |
| A | FPS 低下の原因（点光源 47 個・演出中の二重描画）、敵の階層不整合（平面の視線・描画の例外・X 線の輪郭）、支援の追従（高さ 0 に描いていた）。共通の「階層」の決まり（壁の高さの帯・坂・同じ階・別の階の敵・支援の追従） | DONE | 計測・unit・E2E |
| B | 縦断構造・6 層・上昇ルート・高さの表現・仕掛け 3 種・シナリオの再構成 | DONE | 設計書 |
| C | 最小版（入口 → 坂 → 工房 → 長針の橋 → 縦穴の底 → 歯車の輪）で、登る感覚・操作・FPS・支援の追従をブラウザで確かめた | DONE | ブラウザ（試験報告 §3） |
| D | 残り（T3 住まい・T4 鐘楼・T5 大時計の裏・屋上・島への接続）、物語、ボスの位置 | DONE | unit・E2E・ブラウザ |
| E | Build / Unit / E2E / 独立レビュー / 文書 | DONE | 試験報告・レビュー |
| — | iPhone 実機 | **未確認（Human）** | CHAPTER1_PLAYTEST.md §6 D-01〜D-22 |

## Agent Decisions
- PR #121 のブランチを続けて使う（同じ塔の作り直しで未マージ。差分で比べられる）
- 積み重ねた階は一つの世界のまま、壁の高さの帯と坂の床で解く（別マップのロードに分けない）
- 演出中の二重描画（全ダンジョン共通）を直す。各ダンジョンの演出の FPS も上がる（挙動は変えない）
- 塔の敵の飾りの点光源は外す（色は発光で残る）

## 既知の制限・残件
- 計測はヘッドレス Chromium（ソフトウェア描画）。iPhone の FPS・タッチ操作・発熱は未確認
- 塔の外観は前庭にいる時だけ描く（中では上の層を描かないため）
