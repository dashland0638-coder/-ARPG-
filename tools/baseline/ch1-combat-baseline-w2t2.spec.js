// @ts-check
/* CH1-COMP W2-T2: 現行コードでの戦闘ベースラインの再測定(宵待ちの村のボス戦「村の残響」)。
 *
 * ■ W2-T1(ch1-combat-baseline.spec.js)との関係
 *   W2-T1 の spec はそのまま残す(旧い測定の再現用)。この spec は同じ条件・同じ戦い方
 *   (S1〜S4)を、現行コードで測り直し、次を足す。
 *     - 通常プレイなら倒れていた時刻: テストモードの「HP1 で生存」の記録の **最初の 1 回**。
 *       この記録は 2 秒に 1 回へ間引かれるが、最初の 1 回は間引かれない
 *       (12-progression-ui.js triggerPlayerDown)。被弾の累計がプレイヤーの最大 HP を
 *       超えた時刻とも突き合わせる
 *     - プレイヤーの HP: 戦闘の前と後にメニューの HP(menu-hp)を読む。戦闘中は HP バーの割合
 *     - 処刑: Arena の記録「EXECUTION」の回数。処刑の窓(攻撃ボタンが「処刑」になる間)の回数
 *     - ボスの攻撃: Arena の敵情報(Debug Info)が「最も近い敵 = ボス」のときの AI State の
 *       WINDUP / RECOVERY の回数(ボスが最も近くないときは数えられない)
 *     - 時刻つきの通知・被弾・与ダメージ(段階ごとに分けるため)
 *   戦い方を 2 つ足す。
 *     - S3T 攻撃を連打: J を押し直し続ける。PR #89 の後は、処刑の窓の間に押すと処刑になる。
 *       押し続ける S3 との差が、処刑の操作の影響
 *     - S5 予兆を見て回避 → 反撃: S3T に、ボスの振りかぶり(WINDUP)を見てから回避し、
 *       回避攻撃で反撃する操作を足す
 *
 * ■ ゲームの状態を書き換えない
 *   読むのは画面の表示(ボスの HP バー、ダメージの数字、通知、HP バー、メニューの HP、
 *   テストモードの Arena の記録と敵情報)だけ。入力はキーボード(実キーと合成キーイベント)だけ。
 *   Arena のパネルと Debug Info は、テストモードの画面のボタン(表示の切り替えだけ)で開く。
 *   デバッグモードは使わない(被ダメージが 0 になる)。ゲームのコードは変えていない。
 *
 * ■ 時間
 *   W2-T1 と同じ。rAF の間隔に core/sim-time.js simDeltaSeconds と同じ式
 *   min(0.05, 間隔 × 0.25) を当てて足した「推定ゲーム内時間」。会話中も進む。
 *
 * ■ テストモードの値は通常プレイの値ではない(差は報告書 .ai/reports/CH1-COMBAT-BASELINE-W2T2.md)
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGame, watchErrors, disableCameraAutoFollow } from '../../tests/helpers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'test-results-baseline/ch1-combat-baseline-w2t2');

const SIM_LIMIT_SEC = 90;
const SAMPLE_EVERY_SIM_SEC = 1;
const MAGE_SPEED = 4.4;
const ALLY_COLOR = 'rgb(159, 232, 255)';   // #9fe8ff
/* S5: ボスの振りかぶりに気付いてから回避を始めるまで(推定ゲーム内秒)。
   振りかぶりは 0.55 秒(段階 1・2)/ 0.40 秒(段階 3)。人の反応を置く */
const REACT_SIM_SEC = 0.2;
let midDialogues = [];

/* ページを開く前に仕込む計測(読み取りと、戦い方の合成キー入力だけ) */
async function installProbes(page) {
  await page.addInitScript(([allyColor, reactSim]) => {
    const W = window;
    const B = W.__bl = {
      ally: { n: 0, sum: 0 }, player: { n: 0, sum: 0 }, incoming: { n: 0, sum: 0 },
      hits: [],            // [t, 'i'|'a'|'p', 値]  被弾 / 支援 / プレイヤー
      notes: [],           // {t, ch, text}  toast / log / arena
      execWindows: [],     // 攻撃ボタンが「処刑」になった時刻
      boss: { lastState: null, windup: 0, recovery: 0, chase: 0, transitions: [], seenFrames: 0, frames: 0 },
      hpTrace: [],
      sim: 0, frames: 0, counting: false,
      ctl: null,           // 戦い方の制御(S3T / S5)
      ctlLog: { taps: 0, dodges: 0, counters: 0, windupSeen: 0 },
    };
    const push = (ch, text) => { if (B.counting) B.notes.push({ t: +B.sim.toFixed(2), ch, text }); };
    new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'childList') {
          for (const n of r.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.classList.contains('item-pop')) push('toast', n.textContent || '');
            else if (n.classList.contains('msg-log-line')) push('log', n.textContent || '');
            else if (n.classList.contains('arena-feedback-line')) push('arena', n.textContent || '');
          }
          continue;
        }
        if (r.attributeName !== 'class' || !B.counting) continue;
        const el = r.target;
        if (el.id === 'btn-attack') {
          const was = (r.oldValue || '').split(/\s+/).includes('is-execute');
          if (!was && el.classList.contains('is-execute')) B.execWindows.push(+B.sim.toFixed(2));
          continue;
        }
        if (!el.classList || !el.classList.contains('dmg-pop')) continue;
        const had = (r.oldValue || '').split(/\s+/).includes('dmg-pop-run');
        if (had || !el.classList.contains('dmg-pop-run')) continue;
        const v = Math.abs(parseInt((el.textContent || '').replace(/[^0-9-]/g, ''), 10)) || 0;
        const t = +B.sim.toFixed(2);
        if (el.classList.contains('incoming')) { B.incoming.n++; B.incoming.sum += v; B.hits.push([t, 'i', v]); }
        else if (el.style.color === allyColor) { B.ally.n++; B.ally.sum += v; B.hits.push([t, 'a', v]); }
        else { B.player.n++; B.player.sum += v; B.hits.push([t, 'p', v]); }
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class'] });

    const key = (type, code) => W.dispatchEvent(new KeyboardEvent(type, { code, key: code }));
    /* Arena の敵情報(最も近い敵)を読む。ボスかどうかは最大 HP で見分ける(bossHpMax) */
    function readInfo() {
      const el = document.getElementById('arena-enemy-info');
      if (!el || el.style.display === 'none') return null;
      const h = el.innerHTML || '';
      const hp = /HP:\s*(\d+)\s*\/\s*(\d+)/.exec(h);
      const ai = /AI State:\s*([^<]*)/.exec(h);
      return hp ? { hp: +hp[1], hpMax: +hp[2], ai: ai ? ai[1].trim() : '' } : null;
    }
    /* 回避の向き: ボス戦の間はカメラがボスにロックオンし、毎フレーム「ボスの反対側」へ camYaw を
       寄せる(13-update-loop.js updateCamera の findLockOnBoss)。移動はカメラ相対(10-input.js
       inputToWorldDir)なので、S = ボスから離れる向き */
    let last = 0;
    const tick = (now) => {
      if (last && B.counting) {
        B.sim += Math.min(0.05, (now - last) / 1000 * 0.25);
        B.frames++;
        // ボスの AI 状態(ボスが最も近い敵のときだけ)
        const info = readInfo();
        B.boss.frames++;
        let bossWindupStart = false;
        if (info && B.bossHpMax && info.hpMax === B.bossHpMax) {
          B.boss.seenFrames++;
          const st = info.ai;
          if (st !== B.boss.lastState) {
            if (st === 'WINDUP') { B.boss.windup++; bossWindupStart = true; }
            else if (st === 'RECOVERY') B.boss.recovery++;
            B.boss.transitions.push([+B.sim.toFixed(2), st]);
            B.boss.lastState = st;
          }
        } else if (B.boss.lastState !== null) {
          B.boss.transitions.push([+B.sim.toFixed(2), '(not nearest)']);
          B.boss.lastState = null;
        }
        // HP バー
        if (B.hpTrace.length === 0 || B.sim - B.hpTrace[B.hpTrace.length - 1][0] >= 0.5) {
          const f = document.getElementById('hp-fill');
          B.hpTrace.push([+B.sim.toFixed(2), f ? parseFloat(f.style.width) : null]);
        }
        // 戦い方の制御(S3T / S5)。1 フレームに 1 つの操作だけ進める
        const c = B.ctl;
        if (c && c.on) {
          if (c.dodge && bossWindupStart && !c.seq) {
            B.ctlLog.windupSeen++;
            c.seq = { at: B.sim + reactSim, keys: ['KeyS'], step: 0, shiftAt: null };
          }
          if (c.jDown) { key('keyup', 'KeyJ'); c.jDown = false; }
          else if (c.seq) {
            const s = c.seq;
            if (s.step === 0 && B.sim >= s.at) { s.keys.forEach(k => key('keydown', k)); s.step = 1; }
            else if (s.step === 1) { key('keydown', 'ShiftLeft'); key('keyup', 'ShiftLeft'); B.ctlLog.dodges++; s.shiftAt = B.sim; s.step = 2; }
            else if (s.step === 2) { s.keys.forEach(k => key('keyup', k)); s.step = 3; }
            // 回避のロール(0.2 秒)の間は攻撃を受け付けない(13-update-loop.js attackInputDown)。
            // ロールが終わってから回避攻撃の受付(回避から 0.55 秒)の間に J
            else if (s.step === 3 && B.sim >= s.shiftAt + 0.22) { key('keydown', 'KeyJ'); c.jDown = true; B.ctlLog.counters++; c.seq = null; }
          } else if (c.tap) { key('keydown', 'KeyJ'); c.jDown = true; B.ctlLog.taps++; }
        }
      }
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [ALLY_COLOR, REACT_SIM_SEC]);
}

const sim = (page) => page.evaluate(() => window.__bl.sim);
const bossPct = (page) => page.evaluate(() => {
  const el = document.getElementById('boss-bar-fill');
  const wrap = document.getElementById('boss-bar-wrap');
  return { pct: el ? parseFloat(el.style.width) : NaN, shown: !!(wrap && wrap.classList.contains('show')) };
});
const dialogueActive = (page) => page.evaluate(() =>
  document.getElementById('dialogue-overlay').classList.contains('active'));

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

/* メニューを開いて HP・攻撃力・クラス(テストモードは Lv つき)を読み、閉じる */
async function readMenuStats(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-overlay')).toHaveClass(/active/, { timeout: 30_000 });
  const s = await page.evaluate(() => ({
    hp: document.getElementById('menu-hp').textContent,
    mp: document.getElementById('menu-mp').textContent,
    atk: document.getElementById('menu-atk').textContent,
    cls: document.getElementById('menu-class').textContent,
    potion: (document.getElementById('loot-potion') || {}).textContent || null,
  }));
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/, { timeout: 30_000 });
  return s;
}

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

/* 撃破の判定は W2-T1 と同じ(結果画面、または会話・メニューが無いまま HP 10% 未満でバーが消えた
   状態が 2 回続けて読めた)。撃破の時刻はバーが消えた最初の時刻 */
const DEFEAT_LAST_PCT = 10;
const defeatState = { candidateSim: null, streak: 0 };
function resetDefeatState() { defeatState.candidateSim = null; defeatState.streak = 0; }
async function readBossState(page) {
  return page.evaluate((th) => {
    const wrap = document.getElementById('boss-bar-wrap');
    const fill = document.getElementById('boss-bar-fill');
    const shown = !!(wrap && wrap.classList.contains('show'));
    const last = fill ? parseFloat(fill.style.width) : NaN;
    return {
      shown, last, lowHidden: !shown && last < th,
      overlay: document.getElementById('dialogue-overlay').classList.contains('active') ||
               document.getElementById('menu-overlay').classList.contains('active'),
      clear: document.getElementById('clear-overlay').classList.contains('active'),
      sim: window.__bl.sim,
    };
  }, DEFEAT_LAST_PCT);
}
async function bossDefeated(page) {
  const b = await readBossState(page);
  if (b.shown) { defeatState.candidateSim = null; defeatState.streak = 0; }
  else if (b.lowHidden && defeatState.candidateSim == null) defeatState.candidateSim = b.sim;
  if (b.clear) return true;
  if (b.lowHidden && !b.overlay) defeatState.streak++;
  else defeatState.streak = 0;
  return defeatState.streak >= 2;
}
async function handleMidFightDialogue(page, log) {
  if (!(await dialogueActive(page))) return;
  const b = await readBossState(page);
  const text = await page.locator('#dialogue-text').textContent();
  log.push({ simSec: +b.sim.toFixed(1), text: (text || '').trim(), afterDefeat: b.lowHidden });
  await page.click('#dialogue-overlay');
  await page.waitForTimeout(300);
}

const legSim = (meters) => meters / MAGE_SPEED;
async function waitUntilDone(page, deadline) {
  while ((await sim(page)) < deadline && !(await bossDefeated(page))) {
    await handleMidFightDialogue(page, midDialogues);
    await page.waitForTimeout(400);
  }
}
const setCtl = (page, ctl) => page.evaluate((c) => { window.__bl.ctl = c; }, ctl);

const STRATEGIES = {
  S1: { name: '逃げ回り', policy: '攻撃しない。ボスの周りを x ±12・z 506〜530 の長方形で回り続ける(W2-T1 と同じ)',
    async run(page, deadline) {
      await holdForSim(page, 'KeyS', legSim(9), deadline);
      await holdForSim(page, 'KeyD', legSim(12), deadline);
      while ((await sim(page)) < deadline && !(await bossDefeated(page))) {
        await holdForSim(page, 'KeyW', legSim(24), deadline);
        await holdForSim(page, 'KeyA', legSim(24), deadline);
        await holdForSim(page, 'KeyS', legSim(24), deadline);
        await holdForSim(page, 'KeyD', legSim(24), deadline);
      }
    } },
  S2: { name: '間合いの中で立ち止まる', policy: '入力なし。開始地点(ボスの 5m 手前)に立ったまま(W2-T1 と同じ)',
    async run(page, deadline) { await waitUntilDone(page, deadline); } },
  S3: { name: '攻撃を押し続ける', policy: '移動しない。通常攻撃(J)を押し続ける(W2-T1 と同じ。押し直さないので処刑は出ない)',
    async run(page, deadline) {
      await page.keyboard.down('KeyJ');
      await waitUntilDone(page, deadline);
      await page.keyboard.up('KeyJ');
    } },
  S3T: { name: '攻撃を連打', policy: '移動しない。J を 1 フレームおきに押し直す(処刑の窓の間に押すと処刑になる。PR #89)',
    async run(page, deadline) {
      await setCtl(page, { on: true, tap: true, dodge: false, jDown: false, seq: null });
      await waitUntilDone(page, deadline);
      await setCtl(page, null);
      await page.keyboard.up('KeyJ');
    } },
  S4: { name: '回避を混ぜる(一定間隔)', policy: 'J を押し続け、推定ゲーム内 2 秒ごとに S を押しながら回避(Shift)。予兆は見ていない(W2-T1 と同じ)',
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
  S5: { name: '予兆を見て回避 → 反撃', policy: `J を連打(S3T と同じ)。ボスが最も近い敵で、振りかぶり(Arena の AI State が WINDUP)に変わったら、推定ゲーム内 ${REACT_SIM_SEC} 秒後に、S(カメラ相対。ボス戦はカメラがボスにロックオンするので、ボスから離れる向き)＋回避し、ロールの後に J(回避攻撃)。ボスが最も近くないときの振りかぶりは見えない`,
    async run(page, deadline) {
      await setCtl(page, { on: true, tap: true, dodge: true, jDown: false, seq: null });
      await waitUntilDone(page, deadline);
      await setCtl(page, null);
      for (const k of ['KeyJ', 'KeyW', 'KeyA', 'KeyS', 'KeyD']) await page.keyboard.up(k);
    } },
};

const ORDER = (process.env.W2T2_STRATEGIES || 'S1,S2,S3,S3T,S4,S5').split(',');
const REPS = +(process.env.W2T2_REPS || 2);

for (const sKey of ORDER) {
  for (let rep = 1; rep <= REPS; rep++) {
    const S = STRATEGIES[sKey];
    const id = `${sKey}-${rep}`;
    test(`W2-T2 ${sKey} ${S.name} #${rep}`, async ({ page }) => {
      const errors = watchErrors(page);
      await installProbes(page);
      await openGame(page);

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

      await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
      expect(await clearDialogues(page), '会話を送り切れること').toBe(true);
      await disableCameraAutoFollow(page);
      await expect.poll(async () => (await bossPct(page)).shown, { timeout: 60_000 }).toBe(true);

      // 戦闘の前のプレイヤー(メニューの HP は「今 / 最大」)
      const statsBefore = await readMenuStats(page);
      // Arena のパネルと Debug Info を開く(テストモードの表示だけの切り替え。合成クリックでゲームの入力に触れない)
      await page.evaluate(() => {
        document.getElementById('arena-toggle-btn').click();
        document.getElementById('arena-info-toggle-btn').click();
      });
      await expect(page.locator('#arena-enemy-info')).toBeVisible();
      // ボスの最大 HP(ボスに最も近い今、敵情報が出しているのはボス)
      await expect.poll(() => page.evaluate(() =>
        /HP:\s*\d+\s*\/\s*(\d+)/.exec(document.getElementById('arena-enemy-info').innerHTML || '')?.[1] || null),
        { timeout: 30_000 }).not.toBeNull();
      const bossHpMax = await page.evaluate(() =>
        +(/HP:\s*\d+\s*\/\s*(\d+)/.exec(document.getElementById('arena-enemy-info').innerHTML)[1]));

      midDialogues = [];
      resetDefeatState();
      const real0 = Date.now();
      await page.evaluate((m) => { window.__bl.bossHpMax = m; window.__bl.counting = true; }, bossHpMax);

      const hp = [];
      let sampling = true;
      const sampler = (async () => {
        let nextT = 0;
        while (sampling) {
          const t = await sim(page);
          if (t >= nextT) {
            const b = await bossPct(page);
            hp.push({ simSec: +t.toFixed(1), bossPct: b.pct });
            nextT += SAMPLE_EVERY_SIM_SEC;
          }
          await page.waitForTimeout(400);
        }
      })();
      await S.run(page, SIM_LIMIT_SEC);
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
      let statsAfter = null;
      if (!(await dialogueActive(page)) && !(await page.evaluate(() =>
        document.getElementById('clear-overlay').classList.contains('active')))) {
        statsAfter = await readMenuStats(page).catch(() => null);
      }

      const maxHpBefore = +(String(statsBefore.hp).split('/')[1] || NaN);
      // 通常プレイなら倒れていた時刻: (1) HP1 の最初の記録 (2) 被弾の累計が最大 HP 以上になった時刻
      const firstHp1 = end.notes.find(n => n.ch === 'arena' && n.text.startsWith('TEST MODE'));
      let cum = 0, cumDownAt = null, cumDownHit = null, hitNo = 0;
      for (const [t, k, v] of end.hits) {
        if (k !== 'i') continue;
        hitNo++; cum += v;
        if (cumDownAt == null && cum >= maxHpBefore) { cumDownAt = t; cumDownHit = hitNo; }
      }
      const result = {
        trial: id, strategy: sKey, strategyName: S.name, policy: S.policy,
        conditions: {
          mode: 'テストモード(?dev=1)。通常プレイの値ではない',
          protagonist: 'mage', guest: 'warrior', level: 1, scenario: 'duskvillage', waypoint: 'boss(水鏡の跡 0,515)',
          debugMode: false, cameraAutoFollow: false, arenaDebugInfo: true, simLimitSec: SIM_LIMIT_SEC,
          reactSimSec: sKey === 'S5' ? REACT_SIM_SEC : null,
        },
        statsBefore, statsAfter, bossHpMax,
        estimatedSimSec: +end.sim.toFixed(1),
        realSec: +realSec.toFixed(1),
        avgFps: +(end.frames / Math.max(1, realSec)).toFixed(1),
        bossDefeated: defeated,
        bossDefeatSimSec: defeated && defeatState.candidateSim != null ? +defeatState.candidateSim.toFixed(1) : null,
        defeatConfirmedSimSec: defeated ? +end.sim.toFixed(1) : null,
        bossPctEnd: finalBoss.pct,
        normalPlayDown: {
          firstHp1SimSec: firstHp1 ? firstHp1.t : null,
          cumulativeReachedMaxHpSimSec: cumDownAt,
          cumulativeReachedMaxHpHitNo: cumDownHit,
          maxHpUsed: maxHpBefore,
        },
        bossHp: hp,
        damage: {
          ally: end.ally, player: end.player,
          allyShare: (end.ally.sum + end.player.sum) > 0 ? +(end.ally.sum / (end.ally.sum + end.player.sum)).toFixed(3) : null,
        },
        incoming: {
          n: end.incoming.n, sum: end.incoming.sum,
          perMinSim: end.sim > 0 ? +(end.incoming.n / (end.sim / 60)).toFixed(2) : null,
        },
        hits: end.hits,
        executions: end.notes.filter(n => n.ch === 'arena' && n.text.startsWith('EXECUTION')).map(n => n.t),
        executeWindows: end.execWindows,
        bossAi: { windup: end.boss.windup, recovery: end.boss.recovery, seenFrames: end.boss.seenFrames, frames: end.boss.frames, transitions: end.boss.transitions },
        control: end.ctlLog,
        hpTrace: end.hpTrace,
        notes: end.notes,
        midFightDialogues: midDialogues.filter(d => !d.afterDefeat),
        afterDefeatDialogues: midDialogues.filter(d => d.afterDefeat),
        errors,
      };
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUT_DIR, `${id}.json`), JSON.stringify(result, null, 1));
      await page.screenshot({ path: path.join(OUT_DIR, `${id}-end.png`) });

      expect(hp.length, 'ボスの HP を記録できたこと').toBeGreaterThan(1);
      expect(Number.isFinite(hp[0].bossPct), 'ボスバーを読めたこと').toBe(true);
      expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    });
  }
}
