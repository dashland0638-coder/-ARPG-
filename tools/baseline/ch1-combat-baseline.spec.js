// @ts-check
/* CH1-COMP W2-T1: 戦闘改修前のベースライン測定(宵待ちの村のボス戦「村の残響」)。
 *
 * ■ これは何か
 *   戦闘の改修(W2-1a 以降)の前に、戦い方ごとの結果を記録する。値の大小で合否を決めない
 *   (測定だけ)。落ちるのは、ページのエラー・ボスバーが読めない・戦闘が始まらないときだけ。
 *   結果は試行ごとに test-results-baseline/ch1-combat-baseline/<試行>.json に書く。
 *
 * ■ ゲームの状態を書き換えない
 *   読むのは画面の表示だけ:
 *     - ボスの HP     … #boss-bar-fill の style.width(14-hud-boot.js updateBossBar)
 *     - 与ダメージ    … .dmg-pop(11-combat-actions.js spawnDamagePopup)。
 *                       味方(支援)は文字色 #9fe8ff、被ダメージは class 'incoming'
 *     - 通知          … 中央トーストと左下ログ(tests/helpers.js watchNotifications)
 *     - ゲーム内時間  … 下の「時間」
 *   入力はキーボードだけ(移動 WASD・攻撃 J・回避 Shift)。デバッグモードは使わない
 *   (デバッグモードでは被ダメージが 0 になる経路がある)。
 *
 * ■ 時間
 *   自動テストではゲーム内時間が実時間の 1/4 で進む(core/sim-time.js
 *   AUTOMATION_TIME_SCALE)。ただし 1 フレームの歩みは 50ms で頭打ちなので、描画が
 *   5fps を下回るとさらに遅れる。ページの中で requestAnimationFrame の間隔を測り、
 *   simDeltaSeconds と同じ式 min(0.05, 間隔 × 0.25) を足し合わせて「推定ゲーム内時間」とする
 *   (ゲームのループも rAF で回る。推定であって、ゲームの内部の値を読んだものではない)。
 *
 * ■ テストモードの値は通常プレイの値ではない(結果に必ず書く)
 *   - テストモードでは HP が 1 で止まり戦闘不能にならない(12-progression-ui.js triggerPlayerDown)
 *   - テストモードは legacyGrowth() が true。レベルは 1 で測る(通常の第一章の装備と同じとは限らない)
 *   - 地点ジャンプでボスの前から始める(道中の消耗を含まない)
 *   - 数字の表示はカメラの後ろでは出ない(数え漏れがありうる)
 *   - ボス本体の攻撃回数は画面に出ないので測らない。被弾は分身・泡・写し影・段階移行の
 *     爆発を含む「攻撃の圧力」の目安で、オーブシールドで防いだ一撃は数に入らない
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGame, watchErrors, watchNotifications, disableCameraAutoFollow } from '../../tests/helpers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/* 通常の Playwright の実行は開始時に test-results/ を空にするので、測定の結果はその外に置く */
const OUT_DIR = path.join(ROOT, 'test-results-baseline/ch1-combat-baseline');

const SIM_LIMIT_SEC = 90;           // 1 試行の上限(推定ゲーム内時間)。試走で村の残響は支援だけで約 50 秒
const SAMPLE_EVERY_SIM_SEC = 5;     // ボスの HP を記録する間隔
const MAGE_SPEED = 4.4;             // 魔法使いの移動速度(01-character-creation.js CLASSES.mage.spd)
const ALLY_COLOR = 'rgb(159, 232, 255)';   // #9fe8ff
/** 戦闘中に出た会話の記録(試行ごとに空にする。workers は 1) */
let midDialogues = [];

/* ページを開く前に仕込む計測(読み取りだけ) */
async function installProbes(page) {
  await page.addInitScript(([allyColor]) => {
    const W = window;
    W.__bl = {
      ally: { n: 0, sum: 0 }, player: { n: 0, sum: 0 }, incoming: { n: 0, sum: 0 },
      incomingTimes: [], sim: 0, frames: 0, real0: 0, counting: false,
    };
    // ダメージの数字: 要素は使い回されるので、'dmg-pop-run' が付いた瞬間を 1 回と数える
    new MutationObserver(records => {
      const B = W.__bl;
      if (!B.counting) return;
      for (const r of records) {
        if (r.attributeName !== 'class') continue;
        const el = r.target;
        if (!el.classList || !el.classList.contains('dmg-pop')) continue;
        const had = (r.oldValue || '').split(/\s+/).includes('dmg-pop-run');
        if (had || !el.classList.contains('dmg-pop-run')) continue;
        const v = Math.abs(parseInt((el.textContent || '').replace(/[^0-9-]/g, ''), 10)) || 0;
        if (el.classList.contains('incoming')) { B.incoming.n++; B.incoming.sum += v; B.incomingTimes.push(B.sim); }
        else if (el.style.color === allyColor) { B.ally.n++; B.ally.sum += v; }
        else { B.player.n++; B.player.sum += v; }
      }
    }).observe(document, { attributes: true, attributeOldValue: true, attributeFilter: ['class'], subtree: true });
    // 推定ゲーム内時間: core/sim-time.js simDeltaSeconds と同じ式を rAF の間隔に当てる
    let last = 0;
    const tick = (t) => {
      const B = W.__bl;
      if (last) {
        const dt = (t - last) / 1000;
        if (B.counting) { B.sim += Math.min(0.05, dt * 0.25); B.frames++; }
      }
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [ALLY_COLOR]);
}

const sim = (page) => page.evaluate(() => window.__bl.sim);
const bossPct = (page) => page.evaluate(() => {
  const el = document.getElementById('boss-bar-fill');
  const wrap = document.getElementById('boss-bar-wrap');
  return {
    pct: el ? parseFloat(el.style.width) : NaN,
    shown: !!(wrap && wrap.classList.contains('show')),
  };
});
const dialogueActive = (page) => page.evaluate(() =>
  document.getElementById('dialogue-overlay').classList.contains('active'));

/* 会話をすべて送る(ボスの口上と、ボスの手前の演出) */
async function clearDialogues(page, quietMs = 4000, maxMs = 120_000) {
  const t0 = Date.now();
  let quietSince = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await dialogueActive(page)) {
      await page.click('#dialogue-overlay');
      quietSince = Date.now();
      await page.waitForTimeout(400);
    } else {
      if (Date.now() - quietSince > quietMs) return true;
      await page.waitForTimeout(300);
    }
  }
  return false;
}

/* 推定ゲーム内時間で simSec のあいだキーを押す */
async function holdForSim(page, key, simSec, deadline) {
  const s0 = await sim(page);
  await page.keyboard.down(key);
  while ((await sim(page)) - s0 < simSec && (await sim(page)) < deadline) {
    if (await bossDefeated(page)) break;
    await handleMidFightDialogue(page, midDialogues);
    await page.waitForTimeout(250);
  }
  await page.keyboard.up(key);
}

/* 撃破: ボスが死ぬと HP バーは消える(updateBossBar は生きているボスだけを出す)。バーは会話・
   メニューの間も消えるので、「最後に出ていた HP が 10% 未満でバーが消えた」か結果画面を撃破とみなす。
   1 撃の大きさはボスの最大 HP の数 % なので、死ぬ直前の表示は 10% を下回る */
const DEFEAT_LAST_PCT = 10;
async function bossDefeated(page) {
  return page.evaluate((th) => {
    const wrap = document.getElementById('boss-bar-wrap');
    const fill = document.getElementById('boss-bar-fill');
    const shown = !!(wrap && wrap.classList.contains('show'));
    const clear = document.getElementById('clear-overlay').classList.contains('active');
    const last = fill ? parseFloat(fill.style.width) : NaN;
    return clear || (!shown && last < th) || last <= 0;
  }, DEFEAT_LAST_PCT);
}

/* 戦闘中に会話が出たら送る(数えて記録する)。テストモードの地点ジャンプは「ボスの手前」の演出
   (14-dungeon-duskvillage.js playDuskBossPrelude、中心 (0,496) 半径 6m)を飛ばしているので、
   ボスに押されて入口(z 500)の近くへ下がると戦闘の途中でその演出が始まる。通常プレイでは
   ボスの前に必ず通る場所なので起きない ―― テストモードの測定上の制約として記録する */
async function handleMidFightDialogue(page, log) {
  if (!(await dialogueActive(page))) return;
  if (await bossDefeated(page)) return;
  const text = await page.locator('#dialogue-text').textContent();
  log.push({ simSec: +(await sim(page)).toFixed(1), text: (text || '').trim() });
  await page.click('#dialogue-overlay');
  await page.waitForTimeout(300);
}

/* ===== 戦い方 =====
   開始地点は水鏡の跡(0, 515)、ボスは(0, 520)。闘技場は x -18..18 / z 500..534
   (core/dusk-village-map.js bossArea)。カメラは北向き(camYaw = π、自動追従なし)なので
   W = +z、S = -z、A = +x、D = -x(10-input.js inputToWorldDir)。 */
const legSim = (meters) => meters / MAGE_SPEED;

const STRATEGIES = {
  // S1 逃げ回り: 攻撃しない。ボスの周りを大きな長方形(x ±12、z 506〜530)で回り続ける
  S1: { name: '逃げ回り', policy: '攻撃しない。ボスの周りを x ±12・z 506〜530 の長方形で回り続ける(移動は推定ゲーム内時間で区切る)',
    async run(page, deadline) {
      await holdForSim(page, 'KeyS', legSim(9), deadline);     // (0,515) → (0,506)
      await holdForSim(page, 'KeyD', legSim(12), deadline);    // → (-12,506)
      while ((await sim(page)) < deadline && !(await bossDefeated(page))) {
        await holdForSim(page, 'KeyW', legSim(24), deadline);  // → (-12,530)
        await holdForSim(page, 'KeyA', legSim(24), deadline);  // → (12,530)
        await holdForSim(page, 'KeyS', legSim(24), deadline);  // → (12,506)
        await holdForSim(page, 'KeyD', legSim(24), deadline);  // → (-12,506)
      }
    } },
  // S2 立ち止まり: 何もしない(支援だけが戦う)。ボスが間合いへ寄ってくる
  S2: { name: '間合いの中で立ち止まる', policy: '入力なし。開始地点(ボスの 5m 手前)に立ったまま。支援だけが戦う',
    async run(page, deadline) {
      while ((await sim(page)) < deadline && !(await bossDefeated(page))) { await handleMidFightDialogue(page, midDialogues); await page.waitForTimeout(500); }
    } },
  // S3 殴り続ける: 動かずに通常攻撃を押し続ける
  S3: { name: '攻撃を続ける', policy: '移動しない。通常攻撃(J)を押し続ける',
    async run(page, deadline) {
      await page.keyboard.down('KeyJ');
      while ((await sim(page)) < deadline && !(await bossDefeated(page))) { await handleMidFightDialogue(page, midDialogues); await page.waitForTimeout(500); }
      await page.keyboard.up('KeyJ');
    } },
  // S4 回避を混ぜる(参考): 攻撃を押し続け、推定ゲーム内 2 秒ごとに後ろ(S)へ回避する。
  // 予兆を見て避けるのではなく一定間隔なので、読み合いの評価には使えない
  S4: { name: '回避を混ぜる(比較用)', policy: '通常攻撃(J)を押し続け、推定ゲーム内 2 秒ごとに S を押しながら回避(Shift)。予兆は見ていない(一定間隔)',
    async run(page, deadline) {
      await page.keyboard.down('KeyJ');
      let next = (await sim(page)) + 2;
      while ((await sim(page)) < deadline && !(await bossDefeated(page))) {
        if ((await sim(page)) >= next) {
          await page.keyboard.down('KeyS');
          await page.keyboard.press('ShiftLeft');
          await page.waitForTimeout(400);
          await page.keyboard.up('KeyS');
          next = (await sim(page)) + 2;
        }
        await handleMidFightDialogue(page, midDialogues);
        await page.waitForTimeout(250);
      }
      await page.keyboard.up('KeyJ');
    } },
};

for (const sKey of ['S1', 'S2', 'S3', 'S4']) {
  for (const rep of [1, 2]) {
    const S = STRATEGIES[sKey];
    const id = `${sKey}-${rep}`;
    test(`${sKey} ${S.name} #${rep}`, async ({ page }) => {
      const errors = watchErrors(page);
      await watchNotifications(page);
      await installProbes(page);
      await openGame(page);

      // テストモード: 魔法使い(Lv1)＋支援の剣士、宵待ちの村、開始地点「水鏡の跡」
      await page.click('#open-testmode-btn');
      await expect(page.locator('#testmode-screen')).toBeVisible();
      await page.click('#testmode-class-grid .class-card[data-key="mage"]');
      await page.click('#testmode-guest-grid .testmode-job-card[data-guest-key="warrior"]');
      await page.click('#testmode-scenario-grid .testmode-job-card[data-scenario-key="duskvillage"]');
      await page.waitForSelector('#testmode-waypoint-grid .testmode-job-card[data-waypoint-id="boss"]');
      await page.click('#testmode-waypoint-grid .testmode-job-card[data-waypoint-id="boss"]');
      await page.locator('#testmode-level').fill('1');
      await expect(page.locator('#testmode-level-val')).toHaveText('1');
      await page.click('#testmode-start-btn');
      await expect(page.locator('#hud')).toHaveClass(/active/);
      await expect(page.locator('#minimap-room')).toHaveText('水鏡の跡', { timeout: 60_000 });

      // ボスの口上(近づくと始まる)を送り、戦闘を始める
      await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
      expect(await clearDialogues(page), '会話を送り切れること').toBe(true);
      // 移動入力をカメラ相対で固定するため、自動追従を切る(まだ一歩も歩いていないので camYaw = π のまま)
      await disableCameraAutoFollow(page);
      await expect.poll(async () => (await bossPct(page)).shown, { timeout: 60_000 }).toBe(true);

      const notes0 = await page.evaluate(() => (window.__notes || []).length);
      // 戦闘中に出た会話(テストモードの制約。handleMidFightDialogue)
      midDialogues = [];
      const real0 = Date.now();
      await page.evaluate(() => { window.__bl.counting = true; });
      const deadline = SIM_LIMIT_SEC;

      // ボスの HP を推定ゲーム内 5 秒ごとに記録しながら戦い方を実行
      const hp = [];
      let sampling = true;
      const sampler = (async () => {
        let nextT = 0;
        while (sampling) {
          const t = await sim(page);
          if (t >= nextT) {
            const b = await bossPct(page);
            hp.push({ simSec: +t.toFixed(1), realSec: +((Date.now() - real0) / 1000).toFixed(1), bossPct: b.pct });
            nextT += SAMPLE_EVERY_SIM_SEC;
          }
          await page.waitForTimeout(500);
        }
      })();
      await S.run(page, deadline);
      sampling = false;
      await sampler;

      const end = await page.evaluate(() => {
        const B = window.__bl;
        B.counting = false;
        return JSON.parse(JSON.stringify(B));
      });
      const realSec = (Date.now() - real0) / 1000;
      const finalBoss = await bossPct(page);
      const defeated = await bossDefeated(page);
      const notes = await page.evaluate(n0 => (window.__notes || []).slice(n0), notes0);
      const totalOut = end.ally.sum + end.player.sum;

      const result = {
        trial: id, strategy: sKey, strategyName: S.name, policy: S.policy,
        conditions: {
          mode: 'テストモード(?dev=1)。通常プレイの値ではない',
          protagonist: 'mage', guest: 'warrior', level: 1, scenario: 'duskvillage', waypoint: 'boss(水鏡の跡 0,515)',
          debugMode: false, cameraAutoFollow: false, simLimitSec: SIM_LIMIT_SEC,
          constraints: [
            'テストモードでは HP が 1 で止まり戦闘不能にならない',
            'legacyGrowth() が true。レベル 1 で測定(通常の第一章の装備と同じとは限らない)',
            '地点ジャンプでボスの前から開始(道中の消耗を含まない)',
            '数字の表示はカメラの後ろでは出ない(数え漏れがありうる)',
            '被弾はボス本体・分身・泡・写し影・段階移行の爆発を区別しない(攻撃の圧力の目安)。オーブシールドで防いだ一撃は数えない',
            'ボス本体の攻撃回数は画面に出ないため取得していない',
            'ゲーム内時間は rAF 間隔から sim-time の式で推定した値',
            '地点ジャンプで「ボスの手前」の演出を飛ばしているため、入口(z 500)付近へ下がると戦闘中にその会話が始まる(送って続行し midFightDialogues に記録)',
            '撃破の判定は「最後の HP 表示が 10% 未満でバーが消えた」または結果画面',
          ],
        },
        estimatedSimSec: +end.sim.toFixed(1),
        realSec: +realSec.toFixed(1),
        avgFps: +(end.frames / Math.max(1, realSec)).toFixed(1),
        bossDefeated: defeated,
        // 撃破は戦い方の実行が止まった時点(推定ゲーム内時間)。撃破しなければ null
        bossDefeatSimSec: defeated ? +end.sim.toFixed(1) : null,
        // 最後に表示されていたボスの HP(撃破時はバーが消える直前の値)
        bossPctEnd: finalBoss.pct,
        bossHp: hp,
        damage: {
          ally: end.ally, player: end.player,
          allyShare: totalOut > 0 ? +(end.ally.sum / totalOut).toFixed(3) : null,
        },
        incoming: {
          n: end.incoming.n, sum: end.incoming.sum,
          perMinSim: end.sim > 0 ? +(end.incoming.n / (end.sim / 60)).toFixed(2) : null,
          timesSimSec: end.incomingTimes.map(t => +t.toFixed(1)),
        },
        notices: notes,
        midFightDialogues: midDialogues,
        bossAttackCount: '取得不能(画面に出ない)',
        errors,
      };
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUT_DIR, `${id}.json`), JSON.stringify(result, null, 2));
      await page.screenshot({ path: path.join(OUT_DIR, `${id}-end.png`) });

      // 測定の成立条件だけを確かめる(値の大小では落とさない)
      expect(hp.length, 'ボスの HP を記録できたこと').toBeGreaterThan(1);
      expect(Number.isFinite(hp[0].bossPct), 'ボスバーを読めたこと').toBe(true);
      expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    });
  }
}
