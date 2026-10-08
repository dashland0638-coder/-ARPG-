// @ts-check
/* 時計塔 → 道 → 第一章の終わり(CR-03)。

   この環境(3〜7fps)で本編の時計塔を登り切るのは現実的でないので、区間を
   つないで確かめる(CHAPTER1-CONTENT-plan CR-03「状態注入 E2E」):

     1. 時計塔クリア直後のセーブ → 酒場 → 道の導入(朝の鐘・時計を返す・
        管理人は生還)→ 出撃 → 名もなき街道(盗賊＋弓師)
     2. 道の休憩所の手前(Scenario Test Mode)→ ？？？との出会い → 交代(影の旅人)
        → 最後の戦闘 → 丘 → 酒場 → 第一章の最後の会話

   島の着地(跳躍 → 島 → 人影)は unit(clocktower-finale / road-stranger)と
   Human 実機(CT-05 H-8〜H-12)。道を終えた後の Chapter 2 の入口は
   chapter1-progression.spec.js #10 が見ている。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, dismissIntroDialogue, disableCameraAutoFollow, startTestMode } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

/* 時計塔を終えた本編のセーブ。名前は交代のときに書かれるクラス名(applyChapterCast) */
function saveWith(clears, selectedClass, playerName) {
  return {
    v: 2, selectedClass, selectedGender: 'male', selectedPersonality: 'brave',
    playerName, allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 30, xp: 0, xpToNext: 999999,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 500, gem: 0, potion: 3, shard: 0, mppotion: 1 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedSkill2: true, smithJoined: true, smithGreeted: true, guestClassKey: 'archer',
    scenarioClears: clears, clearedScenarios: {}, routeCombosSeen: {},
  };
}

const overlayActive = page => page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
const lineNow = page => page.evaluate(() =>
  document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent);

/* ミニマップ上でいちばん近い敵の点(#e0574a)。ミニマップはカメラ基準で回るので
   (14-hud-boot.js drawMinimap: 上 = W、右 = D)、中心からの向きをそのまま
   移動キーにできる。単位はワールド距離(半径 108px = 30 ユニット) */
async function nearestEnemy(page) {
  return page.evaluate(() => {
    const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('minimap'));
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const c = cv.width / 2, perUnit = (cv.width / 2 - 16) / 30;
    let best = null;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4;
      if (Math.abs(d[i] - 0xe0) < 12 && Math.abs(d[i + 1] - 0x57) < 12 && Math.abs(d[i + 2] - 0x4a) < 12) {
        const r = Math.hypot(x - c, y - c);
        if (!best || r < best.r) best = { r, x: x - c, y: y - c };
      }
    }
    return best && { dist: best.r / perUnit, right: best.x, up: -best.y };
  });
}

/* 店主の前まで歩いて一覧を開く(chapter1-progression.spec.js と同じ手順) */
async function openScenarioList(page) {
  await disableCameraAutoFollow(page);
  let open = false;
  for (let i = 0; i < 30 && !open; i++) {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    await dismissIntroDialogue(page);
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    open = await page.evaluate(() => document.getElementById('scenario-overlay').classList.contains('active'));
  }
  expect(open, '店主の前でシナリオ一覧が開く').toBe(true);
}

test.describe('時計塔 → 道 → 第一章の終わり（CR-03）', () => {
  test('時計塔クリア後の酒場から、道の導入を聞いて名もなき街道へ出る（本編）', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await page.addInitScript(([key, payload]) => localStorage.setItem(key, payload),
      [SAVE_KEY, JSON.stringify(saveWith({ mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1 }, 'rogue', '盗賊'))]);
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect(page.locator('#hud-name')).toHaveText('盗賊 ｜ 支援: 弓師');

    await openScenarioList(page);
    await page.click('.scenario-sortie-btn[data-scenario="road"]');
    const intro = [];
    for (let i = 0; i < 20; i++) {
      if (!(await overlayActive(page))) break;
      intro.push(await lineNow(page));
      // 最後の行で出撃のワールド切替が走る(scenario-timer.spec.js と同じく evaluate で送る)
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(400);
    }
    expect(intro[0]).toBe('酒場の主人|……隅の席のあいつ、朝から戻っとらん。');
    expect(intro).toContain('酒場の主人|朝の鐘で目を覚ましたら、もういなかった。');
    expect(intro).toContain('盗賊|……それと、これ。塔の管理人に、返しといてくれ。');
    expect(intro.some(l => l.includes('娘の名前を呼んでな'))).toBe(true);
    expect(intro.filter(l => l.includes('影の旅人'))).toEqual([]);

    await expect(page.locator('#minimap-area')).toHaveText('名もなき街道', { timeout: 120_000 });
    await expect(page.locator('#hud-name')).toHaveText('盗賊 ｜ 支援: 弓師');
    expect(errors).toEqual([]);
  });

  test('休憩所で？？？と出会い、影の旅人として最後の戦闘・丘を越えて、第一章の最後の酒場へ', async ({ page }) => {
    test.setTimeout(1_500_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'road', level: 60, waypoint: 'rest' });
    await expect(page.locator('#minimap-area')).toHaveText('名もなき街道', { timeout: 60_000 });

    // 出会い → 交代(road.spec.js と同じ手順)。加入前は「？？？」
    for (let i = 0; i < 40; i++) {
      if ((await page.locator('#dialogue-name').textContent()) === '？？？') break;
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(400);
      await page.keyboard.up('KeyW');
    }
    await expect(page.locator('#dialogue-name')).toHaveText('？？？', { timeout: 120_000 });
    const meeting = [];
    for (let i = 0; i < 200; i++) {
      if ((await page.locator('#hud-name').textContent()).includes('影の旅人')) break;
      if (await overlayActive(page)) {
        meeting.push(await lineNow(page));
        await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      }
      await page.waitForTimeout(1500);
    }
    expect(meeting.filter(l => l.includes('影の旅人'))).toEqual([]);
    await expect(page.locator('#hud-name')).toContainText('影の旅人', { timeout: 60_000 });
    await expect(page.locator('#hud-name')).toContainText('支援: 盗賊');

    // 最後の戦闘: 獣は北(道の先)から来る。北へ少しずつ進みながら攻撃する。
    // 交代の一幕の最後の一拍(フェード明け)が終わってからメニューを開く
    await page.waitForTimeout(5000);
    await disableCameraAutoFollow(page);
    // ログの行は 6.5 秒で消えるので、出た行をすべて控えておく
    await page.evaluate(() => {
      /** @type {any} */ (window).__logSeen = [];
      const log = document.getElementById('msg-log');
      new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n =>
        /** @type {any} */ (window).__logSeen.push(n.textContent)))).observe(log, { childList: true });
    });
    const logSeen = () => page.evaluate(() => /** @type {any} */ (window).__logSeen.join('\n'));
    // ミニマップの敵の点へ向かって歩き、近ければ攻撃する
    for (let i = 0; i < 400; i++) {
      if ((await logSeen()).includes('道の先が、開けている')) break;
      const en = await nearestEnemy(page);
      if (en && en.dist > 2.2) {
        const keys = [];
        if (Math.abs(en.up) > Math.abs(en.right) * 0.4) keys.push(en.up > 0 ? 'KeyW' : 'KeyS');
        if (Math.abs(en.right) > Math.abs(en.up) * 0.4) keys.push(en.right > 0 ? 'KeyD' : 'KeyA');
        for (const k of keys) await page.keyboard.down(k);
        await page.waitForTimeout(250);
        for (const k of keys) await page.keyboard.up(k);
      } else if (!en) {
        // 見えていなければ道の先(北)へ
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(250);
        await page.keyboard.up('KeyW');
      }
      for (let k = 0; k < 3; k++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(120); }
    }
    await expect.poll(logSeen, { timeout: 10_000, message: '最後の戦闘を終えた' }).toContain('道の先が、開けている');

    // 丘(道の終わり)へ。ここからの話者名は「影の旅人」
    for (let i = 0; i < 80; i++) {
      if (await overlayActive(page)) break;
      if ((await page.locator('#dialogue-text').textContent()).includes('何者なんだ')) break;
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(400);
      await page.keyboard.up('KeyW');
    }
    const ending = [];
    let finale = [];
    for (let i = 0; i < 400; i++) {
      if (await overlayActive(page)) {
        const l = await lineNow(page);
        if (l.startsWith('酒場の主人|……戻ったか')) { finale.push(l); break; }
        if (ending[ending.length - 1] !== l) ending.push(l);
        await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      }
      await page.waitForTimeout(1000);
    }
    expect(ending).toContain('盗賊|「……なあ。お前、何者なんだ」');
    expect(ending).toContain('影の旅人|「分かりません」');
    expect(ending).toContain('盗賊|「……まあいい。帰るぞ。今度は、置いていかない」');
    expect(ending.filter(l => l.startsWith('？？？|'))).toEqual([]);

    // 第一章の最後の酒場(12行)
    expect(finale[0]).toBe('酒場の主人|……戻ったか。隅の席、空けたままにしてあるぞ。');
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(500);
      if (!(await overlayActive(page))) break;
      finale.push(await lineNow(page));
    }
    expect(finale.length).toBe(12);
    expect(finale).toContain('影の旅人|はい。私にも。');
    expect(finale[11]).toBe('酒場の主人|さて。ここから先の行き先は、あんたたちで決めな。話だけは、集めておいてやる。');
    expect(finale.filter(l => l.startsWith('？？？|'))).toEqual([]);
    expect(errors).toEqual([]);
  });
});
