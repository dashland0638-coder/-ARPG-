// @ts-check
/* CLOCKTOWER-003: 鐘の後の昇降台の誘導と乗り遅れ対策・管理人と娘の影の表示。
 *
 *   昇降台: 鐘を鳴らすと留め金が外れ、台は下の乗り場で待つ(灯りが脈打ち、床に枠)。乗ると上がる。
 *           上で空のまま下に人がいれば戻ってくる。上の口に近づけば上がってくる。鐘で降りてくる(以前のまま)。
 *   影:     演出の中で現れる管理人と娘の影が、演出の間に実際に濃くなって画面に映る(以前は濃さ 0 のまま消えていた)。
 *           演出の後に残らない。
 *   塔の中の状態を読む口は clocktower-rogue-skill2.spec.js と同じ作法(連結した本体の末尾に足す)
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

const PROBE = `
;window.__ct = {
  go(x, y, z){ state.pos.set(x, y, z); state.yVel = 0; state.grounded = true; lastSolid = state.pos.clone();
    enemies.forEach(e=>{ e.triggered = false; e.dead = true; e.group.visible = false; }); return true; },
  autoCam(on){ camAutoOn = on; },
  lift(){ const L = towerMech && towerMech.lift; return L ? {state:L.state, y:+L.slab.y.toFixed(2), unlocked:!!L.unlocked,
    lamp:+L.lampMat.emissiveIntensity.toFixed(2), mark:!!L.mark.visible, py:+state.pos.y.toFixed(2)} : null; },
  inCutscene(){ return !!cutscene; },
  keeperHeadY(){ const a = apparitions.find(x=> Math.abs(x.group.position.y - 34) < 0.1); if(!a) return null;
    const v = a.group.position.clone(); v.y += 1.62 * a.group.scale.y; v.project(camera); return (-v.y * 0.5 + 0.5) * innerHeight; },
  shades(){ return apparitions.map(a=> ({op:+a.mat.opacity.toFixed(2), y:+a.group.position.y.toFixed(1), color:a.mat.color.getHex()})); },
  // 影(不透明度 0.3 以上の物)だけを不透明のマゼンタで描いて、画面に映る画素を数える(深度・描画の層は本番と同じ。192×96 の縮小)
  shadePixels(){
    const W = 192, H = 96;
    const rt = new THREE.WebGLRenderTarget(W, H);
    const mag = new THREE.MeshBasicMaterial({color:0xff00ff, fog:false, toneMapped:false});
    const sw = [];
    apparitions.forEach(a=>{ if(a.mat.opacity < 0.3) return; a.group.traverse(n=>{ if(n.isMesh){ sw.push([n, n.material]); n.material = mag; } }); });
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    renderer.setRenderTarget(prev); sw.forEach(([n, m])=> n.material = m); rt.dispose(); mag.dispose();
    let c = 0; for(let i=0;i<px.length;i+=4) if(px[i] > 200 && px[i+1] < 60 && px[i+2] > 200) c++;
    return c;
  },
};`;

const overlay = page => page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
const advance = page => page.evaluate(() => document.getElementById('dialogue-overlay').click());
/* 昇降台の状態を待つ。途中で着いた階の会話が開いたら送る(会話の間は世界が止まる)。
   ヘッドレスのソフトウェア描画ではゲームの時間が実時間の 3 分の 1 ほどになる(並行で動かすとさらに遅い)ので、待ちは長めに */
const liftState = page => page.evaluate(() => {
  const o = document.getElementById('dialogue-overlay');
  if (o.classList.contains('active')) o.click();
  return window.__ct.lift().state;
});
async function closeAll(page, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await overlay(page)) await advance(page);
    else if (!(await page.evaluate(() => window.__ct.inCutscene()))) { await page.waitForTimeout(400); if (!(await overlay(page)) && !(await page.evaluate(() => window.__ct.inCutscene()))) return; }
    await page.waitForTimeout(250);
  }
}
async function enterTower(page, waypoint) {
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: `${await r.text()}\n${PROBE}` });
  });
  await openGame(page);
  await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'clocktower', ...(waypoint ? { waypoint } : {}) });
  await expect(page.locator('#minimap-area')).toHaveText('狂いの時計塔', { timeout: 180_000 });
  await page.waitForFunction(() => window.__ct);
  await closeAll(page, 6000);
}

test.describe('CLOCKTOWER-003', () => {
  test('昇降台: 鐘で留め金が外れて乗り場で待つ。乗ると上がり、乗り遅れても戻り、上の口から呼べ、鐘で降りる', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await enterTower(page, 'f5bell');
    expect((await page.evaluate(() => window.__ct.lift())).state, '鳴らす前は留め金が掛かっている').toBe('low');

    // 綱の前で「調べる」→ 鐘(初めての鐘は演出。台の留め金が外れる所を映す)
    await page.evaluate(() => window.__ct.go(-251.5, 34, 30.6));
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyR');
    await expect.poll(() => page.evaluate(() => window.__ct.inCutscene()), { timeout: 5_000 }).toBe(true);
    await closeAll(page, 15_000);
    let L = await page.evaluate(() => window.__ct.lift());
    expect(L.state, `留め金が外れて乗り場で待つ: ${JSON.stringify(L)}`).toBe('ready');
    expect(L.y).toBe(34);
    expect(L.lamp, '台の灯りが点いている').toBeGreaterThan(0.25);
    expect(L.mark, '乗り場の床に枠').toBe(true);

    // 乗らずに待っても、台は行ってしまわない(以前は鳴らして 1.4 秒で上がり、上に残った)
    await page.waitForTimeout(5000);
    L = await page.evaluate(() => window.__ct.lift());
    expect(L.state, '待っても乗り場に残る').toBe('ready');

    // 乗ると上がる
    await page.evaluate(() => window.__ct.go(-246.8, 34, 24.7));
    await expect.poll(() => liftState(page), { timeout: 60_000 }).toBe('top');
    L = await page.evaluate(() => window.__ct.lift());
    expect(L.py, '乗っていた人も上の口(6層)へ').toBeGreaterThan(43.5);

    // 乗り遅れ: 台だけが上にあり、人は下(鐘楼)にいる → ひとりでに戻ってくる
    await page.evaluate(() => window.__ct.go(-262, 34, 50));
    await expect.poll(() => liftState(page), { timeout: 60_000 }).toBe('ready');
    expect((await page.evaluate(() => window.__ct.lift())).y, '戻って乗り場で待つ').toBe(34);

    // 上の口(6層)に近づくと、空の台が上がってくる(下りるために呼べる)
    await page.evaluate(() => window.__ct.go(-247, 44, 29.5));
    await expect.poll(() => liftState(page), { timeout: 60_000 }).toBe('top');

    // 上で乗ったまま待つと下りる。下に着いても、降りるまでは上がり直さない(乗ったままでも ready のまま)
    await page.evaluate(() => window.__ct.go(-246.8, 44, 24.7));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__ct.go(-249.5, 44, 29));   // 一度降りる
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__ct.go(-246.8, 44, 24.7));   // また乗って待つ
    await expect.poll(() => liftState(page), { timeout: 60_000 }).toBe('ready');
    expect((await page.evaluate(() => window.__ct.lift())).py, '乗っていた人も鐘楼へ').toBeLessThan(34.6);
    await page.waitForTimeout(4000);
    expect(await liftState(page), '降りてきた台に乗ったままでも、すぐには上がり直さない').toBe('ready');
    // 一度降りてから乗ると上がる
    await page.evaluate(() => window.__ct.go(-251, 34, 29));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__ct.go(-246.8, 34, 24.7));
    await expect.poll(() => liftState(page), { timeout: 60_000 }).toBe('top');
    await page.evaluate(() => window.__ct.go(-262, 34, 50));
    await expect.poll(() => liftState(page), { timeout: 60_000 }).toBe('ready');
    // 上に呼んでおく(次の鐘の確認のため)
    await page.evaluate(() => window.__ct.go(-247, 44, 29.5));
    await expect.poll(() => liftState(page), { timeout: 60_000 }).toBe('top');

    // 鐘楼で鐘を鳴らすと、上の台が降りてくる(以前のまま)。鳴らしても留め金は外れたまま(何度でも使える)
    await page.evaluate(() => window.__ct.go(-251.5, 34, 30.6));
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyR');
    await expect.poll(() => liftState(page), { timeout: 60_000 }).toBe('ready');
    // もう一度乗れる
    await page.evaluate(() => window.__ct.go(-246.8, 34, 24.7));
    await expect.poll(() => liftState(page), { timeout: 60_000 }).toBe('top');
    expect(errors).toEqual([]);
  });

  for (const auto of [true, false]) {
    test(`影: 演出の中で管理人と娘の影が濃くなり、画面に映る。演出の後に残らない(自動追従 ${auto ? 'ON' : 'OFF'})`, async ({ page }) => {
      test.setTimeout(600_000);
      const errors = watchErrors(page);
      await page.setViewportSize({ width: 844, height: 390 });
      await enterTower(page, 'f2shop');
      await page.evaluate(a => window.__ct.autoCam(a), auto);

      // 2層: 灯りの輪の下 → 作業台の父と娘
      await page.evaluate(() => window.__ct.go(-270, 8, 53.5));
      await expect.poll(() => page.evaluate(() => [window.__ct.inCutscene(), document.getElementById('dialogue-overlay').classList.contains('active'), document.getElementById('dialogue-text').textContent].join('|')), { timeout: 12_000 }).toContain('作業台の二人');
      let s = await page.evaluate(() => window.__ct.shades());
      expect(s.length, `父と娘の二人: ${JSON.stringify(s)}`).toBe(2);
      expect(Math.min(...s.map(x => x.op)), '演出の間に濃くなっている(以前は 0 のまま)').toBeGreaterThan(0.45);
      expect(s.some(x => x.color === 0xbcaee0), '娘は藤色').toBe(true);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/t1-${auto}.png` });
      expect(await page.evaluate(() => window.__ct.shadePixels()), '影が画面に映っている').toBeGreaterThan(40);
      await closeAll(page, 15_000);
      await page.waitForTimeout(2000);
      expect((await page.evaluate(() => window.__ct.shades())).length, '演出の後に残らない').toBe(0);

      // 4層: 七時十三分の繰り返し(食卓の父と娘)。階を移った後も前の影は残らない
      await page.evaluate(() => window.__ct.go(-276, 26, 26));
      await closeAll(page, 12_000);
      await page.evaluate(() => window.__ct.go(-250, 26, 52));
      await expect.poll(() => overlay(page), { timeout: 30_000 }).toBe(true);
      s = await page.evaluate(() => window.__ct.shades());
      expect(s.length, `食卓の二人: ${JSON.stringify(s)}`).toBe(2);
      expect(Math.min(...s.map(x => x.op))).toBeGreaterThan(0.45);
      expect(await page.evaluate(() => window.__ct.shadePixels()), '影が画面に映っている').toBeGreaterThan(40);
      await closeAll(page, 20_000);
      await page.waitForTimeout(2500);
      expect((await page.evaluate(() => window.__ct.shades())).length, '演出の後に残らない').toBe(0);
      expect(errors).toEqual([]);
    });
  }

  test('影: 1層の入口で、縦穴の縁から見下ろす管理人の影が映る', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await enterTower(page, null);
    await page.evaluate(() => window.__ct.go(-262, 0, 52));
    await expect.poll(() => overlay(page), { timeout: 30_000 }).toBe(true);
    // 止まった人々(最初の一文の間)
    let s = await page.evaluate(() => window.__ct.shades());
    expect(s.length, `止まった人々: ${JSON.stringify(s)}`).toBeGreaterThanOrEqual(2);
    expect(Math.max(...s.map(x => x.op))).toBeGreaterThan(0.3);
    // 二文送ると見上げる(3.5 秒)。見上げ終わって次の一文が出た時、縁の管理人が映っている
    // 送りの間(読む時間)の押下は効かないので、目当ての一文が出るまで送り続ける(その一文は送らない)
    await expect.poll(() => page.evaluate(() => {
      const o = document.getElementById('dialogue-overlay'), t = document.getElementById('dialogue-text').textContent;
      if (o.classList.contains('active') && !t.includes('見下ろしていた')) o.click();
      return t;
    }), { timeout: 30_000, intervals: [500] }).toContain('見下ろしていた');
    s = await page.evaluate(() => window.__ct.shades());
    const keeper = s.find(x => x.y === 34);   // 鐘楼の縁の手前
    expect(keeper, `縁の管理人: ${JSON.stringify(s)}`).toBeTruthy();
    expect(keeper.op).toBeGreaterThan(0.5);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/t0-keeper.png` });
    expect(await page.evaluate(() => window.__ct.shadePixels()), '見上げた画面に管理人の影が映っている').toBeGreaterThan(20);
    // 会話の枠に隠れない: 影の頭(縁から 1.62×3 の高さ)が、会話の枠の上端より上に映る
    const head = await page.evaluate(() => window.__ct.keeperHeadY());
    const box = await page.evaluate(() => document.querySelector('#dialogue-overlay .dialogue-box').getBoundingClientRect().top);
    expect(head, `管理人の頭 ${head} は会話の枠の上端 ${box} より上`).toBeLessThan(box - 10);
    await closeAll(page, 12_000);
    await page.waitForTimeout(2000);
    expect((await page.evaluate(() => window.__ct.shades())).length, '演出の後に残らない').toBe(0);
    expect(errors).toEqual([]);
  });
});
