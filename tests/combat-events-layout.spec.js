// @ts-check
/* UI-002-D WI-D6 ―― 戦闘中の状態表示(処刑・インタラクト・コンボ・ボスバー・制限時間)と、
 * WI-D4 / WI-D5 から引き継いだ重なり(ボスバー×Character Zone、左下ログ×スティック)。
 *
 *   処刑        処刑の対象の敵の上(ダメージ数値と同じ水平位置)に出て、画面中央 60%×60% の中に
 *               収まり、タップを受け取れる。周りのゾーン(Character / Mini-map / Action)を覆わない
 *   インタラクト 対象の上に出て、中央の領域に収まる
 *   コンボ      画面下中央ではなく Action Zone の近く。処刑・Action ボタン・PC の能力表示と重ならない
 *   ボスバー / 制限時間  互いに、また Character Zone・Mini-map Zone と重ならない
 *   左下ログ    844×390 でスティックの領域に重ならず、最新 3 行だけ見える
 *
 * UI-002-D WI-D7(D1〜D6 の統合監査):
 *   入力領域    処刑・インタラクトはスティックの領域・Action ボタンに重ならない(カメラが回って対象が
 *               画面の外・左下に来ても)
 *   押している間 プロンプトを押したままカメラが動いても位置が変わらず、離すと実行される
 *   階層表示    844×390 で Character パネルが洋館の階層表示で広がっても、ボスバー・制限時間と重ならない
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, startTestMode, disableCameraAutoFollow } from './helpers.js';

const INSET = { top: 0, left: 47, bottom: 21, right: 47 };
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const rectOf = (page, sel) => page.locator(sel).first().evaluate(el => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
});
async function setInset(page, inset) {
  if (!inset) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: inset });
}
const zoneOf = vp => ({ left: vp.width * 0.2, top: vp.height * 0.2, right: vp.width * 0.8, bottom: vp.height * 0.8 });
const inZone = (r, z) => r.left >= z.left - 0.5 && r.top >= z.top - 0.5 && r.right <= z.right + 0.5 && r.bottom <= z.bottom + 0.5;

/* 見えている要素の矩形(周りのゾーンの要素。表示されていないものは除く) */
const visibleRects = (page, sels) => page.evaluate(ss => ss.map(s => {
  const el = document.querySelector(s);
  if (!el) return null;
  let n = el;
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    n = n.parentElement;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { sel: s, left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
}).filter(Boolean), sels);
/* TF-03: CI でだけまれに起きる重なり(844×390 でインタラクトが #joy-zone に 0.1px 重なる)の手がかり。
   プロンプトの位置・表示が書き換わるたびに、そのときのページの状態(画面の大きさ・スティックの矩形・
   プロンプトの幅)を控えておき、失敗したときだけメッセージに添える。判定の条件は変えない */
async function recordPromptWrites(page, sel) {
  await page.evaluate(s => {
    const el = document.querySelector(s), joy = document.getElementById('joy-zone');
    const log = window.__promptWrites = [];
    const r4 = r => [r.left, r.top, r.right, r.bottom].map(v => Math.round(v * 1000) / 1000);
    new MutationObserver(() => {
      log.push({ t: Math.round(performance.now()), show: el.classList.contains('show'), style: [el.style.left, el.style.top],
        rect: r4(el.getBoundingClientRect()), ow: el.offsetWidth, vw: innerWidth, vh: innerHeight,
        vv: window.visualViewport ? [visualViewport.width, visualViewport.height, visualViewport.scale] : null,
        joy: joy ? r4(joy.getBoundingClientRect()) : null });
      if (log.length > 10) log.shift();
    }).observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
  }, sel);
}
const promptWrites = page => page.evaluate(() => JSON.stringify(window.__promptWrites || []));

const ZONE_ITEMS = ['.hud-topleft', '#hud-loot', '#minimap-wrap', '#btn-attack', '#btn-jump', '#btn-dodge', '#btn-ult',
  '#btn-charge', '#btn-skill2', '#btn-skill3', '#loot-potion-btn', '#arena-toggle-btn', '#joy-zone'];

/* 処刑の窓が開くまで前進と攻撃を繰り返す(execution-break.spec.js と同じ手順) */
async function attackUntilExecute(page) {
  for (let i = 0; i < 26; i++) {
    await page.keyboard.down('KeyW'); await page.waitForTimeout(240); await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyJ'); await page.waitForTimeout(700); await page.keyboard.up('KeyJ');
    await page.waitForTimeout(160);
    if (await page.locator('#execute-prompt.show').isVisible().catch(() => false)) return true;
  }
  return false;
}

for (const vp of [
  { name: '1280×800・PC', width: 1280, height: 800, touch: false, inset: null },
  { name: '844×390・タッチ', width: 844, height: 390, touch: true, inset: null },
  { name: '844×390・タッチ・safe-area', width: 844, height: 390, touch: true, inset: INSET },
]) {
  test.describe(`UI-002-D WI-D6: 処刑とコンボ(${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch });

    test('処刑は敵の上・中央の領域の中に出てタップでき、コンボは Action Zone の近くで、互いと周りのゾーンに重ならない', async ({ page }) => {
      test.setTimeout(240_000);
      const errors = watchErrors(page);
      await openGame(page);
      await setInset(page, vp.inset);
      await startTestMode(page, { classKey: 'warrior' });
      await expect(page.locator('#hud')).toHaveClass(/active/);
      await disableCameraAutoFollow(page);
      await page.click('#arena-toggle-btn');
      await page.locator('#arena-roster button', { hasText: 'Dummy' }).click();
      await page.click('#arena-toggle-btn');
      await page.waitForTimeout(600);

      expect(await attackUntilExecute(page), '体幹を削り切ると処刑が出る').toBe(true);
      const exec = await rectOf(page, '#execute-prompt');
      const zone = zoneOf(vp);
      expect(inZone(exec, zone), `処刑は中央 60%×60% の中: ${JSON.stringify(exec)}`).toBe(true);
      /* 対象との関係: 処刑の水平位置は、同じフレームで測った HP バー(敵の頭上 2.1、.mob-hp。毎フレーム
         敵の位置へ書き直される)のどれかの水平位置に近い。剣士の薙ぎ払いは訓練場の藁人形にも当たるので、
         HP バーが出ている敵は 1 体とは限らない。以前は最後のダメージ数値の位置と比べていたが、それが
         別の敵の数値だったり、当たった後の前進でカメラが動いていたりすると外れた(CI-001) */
      const same = await page.evaluate(() => {
        const e = document.getElementById('execute-prompt').getBoundingClientRect();
        const bars = [...document.querySelectorAll('.mob-hp')].filter(b => b.style.opacity !== '0')
          .map(b => { const r = b.getBoundingClientRect(); return (r.left + r.right) / 2; });
        return { execX: (e.left + e.right) / 2, w: e.width, bars };
      });
      expect(same.bars.length, '攻撃した敵の HP バーが出ている').toBeGreaterThan(0);
      const nearest = Math.min(...same.bars.map(x => Math.abs(same.execX - Math.max(zone.left, Math.min(zone.right, x)))));
      expect(nearest, `処刑は対象の敵の上: 処刑 x ${same.execX} / HP バー x ${same.bars.join(', ')}`).toBeLessThan(same.w / 2 + 40);
      // タップを受け取れる
      const hit = await page.evaluate(() => {
        const el = document.getElementById('execute-prompt');
        const r = el.getBoundingClientRect();
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!t && (t === el || el.contains(t));
      });
      expect(hit, '処刑がタップを受け取れる').toBe(true);
      // 周りのゾーンを覆わない
      for (const z of await visibleRects(page, ZONE_ITEMS)) {
        expect(overlaps(exec, z), `処刑と ${z.sel}`).toBe(false);
      }
      // コンボ: 連撃の直後に出ている位置(出ていなくても配置は測れる)。画面下中央ではない
      const combo = await rectOf(page, '#combo-indicator');
      expect((combo.left + combo.right) / 2, 'コンボは画面下中央ではなく右寄り').toBeGreaterThan(vp.width * 0.6);
      expect(overlaps(combo, exec), 'コンボと処刑').toBe(false);
      for (const z of await visibleRects(page, ZONE_ITEMS)) {
        expect(overlaps(combo, z), `コンボと ${z.sel}`).toBe(false);
      }
      expect(combo.right, 'コンボは右 inset の内側').toBeLessThanOrEqual(vp.width - (vp.inset ? vp.inset.right : 0) + 0.5);
      // PC: 能力表示の列(キー表記を含む)とも重ならない
      if (!vp.touch) {
        await expect(page.locator('#touch-controls')).toHaveClass(/in-combat/);
        const labelsTop = await page.evaluate(() => {
          const el = document.getElementById('btn-ult');
          return el.getBoundingClientRect().top + parseFloat(getComputedStyle(el, '::after').top || '0');
        });
        expect(combo.bottom, 'コンボは PC 能力表示のキー表記より上').toBeLessThanOrEqual(labelsTop);
      }
      expect(errors).toEqual([]);
    });
  });
}

test.describe('UI-002-D WI-D6: インタラクト(844×390・タッチ)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('インタラクトは中央の領域の中・下中央の固定位置ではなく対象の上に出て、タップを受け取れる', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);
    // 酒場の店主へ歩き、止まった位置でインタラクトが出ている(walkToBartender)
    expect(await walkToBartender(page), 'インタラクトが出る').toBe(true);
    await expect(page.locator('#interact-btn')).toContainText('店主');
    const it = await rectOf(page, '#interact-btn');
    const zone = zoneOf({ width: 844, height: 390 });
    expect(inZone(it, zone), `インタラクトは中央 60%×60% の中: ${JSON.stringify(it)}`).toBe(true);
    // 以前の固定位置(左右中央・下 22%)ではない ―― 対象(店主)の上へ追従している
    const oldTop = 390 - 390 * 0.22 - it.height;
    const fixed = Math.abs((it.left + it.right) / 2 - 422) < 1 && Math.abs(it.top - oldTop) < 1;
    expect(fixed, 'インタラクトは下中央の固定位置ではない').toBe(false);
    for (const z of await visibleRects(page, ZONE_ITEMS)) expect(overlaps(it, z), `インタラクトと ${z.sel}`).toBe(false);
    const hit = await page.evaluate(() => {
      const el = document.getElementById('interact-btn');
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!t && (t === el || el.contains(t));
    });
    expect(hit, 'インタラクトがタップを受け取れる').toBe(true);
    expect(errors).toEqual([]);
  });
});

for (const vp of [
  { name: '1280×800・PC', width: 1280, height: 800, touch: false, inset: null },
  { name: '844×390・タッチ', width: 844, height: 390, touch: true, inset: null },
  { name: '844×390・タッチ・safe-area', width: 844, height: 390, touch: true, inset: INSET },
]) {
  test.describe(`UI-002-D WI-D6: ボスバー・制限時間・ログ(${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch });

    test('ボスバーと制限時間は互いに、また Character Zone・Mini-map Zone と重ならない。ログはスティックに重ならない', async ({ page }) => {
      test.setTimeout(150_000);
      const errors = watchErrors(page);
      await openGame(page);
      await setInset(page, vp.inset);
      await startTestMode(page, { classKey: 'warrior' });
      await expect(page.locator('#hud')).toHaveClass(/active/);
      // 844×390: ログに 4 行以上(Arena の出現)。最新 3 行だけ見える(行は 6.5 秒で消えるので続けて出す)
      if (vp.touch) {
        await page.click('#arena-toggle-btn');
        for (let i = 0; i < 5; i++) {
          await page.locator('#arena-roster button', { hasText: 'Dummy' }).click();
          await page.waitForTimeout(100);
        }
        await page.click('#arena-toggle-btn');
        await expect.poll(() => page.locator('#msg-log .msg-log-line').count(), { timeout: 5_000 }).toBeGreaterThanOrEqual(4);
      }

      // ボスバー・制限時間は条件表示(ボス戦・周回)。フレームごとに書き戻されるため、出す・測る・戻すを
      // 1 回の evaluate で行う。ボスの名前は長めの文言で幅を確かめる
      const m = await page.evaluate(() => {
        const bar = document.getElementById('boss-bar-wrap');
        const timer = document.getElementById('scenario-timer');
        const name = document.getElementById('boss-bar-name');
        const prev = { show: bar.classList.contains('show'), disp: timer.style.display, t: timer.textContent, n: name.textContent };
        bar.classList.add('show'); timer.style.display = 'block'; timer.textContent = '⏱ 12:34'; name.textContent = '屋敷の主の残響';
        const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
        const out = { bar: box(bar), timer: box(timer), panel: box(document.querySelector('.hud-topleft')),
          map: box(document.getElementById('hud-zone-tr')), minimap: box(document.getElementById('minimap-wrap')),
          loot: box(document.getElementById('hud-loot')) };
        bar.classList.toggle('show', prev.show); timer.style.display = prev.disp; timer.textContent = prev.t; name.textContent = prev.n;
        return out;
      });
      expect(overlaps(m.bar, m.timer), 'ボスバーと制限時間').toBe(false);
      for (const [k, r] of [['Character Zone', m.panel], ['所持品', m.loot], ['Mini-map Zone', m.map], ['ミニマップ', m.minimap]]) {
        expect(overlaps(m.bar, r), `ボスバーと ${k}`).toBe(false);
        expect(overlaps(m.timer, r), `制限時間と ${k}`).toBe(false);
      }
      expect(m.bar.right - m.bar.left, 'ボスバーの幅が残っている').toBeGreaterThan(180);

      if (vp.touch) {
        const joy = await rectOf(page, '#joy-zone');
        const lines = await visibleRects(page, ['#msg-log .msg-log-line:nth-last-child(1)', '#msg-log .msg-log-line:nth-last-child(2)',
          '#msg-log .msg-log-line:nth-last-child(3)', '#msg-log .msg-log-line:nth-last-child(4)']);
        expect(lines.length, '844×390 では最新 3 行だけ見える').toBe(3);
        for (const l of lines) {
          expect(overlaps(l, joy), `ログ ${l.sel} はスティックの領域に重ならない`).toBe(false);
          expect(l.left, 'ログは左 inset の内側').toBeGreaterThanOrEqual((vp.inset ? vp.inset.left : 0) + 12 - 0.5);
          for (const r of [m.panel, m.loot]) expect(overlaps(l, r), `ログ ${l.sel} と Character Zone・所持品`).toBe(false);
        }
      }
      expect(errors).toEqual([]);
    });
  });
}

/* 酒場の店主へ歩く(mansion-scenario.spec.js と同じ導線)。止まった後もインタラクトが出ていれば true。
   酒場の固定 spawn(camYaw 135°)では W+A が +Z ―― spawn(0,10) から店主(0,20)へまっすぐ向かい、
   カウンターに当たって範囲(3m)の中で止まる。以前は鍛冶士の作業台(-6.5,12)へ W+D で歩いていたが、
   その道は作業台の範囲の縁(中心から約 2m)をかすめるだけで、家具に当たった時の逸れ方しだいで
   範囲に入らない・入ってすぐ出ることがあった(ゲーム内の時間の進み方で変わる。CI-001) */
async function walkToBartender(page) {
  const shown = () => page.locator('#interact-btn.show').isVisible().catch(() => false);
  for (let i = 0; i < 30; i++) {
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW'); await page.keyboard.up('KeyA');
    await page.waitForTimeout(200);
    if (!(await shown())) continue;
    await page.waitForTimeout(1500);   // 止まるまで(ゲーム内 約0.4秒)
    if (await shown()) return true;
  }
  return false;
}
async function startTavern(page, inset) {
  await openGame(page);
  await setInset(page, inset);
  await page.click('#cc-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
  await dismissIntroDialogue(page);
  await disableCameraAutoFollow(page);
}
const INPUT_ITEMS = ['#joy-zone', '#btn-attack', '#btn-jump', '#btn-dodge', '#btn-ult', '#btn-charge', '#btn-skill2', '#btn-skill3', '#loot-potion-btn'];

for (const inset of [null, INSET]) {
  test.describe(`UI-002-D WI-D7: プロンプトと入力領域(844×390・タッチ${inset ? '・safe-area' : ''})`, () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

    test('カメラを 1 周回す間、インタラクトはスティックの領域・Action ボタンに重ならず、中央の領域の中', async ({ page }) => {
      test.setTimeout(240_000);
      const errors = watchErrors(page);
      await startTavern(page, inset);
      expect(await walkToBartender(page), 'インタラクトが出る').toBe(true);
      const zone = zoneOf({ width: 844, height: 390 });
      // 対象が画面の外(カメラの後ろ)・左下に来る向きを含めて回す。カメラの回転は 1.9 rad/秒(低速描画では
      // 1 フレームの dt が抑えられて遅くなる)なので、測る回数で 1 周以上を見る
      let samples = 0;
      await recordPromptWrites(page, '#interact-btn');
      await page.keyboard.down('KeyQ');
      try {
        for (let i = 0; i < 70; i++) {
          await page.waitForTimeout(250);
          if (!(await page.locator('#interact-btn.show').isVisible().catch(() => false))) continue;
          const it = await rectOf(page, '#interact-btn');
          samples++;
          const hits = (await visibleRects(page, INPUT_ITEMS)).filter(z => overlaps(it, z));
          const why = inZone(it, zone) && !hits.length ? '' : ` 位置の書き換え: ${await promptWrites(page)}`;
          expect(inZone(it, zone), `インタラクトは中央の領域の中: ${JSON.stringify(it)}${why}`).toBe(true);
          for (const z of hits) {
            expect(overlaps(it, z), `インタラクトと ${z.sel}(${i}): ${JSON.stringify(it)} / ${JSON.stringify(z)}${why}`).toBe(false);
          }
        }
      } finally {
        await page.keyboard.up('KeyQ');
      }
      expect(samples, 'カメラを回している間もインタラクトが出ている').toBeGreaterThan(20);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('UI-002-D WI-D7: プロンプトを押している間(844×390・タッチ)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('インタラクトを押したままカメラが動いても位置は変わらず、離すと実行される', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await startTavern(page, null);
    expect(await walkToBartender(page), 'インタラクトが出る').toBe(true);
    await expect(page.locator('#interact-btn')).toContainText('店主');
    await recordPromptWrites(page, '#interact-btn');
    const target = await rectOf(page, '#interact-btn');
    await page.mouse.move((target.left + target.right) / 2, (target.top + target.bottom) / 2);
    await page.mouse.down();
    // 押した瞬間の位置から測る。押すまでは対象に追従していて、押す直前の 1 フレームで丸めが 1px 変わる
    // ことがある(TF-03: CI で押す前 254 → 押してからはカメラが回ってもずっと 253)
    const before = await rectOf(page, '#interact-btn');
    // 押している間にカメラを回す(対象の画面上の位置が動く)
    await page.keyboard.down('KeyQ');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyQ');
    await page.waitForTimeout(300);
    const held = await rectOf(page, '#interact-btn');
    const heldMoved = Math.abs(held.left - before.left) + Math.abs(held.top - before.top);
    expect(heldMoved, `押している間は動かない: ${JSON.stringify(before)} → ${JSON.stringify(held)}${heldMoved < 1 ? '' : ` 位置の書き換え: ${await promptWrites(page)}`}`).toBeLessThan(1);
    await page.mouse.up();
    await expect(page.locator('#scenario-overlay'), '離すとインタラクト(店主と話す = 出撃先の選択)が実行される').toHaveClass(/active/, { timeout: 5_000 });
    // 離した後は対象の上へ追従を再開する(閉じてから測る)
    await page.click('#scenario-close-btn');
    await expect.poll(async () => {
      const r = await rectOf(page, '#interact-btn');
      return Math.abs(r.left - held.left) + Math.abs(r.top - held.top);
    }, { timeout: 10_000 }).toBeGreaterThan(1);
    expect(errors).toEqual([]);
  });
});

for (const inset of [null, INSET]) {
  test.describe(`UI-002-D WI-D7: 階層表示とボスバー(844×390・タッチ${inset ? '・safe-area' : ''})`, () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

    test('洋館の階層表示で Character パネルが広がっても、ボスバー・制限時間と重ならない', async ({ page }) => {
      test.setTimeout(150_000);
      const errors = watchErrors(page);
      await openGame(page);
      await setInset(page, inset);
      // 洋館の階層表示(4 列目)でパネルが既定の幅より広がる。「5F 主の間」は本編のボス戦(館の主)の部屋。
      // 名前の長さでは広がらない(バーの列 3 つ分に収まる)。階層表示は洋館の中だけで出るので、
      // character-zone.spec.js(WI-D4)と同じく表示を強制して文言を入れる
      await startTestMode(page, { classKey: 'warrior' });
      await expect(page.locator('#hud')).toHaveClass(/active/);
      await page.addStyleTag({ content: '.hud-floor{ display:block !important; }' });
      await page.evaluate(() => { document.getElementById('hud-floor').textContent = '5F 主の間'; });
      // パネルの右端は ResizeObserver が次の描画の前に CSS 変数へ書く
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await page.evaluate(() => {
        const bar = document.getElementById('boss-bar-wrap');
        const timer = document.getElementById('scenario-timer');
        const name = document.getElementById('boss-bar-name');
        const prev = { show: bar.classList.contains('show'), disp: timer.style.display, t: timer.textContent, n: name.textContent };
        bar.classList.add('show'); timer.style.display = 'block'; timer.textContent = '⏱ 12:34'; name.textContent = '帰港を望む船長';
        const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
        const out = { bar: box(bar), timer: box(timer), name: box(name), panel: box(document.querySelector('.hud-topleft')),
          map: box(document.getElementById('hud-zone-tr')) };
        bar.classList.toggle('show', prev.show); timer.style.display = prev.disp; timer.textContent = prev.t; name.textContent = prev.n;
        return out;
      });
      const left0 = 16 + 348 + 8 + (inset ? inset.left : 0);
      expect(m.panel.right + 8, `前提: パネルが既定の名前の幅(右端 ${left0 - 8})より広い`).toBeGreaterThan(left0);
      for (const [k, r] of [['ボスバー', m.bar], ['制限時間', m.timer]]) {
        expect(overlaps(r, m.panel), `${k}と Character パネル: ${JSON.stringify(r)} / ${JSON.stringify(m.panel)}`).toBe(false);
        expect(overlaps(r, m.map), `${k}と Mini-map Zone`).toBe(false);
      }
      expect(overlaps(m.bar, m.timer), 'ボスバーと制限時間').toBe(false);
      expect(m.name.bottom - m.name.top, 'ボス名(最長の 7 文字)は 1 行').toBeLessThan(24);
      expect(errors).toEqual([]);
    });
  });
}
