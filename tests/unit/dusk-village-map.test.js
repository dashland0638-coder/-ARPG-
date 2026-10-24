/* 宵待ちの村のマップ骨格(core/dusk-village-map.js)。

   部屋テーブルの間違いは「到達できない区画」「開かない開口」という形で出る。
   実機で気づくには村の端まで歩く必要があり、ヘッドレス(SwiftShader)は実プレイの
   1割程度の速度しか出ないのでE2Eでは現実的でない ―― 表そのものをここで縛る。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DUSK_ENTRY, DUSK_ROOMS, duskRoomAt, duskRoomById,
  duskNeighbors, duskReachableFrom, duskAmbienceZoneFor, duskBounds,
} from '../../src/core/dusk-village-map.js';

test('部屋テーブルの整合性', async (t) => {
  await t.test('部屋同士が重なっていない', () => {
    for (let i = 0; i < DUSK_ROOMS.length; i++) {
      for (let j = i + 1; j < DUSK_ROOMS.length; j++) {
        const a = DUSK_ROOMS[i], b = DUSK_ROOMS[j];
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
        assert.ok(ox <= 0 || oz <= 0, `${a.id} と ${b.id} が重なっている`);
      }
    }
  });

  await t.test('id が一意で、x0<x1 / z0<z1 になっている', () => {
    const ids = new Set();
    DUSK_ROOMS.forEach(r => {
      assert.ok(!ids.has(r.id), `id が重複: ${r.id}`);
      ids.add(r.id);
      assert.ok(r.x0 < r.x1 && r.z0 < r.z1, `${r.id} の矩形が潰れている`);
      assert.ok(typeof r.name === 'string' && r.name.length > 0, `${r.id} に名前がない`);
    });
  });

  await t.test('すべての開口に、突き合う相手の部屋がある', () => {
    DUSK_ROOMS.forEach(r => {
      Object.entries(r.gaps || {}).forEach(([side, gap]) => {
        const found = duskNeighbors(r);
        assert.ok(found.length > 0, `${r.id} の ${side} 開口に相手がいない`);
      });
      // 開口ごとに個別に相手がいることまで見る
      Object.entries(r.gaps || {}).forEach(([side, gap]) => {
        if (gap === 'full') return;
        const [a, b] = gap;
        const hit = DUSK_ROOMS.some(o => o !== r && (
          (side === 'N' && o.z0 === r.z1 && o.x0 <= a && o.x1 >= b) ||
          (side === 'S' && o.z1 === r.z0 && o.x0 <= a && o.x1 >= b) ||
          (side === 'E' && o.x0 === r.x1 && o.z0 <= a && o.z1 >= b) ||
          (side === 'W' && o.x1 === r.x0 && o.z0 <= a && o.z1 >= b)));
        assert.ok(hit, `${r.id}.${side} の開口 [${a}, ${b}] に突き合う部屋がない`);
      });
    });
  });

  await t.test('繋がりは双方向', () => {
    DUSK_ROOMS.forEach(r => {
      duskNeighbors(r).forEach(id => {
        assert.ok(duskNeighbors(duskRoomById(id)).includes(r.id),
          `${r.id} → ${id} が片方向になっている`);
      });
    });
  });
});

test('正式な導線', async (t) => {
  await t.test('出撃地点は森の部屋の内側にある', () => {
    const r = duskRoomAt(DUSK_ENTRY.x, DUSK_ENTRY.z);
    assert.equal(r && r.id, 'forest');
  });

  await t.test('入口からすべての部屋へ到達できる', () => {
    const seen = duskReachableFrom('forest');
    DUSK_ROOMS.forEach(r => assert.ok(seen.has(r.id), `${r.id} へ到達できない`));
  });

  await t.test('正式仕様の順路が、その順番で繋がっている', () => {
    // 村入口 → 中央広場 → 商店街 → 水門前 → 水門 → 村の奥 → ボスエリア
    const spine = ['forest', 'bridge', 'gate', 'plaza', 'market', 'yard', 'sluice', 'deep', 'bossArea'];
    for (let i = 0; i < spine.length - 1; i++) {
      assert.ok(duskNeighbors(duskRoomById(spine[i])).includes(spine[i + 1]),
        `${spine[i]} と ${spine[i + 1]} が繋がっていない`);
    }
  });

  await t.test('中央広場から魚屋・住宅・商店街へ枝が出ている', () => {
    const fromPlaza = duskNeighbors(duskRoomById('plaza'));
    assert.ok(fromPlaza.includes('fishCor'), '魚屋への枝がない');
    assert.ok(fromPlaza.includes('homeCor'), '住宅への枝がない');
    assert.ok(fromPlaza.includes('market'), '商店街への枝がない');
    // 船小屋は魚屋の小道から南へ降りる(広場の隣ではない)
    assert.ok(duskNeighbors(duskRoomById('fishCor')).includes('boatCor'), '船小屋への枝がない');
    assert.ok(duskNeighbors(duskRoomById('boatCor')).includes('boat'));
  });

  await t.test('旧実装の蜘蛛の巣状レイアウトが残っていない', () => {
    // 旧 DUSK_ROOMS は hub1/hub2/hub3 + pier1..5 + 民家A/B/C だった
    const ids = DUSK_ROOMS.map(r => r.id);
    ['hub1', 'hub2', 'hub3', 'pier1', 'pier5', 'square', 'watch', 'fisher'].forEach(old =>
      assert.ok(!ids.includes(old), `旧レイアウトの部屋が残っている: ${old}`));
  });
});

test('部屋の問い合わせ', async (t) => {
  await t.test('duskRoomAt は矩形の内側で、その部屋を返す', () => {
    assert.equal(duskRoomAt(0, 350).id, 'plaza');
    assert.equal(duskRoomAt(-45, 348).id, 'fish');
    assert.equal(duskRoomAt(45, 348).id, 'homes');
    assert.equal(duskRoomAt(0, 450).id, 'sluice');
  });

  await t.test('部屋の外(水の上)では null', () => {
    assert.equal(duskRoomAt(0, 200), null);      // 村の手前
    assert.equal(duskRoomAt(-100, 350), null);   // 西の水面
  });

  await t.test('小道は cor:true。場所名は手前の部屋を引き継ぐ側', () => {
    ['bridge', 'fishCor', 'boatCor', 'homeCor'].forEach(id =>
      assert.equal(duskRoomById(id).cor, true, `${id} が小道になっていない`));
    ['plaza', 'fish', 'homes', 'market', 'sluice'].forEach(id =>
      assert.equal(!!duskRoomById(id).cor, false, `${id} が小道扱いになっている`));
  });

  await t.test('環境音の区画: 入口は岸、村は村、水門から奥は深部、ボスは無音', () => {
    assert.equal(duskAmbienceZoneFor('forest'), 'duskShore');
    assert.equal(duskAmbienceZoneFor('gate'), 'duskShore');
    assert.equal(duskAmbienceZoneFor('plaza'), 'duskVillage');
    assert.equal(duskAmbienceZoneFor('fish'), 'duskVillage');
    assert.equal(duskAmbienceZoneFor('sluice'), 'duskDeep');
    assert.equal(duskAmbienceZoneFor('deep'), 'duskDeep');
    assert.equal(duskAmbienceZoneFor('bossArea'), null);
  });

  await t.test('歩ける範囲は他ダンジョンの帯(z>260)の内側に収まっている', () => {
    const b = duskBounds(6);
    assert.ok(b.z0 > 260, '村の南端が他ダンジョンの帯へ食い込んでいる');
    // worldKeyForPos は x>400 を training として先に判定する
    assert.ok(b.x1 < 400 && b.x0 > -400);
  });
});

/* CH1-COMP W3: 探索の道筋。閂の門(広場 → 商店街の表通り)と水門で、
   直進ではボスへ届かない。回り道(住宅 → 裏通り → 商店街の東)と、水門守の撃破が要る */
import {
  DUSK_BARRIERS, duskCanPass, duskReachableWith, duskRoute, DUSK_SLUICE_BLOCKS, DUSK_SLUICE_Z,
} from '../../src/core/dusk-village-map.js';

test('W3 探索の道筋', async (t) => {
  await t.test('何も開いていない時: ボスの部屋・村の奥へは届かない。水門(水門守のいる所)までは届く', () => {
    const seen = duskReachableWith('forest', {});
    assert.ok(!seen.has('deep'));
    assert.ok(!seen.has('bossArea'));
    assert.ok(seen.has('sluice'), '水門守と戦う場所へは、条件なしで行ける(閉じ込めが無い)');
    assert.ok(seen.has('market') && seen.has('yard'));
  });

  await t.test('表通り(広場 → 商店街)は閂で通れない。商店街の側からは外して通れる', () => {
    assert.equal(duskCanPass('plaza', 'market', {}), false);
    assert.equal(duskCanPass('market', 'plaza', {}), true);
    assert.equal(duskCanPass('plaza', 'market', {barGateOpen: true}), true);
    assert.equal(duskCanPass('sluice', 'deep', {}), false);
    assert.equal(duskCanPass('deep', 'sluice', {}), false);
    assert.equal(duskCanPass('sluice', 'deep', {sluiceOpen: true}), true);
  });

  await t.test('最短の道は裏通りを通り、水門を経てボスへ', () => {
    const route = duskRoute('forest', 'bossArea', {sluiceOpen: true});
    assert.deepEqual(route, ['forest', 'bridge', 'gate', 'plaza', 'homeCor', 'homes', 'alley', 'alleyCor',
      'market', 'yard', 'sluice', 'deep', 'bossArea']);
    assert.equal(duskRoute('forest', 'bossArea', {}), null);
    // 閂を外した後(近道)は表通りが最短になる
    const back = duskRoute('forest', 'bossArea', {sluiceOpen: true, barGateOpen: true});
    assert.ok(back.includes('market') && !back.includes('alley'));
  });

  await t.test('行き止まりの部屋: 寄り道の魚屋・船小屋・見張り小屋(水門前の西)と、森(出撃地点)・水鏡の跡(ボス)', () => {
    const deadEnds = DUSK_ROOMS.filter(r => !r.cor && duskNeighbors(r).length === 1).map(r => r.id).sort();
    assert.deepEqual(deadEnds, ['boat', 'bossArea', 'fish', 'forest', 'lookout']);
    assert.ok(duskNeighbors(duskRoomById('yard')).includes('lookout'));
  });

  await t.test('門は表の開口の上にある(閂 = 広場の北、水門 = 水門の部屋の中)', () => {
    const plaza = duskRoomById('plaza');
    assert.ok(plaza.gaps.N, '広場の北の口は表に残っている(閂の門で塞ぐだけ)');
    DUSK_BARRIERS.forEach(b => {
      assert.ok(duskRoomById(b.a) && duskRoomById(b.b), b.id);
      assert.ok(duskNeighbors(duskRoomById(b.a)).includes(b.b), `${b.id} は隣り合う部屋の間`);
    });
  });

  await t.test('水門の門・柱・石垣が水門の部屋の幅を隙間なく塞ぐ', () => {
    const sluice = duskRoomById('sluice');
    const spans = DUSK_SLUICE_BLOCKS.map(b => [b.x0, b.x1]).sort((a, b) => a[0] - b[0]);
    assert.equal(spans[0][0], sluice.x0);
    assert.equal(spans[spans.length - 1][1], sluice.x1);
    for (let i = 1; i < spans.length; i++) {
      assert.ok(spans[i][0] <= spans[i - 1][1] + 1e-9, `隙間: ${spans[i - 1][1]} 〜 ${spans[i][0]}`);
    }
    // プレイヤーの半径(0.4)より厚い
    assert.ok(DUSK_SLUICE_Z.gateZ1 - DUSK_SLUICE_Z.gateZ0 > 0.4 * 2 - 1e-9);
    assert.ok(DUSK_SLUICE_Z.z0 < 450 && DUSK_SLUICE_Z.z1 > 450);
  });

  await t.test('新しい区画の位置', () => {
    assert.equal(duskRoomAt(45, 380).id, 'alley');
    assert.equal(duskRoomAt(30, 387).id, 'alleyCor');
    assert.equal(duskRoomAt(-40, 420).id, 'lookout');
  });
});
