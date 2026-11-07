/* 第一章の出撃会話の台詞(W0-6 の承認 → W1-5 の実装、DEC-016)。

   第一章の本編(!legacyGrowth())では、主人公の受け答え 7 行と締めの一言 5 つを、人物の口調に合わせた
   承認済みの文言にする。会話の順序・行数・主人の台詞は変えない。テストモードの旧成長・第二章以降
   (legacyGrowth() が真)は、旧い文言と性格の決まり文句のまま。
   ここでは 12-progression-ui.js の SCENARIO_TAVERN_DIALOGUE を実際に評価して、5 つの出撃の全行を
   本編・旧成長の両方で突き合わせる。締めの一言の選び方(startScenarioTavernDialogue)はソースの形で見る。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = fs.readFileSync(path.join(root, 'src/legacy/parts/12-progression-ui.js'), 'utf8');
const block = name=>{
  const a = SRC.indexOf(`const ${name} = {`);
  assert.ok(a >= 0, name);
  return SRC.slice(SRC.indexOf('{', a), SRC.indexOf('\n  };', a) + 4);
};
// SCENARIO_TAVERN_DIALOGUE を、話者名と第一章かどうかを決めて評価する
function dialogue(ch1){
  const table = new Function('state', 'legacyGrowth', `return ${block('SCENARIO_TAVERN_DIALOGUE')};`)({ name:'主人公' }, ()=>!ch1);
  return key=>table[key]().map(l=>`${l.name === '酒場の主人' ? 'M' : 'Y'}|${l.text}`);
}
const CLOSING = new Function(`return ${block('CHAPTER1_SORTIE_CLOSING')};`)();
const PERSONALITY = new Function(`return ${block('PERSONALITY_LINES')};`)();

// 承認された変更(DEC-016)。[シナリオ, 旧い文言, 新しい文言]
const CHANGED = [
  ['duskvillage', '何か知っているのか?', '何か、ご存じなんですか?'],
  ['duskvillage', '……忘れられた、ということか。', '……忘れられた、ということですか。'],
  ['duskvillage', '人だけがいない、と。', '人だけが、いないんですね。'],
  ['ghostship', '眉唾だとは思うが、話だけでも聞かせてくれ。', '……詳しく、聞かせてください。'],
  ['ghostship', 'ただの錨ひとつで、あそこまで朽ちるものか?', '錨ひとつで、そこまで朽ちるものでしょうか。'],
  ['ghostship', '亡霊は、まだ船を降りていない……ということか。', '……まだ、船に乗っているんでしょうか。'],
  ['clocktower', '娘の行方と、鐘に何か関係が?', '娘と鐘が、関係あるのか?'],
];
// 主人の台詞で承認された変更(GHOSTSHIP-REBUILD-002: 船は沖に浮かび、小舟で近づく)。本編だけ
const MASTER_CHANGED = [
  ['ghostship', '霧の港に、朽ちた帆船が打ち上げられたそうだ。沈没船から引き上げた"錨"を積んでいたらしくてな。',
                '霧の港の沖に、朽ちた帆船が流れ着いたそうだ。沈没船から引き上げた"錨"を積んでいたらしくてな。'],
  ['ghostship', '……さあな。海の男でさえ近寄らん場所さ。よほどの事情がなきゃ勧めんが……それでも行くかい?',
                '……さあな。海の男でさえ近寄らん場所さ。それでも行くなら、小舟を貸してやる。帰りに沈めるなよ。'],
];
const SCENARIOS = ['mansion', 'duskvillage', 'ghostship', 'clocktower', 'road'];

test('本編: 主人公の受け答え 7 行だけが承認済みの文言になる。順序・行数・主人の台詞・他の行は旧成長と同じ', () => {
  const ch1 = dialogue(true), legacy = dialogue(false);
  let changed = 0;
  for (const key of SCENARIOS) {
    const a = ch1(key), b = legacy(key);
    // 道は本編だけの行(朝の鐘・懐中時計)が既存で入っているので、旧成長より長い。行数・話者の順は他の 4 つで比べる
    if (key !== 'road') {
      assert.equal(a.length, b.length, `${key}: 行数`);
      assert.deepEqual(a.map(l=>l[0]), b.map(l=>l[0]), `${key}: 話者の順`);
    }
    for (const [k, before, after] of CHANGED.filter(c=>c[0] === key)) {
      assert.ok(a.includes(`Y|${after}`), `${k} 本編: ${after}`);
      assert.ok(!a.includes(`Y|${before}`), `${k} 本編に旧い文言が残っていない: ${before}`);
      assert.ok(b.includes(`Y|${before}`), `${k} 旧成長は旧い文言のまま: ${before}`);
      assert.equal(a.indexOf(`Y|${after}`), b.indexOf(`Y|${before}`), `${k}: 同じ位置`);
      changed++;
    }
    // 変更した行以外は、本編と旧成長で同じ(主人の台詞を含む)。
    // 例外は幽霊船の主人の 2 行(GHOSTSHIP-REBUILD-002 で承認: 船は沖に浮かび、小舟で近づく)
    if (key !== 'road') {
      const masterChanged = MASTER_CHANGED.filter(c=>c[0] === key);
      const diff = a.filter((l, i)=>l !== b[i]);
      assert.equal(diff.length, CHANGED.filter(c=>c[0] === key).length + masterChanged.length, `${key}: 変わったのは承認した行だけ`);
      assert.ok(diff.every(l=>l.startsWith('Y|') || masterChanged.some(c=> l === `M|${c[2]}`)), `${key}: 主人の台詞は承認した行の他は変わらない`);
      for (const [, before, after] of masterChanged){
        assert.ok(a.includes(`M|${after}`), `本編の主人: ${after}`);
        assert.ok(b.includes(`M|${before}`), `旧成長の主人は旧い文言のまま: ${before}`);
      }
    }
  }
  assert.equal(changed, 7, '受け答えは 7 行');
  // 洋館・道は受け答えを変えない
  assert.deepEqual(dialogue(true)('mansion'), dialogue(false)('mansion'));
  for (const l of ['Y|いつもあそこに座ってた奴か。', 'Y|探してくる。', 'Y|……それと、これ。塔の管理人に、返しといてくれ。'])
    assert.ok(dialogue(true)('road').includes(l), l);
});

test('締めの一言: 本編はシナリオごとの承認済みの 5 つ。旧成長・第二章以降は性格の決まり文句', () => {
  assert.deepEqual(CLOSING, {
    mansion:     '……行ってくる。',
    duskvillage: '……確かめてきます。',
    ghostship:   'では、行ってきます。',
    clocktower:  '登るさ。降りるのは、そのとき考える。',
    road:        'ああ。日が落ちる前にな。',
  });
  // 性格の決まり文句は消さない(旧成長・第二章以降で使う)
  assert.equal(Object.keys(PERSONALITY).length, 4);
  assert.equal(PERSONALITY.cheerful, '「これは胸が躍る!さあ、行こう!」');
  const fn = SRC.slice(SRC.indexOf('function startScenarioTavernDialogue('), SRC.indexOf('function startBossDialogue('));
  assert.match(fn, /const closing = \(!legacyGrowth\(\) && CHAPTER1_SORTIE_CLOSING\[scenarioKey\]\) \|\| PERSONALITY_LINES\[selectedPersonality\] \|\| '';/);
  // 締めの一言は主人公の発言として 1 行だけ足す(行数は今までどおり)
  assert.match(fn, /closing \? base\.concat\(\[\{name: state\.name \|\| 'あなた', text: closing\}\]\) : base\.slice\(\)/);
});
