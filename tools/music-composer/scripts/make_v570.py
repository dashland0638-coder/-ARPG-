"""v5.69.0 → v5.70.0: 酒場完成版のギターの和音を、同時に鳴っている音に合わせる。

v5.69.0 までのギター(tavernGuitarVoicing)は、
  ・和音を1小節ごとに t.chords の4つで回す(チェロ・ハープ・旋律の和音と合わない小節が多い)
  ・4音の和音の先頭3音を「根音・3度・5度」として使う(例: [3,2,5,0] → G・F#・B で G と F# が半音)
  ・旋律と半音でぶつかる音を1オクターブ下げるだけ(音名はぶつかったまま)
ので、同時に鳴る音と 27% が半音・増4度・長7度でぶつかっていた。

v5.70.0 は、ストロークの間に実際に鳴っている低音(ベース・チェロ)と旋律(ヴィオラ・フルート・ベル・
ハープ・ピアノ)から、D メジャーの三和音(I ii iii IV V vi)を選ぶ。低音が根音なら強く、和音の音なら少し
加点、半音・増4度でぶつかれば減点、計画の和音(t.chords)の根音なら少し加点。和音は根音・3度・5度で組み、
声部の形(低い根音・5度、根音・3度・5度)と音域は v5.69.0 と同じ。それでもぶつかる音は省く(根音は残す)。

あわせて、ギターのセル試聴が別の小節の和音を鳴らしていた不具合を直す(小節ではなく音の番号を渡していた)。
リズム・長さ・強さ・ギターの編集(guitarEdits)は v5.69.0 のまま。v5.69.0 は読むだけ。

  python3 -I make_v570.py ARPG_Music_AI_Composer_v5_69_0.html ARPG_Music_AI_Composer_v5_70_0.html
"""
import sys
src_path, out_path = sys.argv[1], sys.argv[2]
s = open(src_path, encoding='utf-8').read()

def r(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a))
    s = s.replace(a, b)

r('''function tavernGuitarVoicing(track,bar){''',
  '''/* v5.70: 同時に鳴っている音に合う三和音でストロークの和音を組む */
function tavernGuitarChordVoicing(track,step,events,from,to){
  const root=62, scale=scaleFor("D Major");
  const pc=n=>((n%12)+12)%12, rub=d=>d===1||d===6||d===11;
  const sounding=(events||[]).filter(e=>!e.rest&&e.n!=null&&!Array.isArray(e.n)&&e.instrument!=="Guitar"&&e.start<to&&e.start+e.duration>from);
  const isLow=e=>e.instrument==="Bass"||e.instrument==="Cello";
  const low=sounding.filter(isLow).map(e=>pc(e.n)), high=sounding.filter(e=>!isLow(e)).map(e=>pc(e.n));
  const chords=track?.chords||[[0,2,4]];
  const plan=((Number((chords[Math.min(chords.length-1,Math.floor(step/8))]||[0])[0])||0)%7+7)%7;
  let best=null;
  for(const deg of [0,1,2,3,4,5]){            // vii°(減三和音)は使わない
    const tones=[0,2,4].map(k=>pc(degreeMidi(root,scale,deg+k,0)));
    const clash=n=>tones.some(c=>rub(pc(n-c)));
    let score=deg===plan?1:0;
    for(const b of low){ score+=b===tones[0]?3:tones.includes(b)?1.5:-1; if(clash(b)) score-=4; }
    for(const m of high){ if(tones.includes(m)) score+=1; if(clash(m)) score-=2; }
    if(!best||score>best.score) best={deg,score};
  }
  const base=degreeMidi(root,scale,best.deg,0);
  const third=degreeMidi(root,scale,best.deg+2,0), fifth=degreeMidi(root,scale,best.deg+4,0);
  const all=[...low,...high];
  // 声部は v5.69 と同じ形(低い根音・低い5度・根音・3度・5度)。ぶつかる音は省く(根音は残す)
  return [base-12,fifth-12,base,third,fifth].filter((n,k)=>k===0||k===2||!all.some(x=>rub(pc(x-n))));
}
function tavernGuitarVoicing(track,bar){''')

r('''    const voicing=tavernGuitarVoicing(t,Math.floor(i/2));''',
  '''    const voicing=tavernGuitarChordVoicing(t,i,events,bs,bs+Math.min(guitarDur,sec*2));   // v5.70''')

r('''    const voicing=tavernGuitarVoicing(state.track,e.index||0);''',
  '''    // v5.70: 譜面のストロークと同じ和音(v5.69 までは音の番号を小節として渡し、別の和音を鳴らしていた)
    const voicing=Array.isArray(e.n)?e.n:tavernGuitarVoicing(state.track,Math.floor((e.index||0)/2));''')

s = s.rstrip('\n') + '\n\n<!-- v5.70.0: tavern guitar strums pick a D-major triad that fits the notes sounding with them (bass/cello root, melody); clashing chord tones are omitted. Guitar cell preview plays the strum in the score. Rhythm, length, level and guitar edits unchanged from v5.69.0. -->\n'
open(out_path, 'w', encoding='utf-8').write(s)
print('ok', len(s))
