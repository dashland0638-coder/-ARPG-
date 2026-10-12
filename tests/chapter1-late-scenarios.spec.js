// @ts-check
/* CH1-T3(監査 P2-3): 第一章の後半(幽霊船・時計塔)の本編の接続と、本物の戦闘不能。

   本編(テストモードではない)のセーブを仕込んで「つづきから」入る(chapter1-progression.spec.js と
   同じ手口)。この環境は 3〜7fps なので、固定の待ち時間には頼らず、画面の状態(会話の行・HUD・
   ミニマップの地名・オーバーレイ)が変わるのを待つ。

     1. 村クリア後: 弓師＋魔法使いの顔ぶれ、幽霊船への出撃の会話(全行・順番)、幽霊船に着く
     2. 幽霊船クリア後: 盗賊＋弓師の顔ぶれ、時計塔への出撃の会話(全行・順番)、時計塔に着く
        (酒場の棚の船の角灯は unit ghostship-ending が固定している。酒場の卓・椅子の間を手記まで
        歩かせる E2E は、この環境では歩きが詰まって安定しなかったので入れていない)
     3. 本物の戦闘不能: 道(第一章の⑤。出撃地点のすぐ先に最初の戦闘がある)で敵に倒されると戦闘不能の
        画面が出て、所持金が 30% 減り、「街に戻る」で酒場へ戻り、主人公・進行は変わらず、同じ道だけが
        出撃先に出る。洋館の森・村の入口は、この環境の速度では敵まで歩くのに 7 分以上かかるので使わない

   幽霊船・時計塔の **ダンジョンの中** の場面(晩餐の間・船長室・ボスの台詞・崩壊・跳躍・島)と、
   ボスを倒して酒場へ戻ったときの交代の一幕は、ここでは見ていない。第一章の台詞は本編でしか組まれない(`!legacyGrowth()`)ので Scenario Test
   Mode の開始地点は使えず、本編で入口から歩くのはこの環境では現実的でない。配置と条件は unit
   (ghostship-* / clocktower-*)が固定している。E2E にするには、本編経路で途中から始める手段が要る
   (ゲームのコードの変更になるので Human の判断。CH1-T3 の Task 記録 E-8)。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, disableCameraAutoFollow } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

function saveWith({ clears, selectedClass, guestClassKey, playerName, gold = 500 }) {
  return {
    v: 2, selectedClass, selectedGender: 'female', selectedPersonality: 'calm', playerName,
    allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, level: 1, xp: 0, xpToNext: 100,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold, gem: 0, potion: 0, shard: 0, mppotion: 0 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedSkill2: false, smithJoined: !!clears.mansion, smithGreeted: !!clears.mansion,
    smithToolsRecovered: !!clears.mansion, shadowGuideMet: true,
    guestClassKey, scenarioClears: clears, clearedScenarios: {}, routeCombosSeen: {},
  };
}

/* 「つづきから」で入る。セーブは最初の読み込みのときだけ仕込む(以後の再読み込みで上書きしない) */
async function continueFrom(page, save) {
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); }
  }, [SAVE_KEY, JSON.stringify(save)]);
  await openGame(page, { dev: false });
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
}

const overlayActive = page => page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
const lineNow = page => page.evaluate(() =>
  document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent);

/* 会話が開くのを待ってから、閉じるまで 1 行ずつ記録して送る。送った後は行が変わる(か閉じる)のを
   待つので、描画の速さに依存しない */
async function readDialogue(page, { openTimeout = 60_000, max = 40 } = {}) {
  await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: openTimeout });
  const lines = [];
  for (let i = 0; i < max; i++) {
    if (!(await overlayActive(page))) break;
    const l = await lineNow(page);
    lines.push(l);
    await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    await expect.poll(async () => !(await overlayActive(page)) || (await lineNow(page)) !== l, { timeout: 30_000 }).toBe(true);
  }
  return lines;
}

/* 店主の前まで歩いて出撃の一覧を開く(chapter1-progression.spec.js と同じ道。酒場の固定 camYaw で
   W+A が店主の方向)。開いた時点で抜ける */
async function openScenarioList(page) {
  await disableCameraAutoFollow(page);
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => document.getElementById('scenario-overlay').classList.contains('active'))) return;
    if (await overlayActive(page)) { await page.evaluate(() => document.getElementById('dialogue-overlay').click()); continue; }
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW'); await page.keyboard.up('KeyA');
    await page.keyboard.press('KeyF');
  }
  await expect(page.locator('#scenario-overlay'), '店主の前で出撃の一覧が開く').toHaveClass(/active/);
}

/* 出撃: 一覧のボタン → 店主の会話を最後まで送る → ワールドが切り替わる */
async function sortie(page, key, areaName) {
  await openScenarioList(page);
  const cards = await page.$$eval('#scenario-list .scenario-sortie-btn', els => els.map(e => /** @type {HTMLElement} */ (e).dataset.scenario));
  expect(cards, '出撃できるのはいま進めている段ひとつだけ').toEqual([key]);
  await page.click(`.scenario-sortie-btn[data-scenario="${key}"]`);
  const talk = await readDialogue(page);
  await expect(page.locator('#minimap-area')).toHaveText(areaName, { timeout: 120_000 });
  return talk;
}

test.describe('第一章の後半（本編）: 幽霊船・時計塔への接続', () => {
  /* 交代の一幕(弓師・盗賊の加入の会話)は、ボスを倒して酒場へ戻ったときだけ出る
     (14-hud-boot.js advanceChapter1Cast の opts.rebuild)。セーブから入り直すときは一幕を出さずに
     交代だけが済む。ボスを倒さずにその瞬間を作る手段はゲームのコードに無いので、一幕の 7 行・5 行は
     ここでは見ない(Task 記録 E-8)。ここで見るのは、交代した顔ぶれ・出撃の会話の全行と順番・
     出撃先・第一章で出ないもの */
  test('村クリア後: 弓師＋魔法使いで、幽霊船への出撃の会話が順番どおりに出て、幽霊船に着く', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await continueFrom(page, saveWith({ clears: { mansion: 1, duskvillage: 1 }, selectedClass: 'mage', guestClassKey: 'warrior', playerName: '魔法使い' }));
    await expect(page.locator('#hud-name')).toHaveText('弓師 ｜ 支援: 魔法使い');

    const talk = await sortie(page, 'ghostship', '幽霊船');
    expect(talk).toEqual([
      '酒場の主人|幽霊船か。正気の沙汰とも思えんが……',
      '弓師|眉唾だとは思うが、話だけでも聞かせてくれ。',
      '酒場の主人|霧の港に、朽ちた帆船が打ち上げられたそうだ。沈没船から引き上げた"錨"を積んでいたらしくてな。',
      '弓師|ただの錨ひとつで、あそこまで朽ちるものか?',
      '酒場の主人|ただの錨じゃない、という話でな。死者をこの世に縛りつける錨だとか。今も甲板を彷徨う亡霊がいるとか。',
      '弓師|亡霊は、まだ船を降りていない……ということか。',
      '酒場の主人|……さあな。海の男でさえ近寄らん場所さ。よほどの事情がなきゃ勧めんが……それでも行くかい?',
      // 締めの一言は主人公の性格の決まり文句(弓師 = calm。12-progression-ui.js PERSONALITY_LINES)
      '弓師|「……まずは見極めよう。急いては事を仕損じる」',
    ]);
    await expect(page.locator('#hud-name')).toHaveText('弓師 ｜ 支援: 魔法使い');
    // 第一章では周回の制限時間が出ない
    await expect(page.locator('#scenario-timer')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('幽霊船クリア後: 盗賊＋弓師で、時計塔への出撃の会話が順番どおりに出て、時計塔に着く', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await continueFrom(page, saveWith({ clears: { mansion: 1, duskvillage: 1, ghostship: 1 }, selectedClass: 'archer', guestClassKey: 'mage', playerName: '弓師' }));
    await expect(page.locator('#hud-name')).toHaveText('盗賊 ｜ 支援: 弓師');

    const talk = await sortie(page, 'clocktower', '狂いの時計塔');
    expect(talk).toEqual([
      '酒場の主人|時計塔か。……街の連中は、あの塔の鐘で起きて、あの鐘で眠る。',
      '盗賊|その鐘に、何かあったのか?',
      '酒場の主人|それが先月から、毎晩七時十三分きっかりに止まるようになってな。様子を見に入った管理人が、まだ降りてこん。',
      '盗賊|管理人が、一人で?',
      '酒場の主人|ああ。何年か前に、娘さんが家を出たきり戻らんのだと。塔にこもりきりで、様子がおかしいという者もいる。',
      '盗賊|娘の行方と、鐘に何か関係が?',
      '酒場の主人|……さあな。ただ、七時十三分は――娘さんが家を出た時刻だ、という話でな。登るなら覚悟しな。降りる階段は、無いって話もある。',
      '盗賊|「面白い……行くしかないな」',   // 盗賊 = brave
    ]);
    await expect(page.locator('#hud-name')).toHaveText('盗賊 ｜ 支援: 弓師');
    await expect(page.locator('#scenario-timer')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

/* ミニマップ上でいちばん近い、指定した色の点(chapter1-tower-to-road.spec.js の nearestEnemy と同じ読み方)。
   ミニマップはカメラ基準で回るので(14-hud-boot.js drawMinimap: 上 = W、右 = D)、向きをそのまま移動キーにできる。
   敵 = #e0574a、まだ起きていないイベントの「!」= #ffcf4a */
async function nearestDot(page, rgb) {
  return page.evaluate(([R, G, B]) => {
    const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('minimap'));
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const c = cv.width / 2, perUnit = (cv.width / 2 - 16) / 30;
    let best = null;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const i = (y * cv.width + x) * 4;
      if (Math.abs(d[i] - R) < 12 && Math.abs(d[i + 1] - G) < 12 && Math.abs(d[i + 2] - B) < 12) {
        const r = Math.hypot(x - c, y - c);
        if (!best || r < best.r) best = { r, x: x - c, y: y - c };
      }
    }
    return best && { dist: best.r / perUnit, right: best.x, up: -best.y };
  }, rgb);
}
const nearestEnemy = page => nearestDot(page, [0xe0, 0x57, 0x4a]);
const nearestEventMark = page => nearestDot(page, [0xff, 0xcf, 0x4a]);
/* 点の向きへ 1 歩(押している間だけ進む) */
async function stepToward(page, dot) {
  const keys = [];
  if (Math.abs(dot.up) > Math.abs(dot.right) * 0.4) keys.push(dot.up > 0 ? 'KeyW' : 'KeyS');
  if (Math.abs(dot.right) > Math.abs(dot.up) * 0.4) keys.push(dot.right > 0 ? 'KeyD' : 'KeyA');
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(250);
  for (const k of keys) await page.keyboard.up(k);
}

test.describe('第一章（本編）: 本物の戦闘不能', () => {
  test('道で倒されると、戦闘不能 → 所持金 30% 減 → 酒場 → 主人公・進行は変わらず同じ道だけ', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    const clears = { mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1 };
    await continueFrom(page, saveWith({ clears, selectedClass: 'rogue', guestClassKey: 'archer', playerName: '盗賊', gold: 100 }));
    await expect(page.locator('#hud-name')).toHaveText('盗賊 ｜ 支援: 弓師');
    await sortie(page, 'road', '名もなき街道');
    await disableCameraAutoFollow(page);

    /* 道を北へ進み(まだ起きていないイベントの「!」= 道標の方へ)、戦闘1の獣の近くで立ち止まる
       (攻撃しない)。倒されるまで、獣が離れたら寄る */
    const downActive = () => page.evaluate(() => document.getElementById('down-overlay').classList.contains('active'));
    for (let i = 0; i < 3000 && !(await downActive()); i++) {
      if (await overlayActive(page)) { await page.evaluate(() => document.getElementById('dialogue-overlay').click()); continue; }
      const en = await nearestEnemy(page);
      if (en && en.dist <= 2.5) { await page.waitForTimeout(500); continue; }
      const target = en || await nearestEventMark(page);
      // どちらも見えなければ道なりに北(出撃直後の camYaw では W+D が北。mansion-scenario.spec.js)
      await stepToward(page, target || { up: 1, right: 1 });
    }
    await expect(page.locator('#down-overlay'), '倒されると戦闘不能の画面が出る').toHaveClass(/active/);
    await expect(page.locator('#down-overlay .down-title')).toHaveText('力尽きた……');
    // 所持金 100 の 30% = 30(12-progression-ui.js DEFEAT_GOLD_LOSS_MUL)
    await expect(page.locator('#down-penalty-line')).toHaveText('所持金を🪙30失った……');

    await page.click('#down-return-btn');
    await expect(page.locator('#down-overlay')).not.toHaveClass(/active/);
    await expect(page.locator('#minimap-area')).toHaveText('港町の酒場', { timeout: 120_000 });
    await expect(page.locator('#hud-name'), '主人公・支援は変わらない').toHaveText('盗賊 ｜ 支援: 弓師');
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
    expect(saved.inventory.gold, '所持金が 30% 減って保存される').toBe(70);
    expect(saved.scenarioClears, '進行は戻らない・進まない').toEqual(clears);
    expect(saved.selectedClass).toBe('rogue');

    // 同じ道だけが、もう一度出撃先に出る
    await openScenarioList(page);
    const cards = await page.$$eval('#scenario-list .scenario-sortie-btn', els => els.map(e => /** @type {HTMLElement} */ (e).dataset.scenario));
    expect(cards).toEqual(['road']);
    expect(errors).toEqual([]);
  });
});
