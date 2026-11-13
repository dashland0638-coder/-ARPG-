// @ts-check
/* UI-VISUAL-001 ―― 通知の表示先・優先度・まとめ・中央の空き。
 *
 *   画面中央はプレイヤー・敵・攻撃の予兆のために空ける。通知は種類ごとに一つの表示先へ:
 *     上の帯(#notice-band) … 危険・物語・出現・節目。左上のパネルとミニマップの間、ボスバー・制限時間の下。
 *                            強い通知ほど上。背の低い画面は 2 件・それ以外は 3 件まで。弱い通知は強い通知を押し出さない
 *     操作ボタンのそば      … 入力を受け付けなかった理由
 *     頭の上               … 自分の行動の結果(小さく、すぐ消える)
 *   通知は ?dev=1 の確認用の口(window.__uiNotice、14-hud-boot.js)で出す。分類の表は tests/unit/notice-rules.test.js
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, startTestMode } from './helpers.js';

const SIZES = [
  { name: 'iPhone 844×390', viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, max: 2 },
  { name: '1280×800', viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false, max: 3 },
  { name: '844×390(PC・キーボード)', viewport: { width: 844, height: 390 }, hasTouch: false, isMobile: false, max: 2 },
  { name: 'タブレット 1180×820(タッチ)', viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, max: 3 },
];
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const rectsOf = (page, sel) => page.evaluate(q => [...document.querySelectorAll(q)].map(e => {
  const r = e.getBoundingClientRect();
  return { text: e.textContent, cls: e.className, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}).filter(r => r.right > r.left && r.bottom > r.top).sort((a, b) => a.top - b.top), sel);   // 見えている順(上から)
// 画面中央の視認領域(横 25〜75%・縦 30〜80%)。プレイヤー・敵・攻撃の予兆がいる所
const centerZone = vp => ({ left: vp.width * 0.25, right: vp.width * 0.75, top: vp.height * 0.3, bottom: vp.height * 0.8 });
const notice = (page, text, kind) => page.evaluate(([t, k]) => window.__uiNotice(t, null, k), [text, kind || null]);

for (const sz of SIZES) {
  test(`${sz.name}: 上の帯は優先度で並び、中央を覆わず、HUD・操作ボタンに重ならない`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: sz.viewport, hasTouch: sz.hasTouch, isMobile: sz.isMobile });
    const page = await context.newPage();
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForFunction(() => typeof window.__uiNotice === 'function');
    await page.waitForTimeout(600);
    // 通知の要素が DOM に加わった回数(並べ替えで付け直すと、同じ通知が二度「出た」ことになる)
    await page.evaluate(() => {
      window.__noticeAdds = [];
      new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1 && n.classList.contains('item-pop')) window.__noticeAdds.push(n.textContent);
      }))).observe(document.getElementById('hud'), { childList: true, subtree: true });
    });

    // 弱い通知が先に満ちていても、危険の警告は押し出して出て、一番上に来る
    await notice(page, '🏅 初制覇! 「習得の証」を手に入れた');
    await notice(page, '🧝 仲間が旅に加わった!');
    await notice(page, '🔨 鍛冶士が同行するようになった');
    await notice(page, '⚠️ 天井の石が軋んだ――落ちてくる!');
    let band = await rectsOf(page, '#notice-band .item-pop.is-toast');
    expect(band.length, `上の帯は ${sz.max} 件まで`).toBe(sz.max);
    expect(band[0].text, '危険の警告が一番上').toContain('天井の石');
    expect(band[0].cls).toContain('notice-danger');
    // 後から来た弱い通知は、危険の警告を押し出さない
    await notice(page, '🗡️ 新しい技を習得した!');
    await notice(page, '✴️ 閃いた ―― 🔍 観測の灯(自動で装備した)');
    band = await rectsOf(page, '#notice-band .item-pop.is-toast');
    expect(band.map(b => b.text).some(t => t.includes('天井の石')), '危険の警告は残る').toBe(true);
    expect((await page.evaluate(() => window.__noticeAdds)).filter(t => t.includes('天井の石')).length, '危険の警告は一度だけ DOM に加わる(並べ替えで付け直さない)').toBe(1);
    // 同じ通知はまとまる(積まない)
    await notice(page, '⚠️ 天井の石が軋んだ――落ちてくる!');
    band = await rectsOf(page, '#notice-band .item-pop.is-toast');
    expect(band.filter(b => b.text.includes('天井の石')).map(b => b.text), '同じ警告は 1 件で ×2').toEqual(['⚠️ 天井の石が軋んだ――落ちてくる!  ×2']);

    // 積んだ通知は互いに重ならず、画面の中・中央の視認領域の外・HUD と操作ボタンに重ならない
    const sorted = [...band].sort((a, b) => a.top - b.top);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].top, '積んだ通知が重ならない').toBeGreaterThanOrEqual(sorted[i - 1].bottom - 0.5);
    const zone = centerZone(sz.viewport);
    const hud = await rectsOf(page, '.hud-topleft, #hud-loot, #minimap-wrap, #btn-attack, #btn-jump, #btn-dodge, #btn-ult, #btn-charge, #btn-skill2, #btn-skill3, #loot-potion-btn, #joy-base');
    for (const r of band) {
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(sz.viewport.width);
      expect(overlaps(r, zone), `上の帯の通知「${r.text}」が中央の視認領域 ${JSON.stringify(zone)} を覆わない: ${JSON.stringify(r)}`).toBe(false);
      for (const h of hud) expect(overlaps(r, h), `「${r.text}」と ${h.cls}`).toBe(false);
    }

    // 入力の理由: 操作ボタンのそば。中央・操作ボタン・HUD に重ならない。同じ理由はまとまる。
    // PC(キーボード)は戦闘中に下へ能力の列が出るので、攻撃して戦闘の構えにしてから測る
    if (!sz.hasTouch) {
      await page.keyboard.press('KeyJ');
      await page.waitForFunction(() => document.querySelector('#touch-controls.in-combat'), null, { timeout: 5_000 });
      hud.push(...await rectsOf(page, '#btn-ult, #btn-charge, #btn-skill2, #btn-skill3, #loot-potion-btn'));
      expect(hud.some(h => h.cls.includes('action-btn')), '能力の列が見えている').toBe(true);
    }
    await notice(page, '⚠ スタミナが足りない!');
    await notice(page, '⚠ スタミナが足りない!');
    const deny = await rectsOf(page, '#hud .item-pop.notice-bottom');
    expect(deny.map(d => d.text)).toEqual(['⚠ スタミナが足りない!  ×2']);
    expect(overlaps(deny[0], zone), `入力の理由 ${JSON.stringify(deny[0])} が中央を覆わない`).toBe(false);
    for (const h of hud) expect(overlaps(deny[0], h), `入力の理由 ${JSON.stringify(deny[0])} と ${h.cls} ${JSON.stringify(h)}`).toBe(false);

    // 長い理由(折り返す)も、中央・操作ボタンに掛からない
    await notice(page, '💥 スキル3が装着されていない(鑑定所で装着できます)');
    const long = await rectsOf(page, '#hud .item-pop.notice-bottom');
    expect(long.length).toBe(1);
    expect(overlaps(long[0], zone), `長い入力の理由 ${JSON.stringify(long[0])} が中央を覆わない`).toBe(false);
    for (const h of hud) expect(overlaps(long[0], h), `長い入力の理由 ${JSON.stringify(long[0])} と ${h.cls} ${JSON.stringify(h)}`).toBe(false);

    // 行動の結果: 頭の上に小さく(上の帯にも、記録にも入らない)
    await notice(page, '⚡ ジャストドッジ!');
    const actor = await rectsOf(page, '#hud .item-pop.notice-actor');
    expect(actor.length).toBe(1);
    expect(actor[0].bottom - actor[0].top, '小さい(1 行)').toBeLessThan(30);
    expect((await rectsOf(page, '#notice-band .item-pop.is-toast')).some(b => b.text.includes('ジャストドッジ'))).toBe(false);

    // ボス戦: 上の帯はボスバーの下へ下がり、ボスバーに重ならない
    const boss = await page.evaluate(() => {
      const bar = document.getElementById('boss-bar-wrap');
      bar.classList.add('show');
      window.__uiNotice('⚠️ 守護神像が腕を引いた――薙ぎ払いが来る!');
      const b = bar.getBoundingClientRect();
      const items = [...document.querySelectorAll('#notice-band .item-pop.is-toast')].map(e => e.getBoundingClientRect())
        .map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
      return { bar: { left: b.left, top: b.top, right: b.right, bottom: b.bottom }, items };
    });
    expect(boss.items.length, 'ボス戦の上の帯(背の低い画面は 1 件)').toBeLessThanOrEqual(sz.max === 2 ? 1 : 3);
    for (const r of boss.items) {
      expect(overlaps(r, boss.bar), `ボスバー ${JSON.stringify(boss.bar)} と通知 ${JSON.stringify(r)}`).toBe(false);
      expect(overlaps(r, zone), `ボス戦の通知 ${JSON.stringify(r)} が中央の視認領域を覆わない`).toBe(false);
    }

    // 消えた通知はメニューの「記録」で読める(危険・節目。行動の結果・入力の理由は残さない)
    await page.waitForTimeout(3000);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
    await page.click('#menu-overlay [data-menu-tab="log"]');
    const log = await page.locator('#menu-notice-log .menu-notice-row').allTextContents();
    expect(log.join(' / ')).toContain('天井の石が軋んだ');
    expect(log.join(' / ')).toContain('仲間が旅に加わった');
    expect(log.join(' / ')).not.toContain('ジャストドッジ');
    expect(log.join(' / ')).not.toContain('スタミナが足りない');
    // 背の低い画面で 1 行に収まらず切れた入力の理由は、全文が記録に残る
    if (sz.max === 2) expect(log.join(' / ')).toContain('スキル3が装着されていない(鑑定所で装着できます)');
    expect(errors).toEqual([]);
    await context.close();
  });
}
