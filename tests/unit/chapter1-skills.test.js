import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAPTER1_SKILL_SLOTS, hasSkill2, loadedSkill2Flag, learnSkill2,
  loadoutChangeState, canChangeLoadout, LOADOUT_BLOCK_MESSAGES,
} from '../../src/core/chapter1-skills.js';

test('Chapter 1 の Skill 2 習得', async t=>{
  await t.test('出発時は Skill 1 だけ ―― Skill 2 は持っていない', ()=>{
    assert.equal(hasSkill2({learnedSkill2:false}), false);
    assert.equal(hasSkill2({}), false);
    assert.equal(hasSkill2(null), false);
  });

  await t.test('閃くと持っている状態になり、その場で自動装備される', ()=>{
    const p = {learnedSkill2:false};
    const r = learnSkill2(p);
    assert.equal(r.changed, true);
    assert.equal(r.autoEquipped, true);
    assert.equal(p.learnedSkill2, true);
    assert.equal(hasSkill2(p), true);
  });

  await t.test('同じイベントが二度走っても二度目は何も起きない', ()=>{
    const p = {learnedSkill2:false};
    learnSkill2(p);
    const again = learnSkill2(p);
    assert.equal(again.learned, true);
    assert.equal(again.changed, false);
    assert.equal(again.autoEquipped, false);
  });

  await t.test('テストモードの出撃では閃く前から使える', ()=>{
    assert.equal(hasSkill2({learnedSkill2:false, testMode:true}), true);
  });

  await t.test('装備スロットは2つ', ()=>{
    assert.equal(CHAPTER1_SKILL_SLOTS, 2);
  });
});

test('古いセーブの読み込み', async t=>{
  await t.test('キーが無いセーブ(この機能より前)は習得済みとして読む', ()=>{
    assert.equal(loadedSkill2Flag({}), true);
    assert.equal(loadedSkill2Flag({smithJoined:true}), true);
    assert.equal(loadedSkill2Flag(null), true);
  });

  await t.test('キーがあるセーブはその値をそのまま使う', ()=>{
    assert.equal(loadedSkill2Flag({learnedSkill2:false}), false);
    assert.equal(loadedSkill2Flag({learnedSkill2:true}), true);
  });
});

test('スキル変更が許される瞬間', async t=>{
  const exploring = {started:true, combatStanceT:0};

  await t.test('探索中は変更できる', ()=>{
    assert.equal(canChangeLoadout(exploring), true);
    assert.equal(loadoutChangeState(exploring).reason, null);
  });

  await t.test('戦闘体勢の間は変更できない', ()=>{
    const s = loadoutChangeState({started:true, combatStanceT:1.4});
    assert.equal(s.allowed, false);
    assert.equal(s.reason, 'combat');
    assert.equal(s.message, LOADOUT_BLOCK_MESSAGES.combat);
  });

  await t.test('戦闘が終われば(体勢が切れれば)また変更できる', ()=>{
    assert.equal(canChangeLoadout({started:true, combatStanceT:0}), true);
  });

  await t.test('振っている最中・処刑の再生中も変更できない', ()=>{
    assert.equal(loadoutChangeState({started:true, swinging:true}).reason, 'combat');
    assert.equal(loadoutChangeState({started:true, executeT:0.5}).reason, 'combat');
  });

  await t.test('会話・演出・ボス戦は戦闘体勢より先に弾かれる', ()=>{
    assert.equal(loadoutChangeState({started:true, dialogueActive:true}).reason, 'dialogue');
    assert.equal(loadoutChangeState({started:true, cutsceneActive:true}).reason, 'cutscene');
    // ボス戦中の会話はボス扱い(より重いほうを理由にする)
    assert.equal(loadoutChangeState({started:true, bossActive:true, dialogueActive:true}).reason, 'boss');
    assert.equal(loadoutChangeState({started:true, cutsceneActive:true, dialogueActive:true}).reason, 'cutscene');
  });

  await t.test('出撃前は理由付きで弾かれる', ()=>{
    const s = loadoutChangeState({started:false});
    assert.equal(s.allowed, false);
    assert.equal(s.reason, 'notStarted');
  });

  await t.test('引数なしでも落ちない', ()=>{
    assert.equal(canChangeLoadout(), false);
  });
});
