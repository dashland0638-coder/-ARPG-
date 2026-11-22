// @ts-check
/* WALK-TALK-CH1: 歩きながらの掛け合いの横展開(宵待ちの村・幽霊船・時計塔。DEC-033)。
 *   ・帯に入ると、主人公と支援の二人の掛け合いが画面の下(#walk-talk)に一行ずつ流れて消える
 *   ・顔ぶれが合わない(合流前・別の組み合わせ)時は出ない
 *   ・会話の窓が長く開いたら、その話題の残りは捨てる(続きを後で出さない)
 *   ・同じ出撃先へもう一度出ると、別の台詞のある話題はそちらになる(保存しない)
 * 道(新)の掛け合いは tests/road2-inn・road2-moor・road2-vale(表示は同じ #walk-talk)
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const GS_CREW_Y = 0;   // 幽霊船の居住区の床(船長室の開始地点と同じ高さ)

const PROBE = `
;window.__wt = {
  line(){ const el = document.getElementById('walk-talk'); return el && el.style.display !== 'none' ? el.textContent : null; },
  st(){ return {world: currentWorldKey, cur: walkTalk.cur && walkTalk.cur.id, queue: walkTalk.queue.map(q=> q.id), seen: Object.keys(walkTalk.seen),
    count: Object.assign({}, walkTalkCount), party: walkTalkParty(), pos: [state.pos.x, state.pos.y, state.pos.z], phase: typeof gsFlags !== 'undefined' ? gsFlags.phase : null, dlg: state.dialogueActive}; },
  go(x, z, y){ state.pos.set(x, y === undefined ? state.pos.y : y, z); state.yVel = 0; state.grounded = true; lastSolid = state.pos.clone(); state.vel.set(0, 0, 0);
    camera.position.copy(state.pos).add(getCamOffset()); return true; },
  clearFoes(){ enemies.forEach(e=>{ if(!e.dead){ e.dead = true; e.triggered = false; if(e.group) e.group.visible = false; } }); combatIntensity = 0; return true; },
  invuln(){ state.invuln = 1e9; return true; },
  dialogue(on){ state.dialogueActive = !!on; return true; },
  relaunch(key){ buildWorld('tavern'); launchScenarioNow(key); return true; },
  running(){ return !!(state.dialogueActive || cutscene); },
  overlayText(){ const o = document.getElementById('dialogue-overlay'); return o.classList.contains('active') ? document.getElementById('dialogue-text').textContent : null; },
};`;

async function enter(page, opts) {
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, opts);
  await page.waitForFunction(() => /** @type {any} */ (window).__wt);
  return (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__wt[fn](...a), [fn, a]);
}

/* 会話の窓・演出が開いていたら送る(掛け合いの試験の間に始まった出来事を閉じる) */
async function closeTalks(page, R, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    if (!(await R('running'))) return;
    await page.waitForTimeout(300);
  }
}

/* 流れる行を順に集める(同じ行は一度だけ)。want の行が全部出るまで */
async function collect(page, R, want, timeout = 90_000) {
  const seen = [];
  await expect.poll(async () => {
    const l = await R('line');
    if (l && !seen.includes(l)) seen.push(l);
    return want.every(w => seen.includes(w));
  }, { timeout, intervals: [200] }).toBe(true);
  return seen;
}

test('宵待ちの村: 剣士の合流前は出ない。合流後、魚屋への小道で魔法使いと剣士の掛け合いが流れて消える', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'mage', guestKey: 'warrior', scenario: 'duskvillage' });
  await expect.poll(async () => (await R('st')).world, { timeout: 120_000 }).toBe('duskvillage');
  await R('invuln');
  const s0 = await R('st');
  expect(s0.party.guestHere, '森では剣士は木橋で待っている').toBe(false);
  expect(s0.seen).toEqual([]);
  await R('go', -30, 348, 0.08);
  await R('clearFoes');
  const seen = await collect(page, R, ['剣士「……魚の匂いがしないな」', '魔法使い「網も、乾ききっています」']);
  expect(seen.indexOf('剣士「……魚の匂いがしないな」')).toBeLessThan(seen.indexOf('魔法使い「網も、乾ききっています」'));
  await expect.poll(() => R('line'), { timeout: 30_000 }).toBeNull();
  expect((await R('st')).count['D-2']).toBe(1);
  // 帯を出て入り直しても、同じ話題は出ない
  await R('go', -20, 340, 0.08);
  await page.waitForTimeout(800);
  await R('go', -30, 348, 0.08);
  await page.waitForTimeout(2500);
  expect((await R('st')).count['D-2']).toBe(1);
  expect(errors).toEqual([]);
});

test('宵待ちの村: 会話の窓が長く開くと、流していた話題の残りは捨てて、後から出さない', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'mage', guestKey: 'warrior', scenario: 'duskvillage' });
  await expect.poll(async () => (await R('st')).world, { timeout: 120_000 }).toBe('duskvillage');
  await R('invuln');
  await R('go', -30, 336, 0.08);   // 船着き場への小道(D-3)。広場の側から
  await R('clearFoes');
  await expect.poll(() => R('line'), { timeout: 60_000 }).toBe('魔法使い「水の音が、近くなりました」');
  await R('dialogue', true);
  await expect.poll(() => R('line'), { timeout: 10_000 }).toBeNull();
  // 会話の窓のあいだ 3 秒(ゲームの時計)を超えると、D-3 の残りは捨てられる
  await expect.poll(async () => { const s = await R('st'); return s.cur === null && !s.queue.includes('D-3'); }, { timeout: 60_000 }).toBe(true);
  await R('dialogue', false);
  for (let k = 0; k < 12; k++) { expect(await R('line')).not.toBe('剣士「板が浮いてる。足元を見ろ」'); await page.waitForTimeout(500); }
  expect(errors).toEqual([]);
});

test('幽霊船: 往路の航海士の私室で弓師と魔法使い。もう一度出ると別の台詞。撃破後の船長室でも流れる', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'archer', guestKey: 'mage', scenario: 'ghostship' });
  await expect.poll(async () => (await R('st')).world, { timeout: 120_000 }).toBe('ghostship');
  await R('invuln');
  await closeTalks(page, R, 20_000);   // 小舟から船を見上げる場面
  expect((await R('st')).phase).toBe('pre');
  await R('go', -23.5, 79, GS_CREW_Y);
  await closeTalks(page, R, 15_000);
  await collect(page, R, ['弓師「……海図が、広げたままです」', '魔法使い「港に、印がついていますね」', '弓師「帰るつもりだったんでしょう」']);
  // もう一度出る(撤退・全滅の後と同じ経路)
  await R('relaunch', 'ghostship');
  await expect.poll(async () => { const s = await R('st'); return s.world === 'ghostship' && s.seen.length === 0; }, { timeout: 120_000 }).toBe(true);
  await closeTalks(page, R, 15_000);
  await R('go', -23.5, 79, GS_CREW_Y);
  await closeTalks(page, R, 15_000);
  await collect(page, R, ['弓師「……さっきと、同じ海図です」', '魔法使い「印も、同じ港のままです」']);
  expect(errors).toEqual([]);
});

test('幽霊船: 撃破後の船長室で「……揺れが、止まりました」', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'archer', guestKey: 'mage', scenario: 'ghostship', waypoint: 'released' });
  await expect.poll(async () => (await R('st')).phase, { timeout: 120_000 }).toBe('released');
  await closeTalks(page, R, 15_000);
  await R('go', -27, 90);
  await collect(page, R, ['弓師「……揺れが、止まりました」', '魔法使い「帰りましょう。今度は、外へ」']);
  expect(errors).toEqual([]);
});

test('時計塔: 前庭で盗賊と弓師。別の顔ぶれ(剣士＋魔法使い)では出ない', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'clocktower' });
  await expect.poll(async () => (await R('st')).world, { timeout: 120_000 }).toBe('clocktower');
  await collect(page, R, ['盗賊「正面から入るのは、性に合わないんだがな」', '弓師「窓は、全部閉まっています」', '盗賊「……今日は、扉からだ」']);
  expect(errors).toEqual([]);
});

test('時計塔: 剣士＋魔法使いで入ると、前庭の掛け合いは出ない(存在しない顔ぶれの会話を出さない)', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  // 第一章のシナリオを選ぶと顔ぶれが揃うので、その後で選び直す
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await page.click('#open-testmode-btn');
  await page.click('#testmode-rules-grid [data-test-rules="current"]');
  await page.click('#testmode-scenario-grid .testmode-job-card[data-scenario-key="clocktower"]');
  await page.click('.class-card[data-key="warrior"]');
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  await page.click('#testmode-guest-grid .testmode-job-card[data-guest-key="mage"]');
  await page.click('#testmode-start-btn');
  const R = (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__wt[fn](...a), [fn, a]);
  await expect.poll(async () => { try { return (await R('st')).world; } catch (e) { return null; } }, { timeout: 120_000 }).toBe('clocktower');
  expect((await R('st')).party.lead).toBe('warrior');
  for (let k = 0; k < 16; k++) { expect(await R('line')).toBeNull(); await page.waitForTimeout(500); }
  expect((await R('st')).seen).toEqual([]);
  expect(errors).toEqual([]);
});
