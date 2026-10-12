"""v5.67.0 → v5.68.0(合成音モードの譜面と音のずれを直す)。v5.67.0 は読むだけ"""
import sys
src_path, out_path = sys.argv[1], sys.argv[2]
s = open(src_path, encoding='utf-8').read()

def r(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a))
    s = s.replace(a, b)

# --- buildTruthScore: 譜面の値 = 実際に鳴らす値 ---
r(''' const add=(instrument,index,start,duration,n,level,kind="note",editable=true)=>{
  const percussion=instrument==="Drums" && (kind==="kick"||kind==="snare"||kind==="hat");
  if(n==null && kind!=="rest" && !percussion)return;
  events.push({instrument,index,start,duration,n,level,kind,editable,rest:kind==="rest"});
 };''', ''' // v5.68: level / duration は playTrack が実際に鳴らす値(セル音量を掛ける前)。
 // space は奥行き: min(1, 奥行き × mul + add)。省略は {mul:1, add:0}
 const add=(instrument,index,start,duration,n,level,kind="note",editable=true,space=null)=>{
  const percussion=instrument==="Drums" && (kind==="kick"||kind==="snare"||kind==="hat"||kind==="pulse");
  if(n==null && kind!=="rest" && !percussion)return;
  events.push({instrument,index,start,duration,n,level,kind,editable,rest:kind==="rest",space});
 };''')
r('''   add("Viola",i,st,melodyDur,x.n,.075*density*arrangementWeight(t,"Viola",section),"melody");''',
  '''   // v5.68: 再生で掛けていた ×1.18・酒場の補正・最後の区間の長さ ×1.16 を譜面にも入れる
   add("Viola",i,st,melodyDur*(section===3?1.16:1),x.n,tavernMixLevel(t,"Viola",.075*density*arrangementWeight(t,"Viola",section)*1.18),"melody");''')
r('''    add("Flute",i,st,fluteDur,fluteNote,tavernMixLevel(t,"Flute",.050*density*arrangementWeight(t,"Flute",section)),"harmony");''',
  '''    add("Flute",i,st,fluteDur,fluteNote,tavernMixLevel(t,"Flute",.050*density*arrangementWeight(t,"Flute",section)),"harmony",true,{mul:1,add:.1});''')
r('''    add("Flute",i,st+.015,fluteDur,(a?.n??x.n)+12,tavernMixLevel(t,"Flute",.055*density*(section===2?1.10:section===3?.92:1)*arrangementWeight(t,"Flute",section)),"response");''',
  '''    add("Flute",i,st+.015,fluteDur,(a?.n??x.n)+12,tavernMixLevel(t,"Flute",.055*density*(section===2?1.10:section===3?.92:1)*arrangementWeight(t,"Flute",section)),"response",true,{mul:1,add:.1});''')
r('''add("Bell",i,st,Math.min(2,sec*2.2),x.n+12,.028*density*arrangementWeight(t,"Bell",section),"accent");''',
  '''add("Bell",i,st,Math.min(2,sec*2.2),x.n+12,.028*density*arrangementWeight(t,"Bell",section),"accent",true,{mul:1,add:.25});''')
r('''  if(tavernAllows(t,"Bass")) add("Bass",i,st,Math.min(sec*x.d*.94,sec*1.6),x.n,tavernMixLevel(t,"Bass",.078*arrangementWeight(t,"Bass",i)),"bass");''',
  '''  // v5.68: 酒場の補正は確定版の再生と同じく2回(音量を変えない)
  if(tavernAllows(t,"Bass")) add("Bass",i,st,Math.min(sec*x.d*.94,sec*1.6),x.n,tavernMixLevel(t,"Bass",tavernMixLevel(t,"Bass",.078*arrangementWeight(t,"Bass",i))),"bass",true,{mul:.45,add:0});''')
r('''   add("Cello",Number(x.m)||i,st,celloDur,tone,tavernMixLevel(t,"Cello",.085*arrangementWeight(t,"Cello",i)),"foundation");}''',
  '''   add("Cello",Number(x.m)||i,st,celloDur,tone,tavernMixLevel(t,"Cello",tavernMixLevel(t,"Cello",.085*arrangementWeight(t,"Cello",i))),"foundation",true,{mul:.8,add:0});}''')
r('''    const level=.030*Math.max(.9,style.guitar||0);''',
  '''    // v5.68: 譜面の .030 は再生に使われていなかった。確定版の音(再生の .045)に合わせる
    const level=.045*Math.max(.9,style.guitar||0);''')
r('''   for(let bar=0;bar<tm.barCount;bar+=2){const idx=bar*2;const x=phrase[idx%phrase.length];if(x?.n!=null){const actual=tm.eventStart(idx);add("Guitar",bar,actual,sec*.34,x.n,.030*style.guitar,"guitar",false);}}''',
  '''   // v5.68: 再生と同じ長さ(.30拍)・強さ。セル音量の番号も再生と同じ idx
   for(let bar=0;bar<tm.barCount;bar+=2){const idx=bar*2;const x=phrase[idx%phrase.length];if(x?.n!=null){const actual=tm.eventStart(idx);add("Guitar",idx,actual,sec*.30,x.n,tavernMixLevel(t,"Guitar",.024*style.guitar),"guitar",false);}}''')
r('''   add("Drums",bar*2,bs,.16,null,.072*style.drums,"kick",false);
   add("Drums",bar*2+1,bs+barDur*.50,.12,null,.050*style.drums,"snare",false);''',
  '''   // v5.68: 再生と同じ強さ(キック .090、スネアはその ×.78、酒場の補正)
   add("Drums",bar*2,bs,.16,null,tavernMixLevel(t,"Drums",.090*style.drums),"kick",false);
   add("Drums",bar*2+1,bs+barDur*.50,.12,null,tavernMixLevel(t,"Drums",.090*style.drums)*.78,"snare",false);''')
r(''' return {events,timing:tm};
}
function phraseGap(t){return scoreTiming(t).gap||0}''',
  ''' // v5.68: 酒場以外の低い脈動(makePulse)。再生では鳴っていたが譜面に無かった
 if(t.bp?.pulse && String(t.scene||t.bp?.scene||'')!=='tavern'){
  for(let i=0;i<4;i++) add("Drums",i*4+3,tm.eventStart(i*4+3),sec*.72,null,.018,"pulse",false);
 }
 return {events,timing:tm};
}
function phraseGap(t){return scoreTiming(t).gap||0}''')

# --- セル試聴: 譜面に出るようになった脈動(pulse)は脈動の音で ---
r(''' if(e.instrument==="Drums"){
   makeDrumHit(now,Math.min(.035,level),room,e.kind==="kick"?"kick":"snare");
   return;
 }''',''' if(e.instrument==="Drums"){
   if(e.kind==="pulse"){makePulse(now,Math.max(.3,e.duration),Math.min(.035,level),room);return;}   // v5.68
   makeDrumHit(now,Math.min(.035,level),room,e.kind==="kick"?"kick":"snare");
   return;
 }''')

# --- playTrack: 譜面イベントをそのまま鳴らす ---
a = s.index('function playTrack(){')
b = s.index(' const total=tm.total*1000;', a)
new = '''/* v5.68: 通し再生は buildTruthScore() の譜面イベントをそのまま鳴らす。
   v5.67 までは playTrack が譜面と同じ計算を別に持っていて、ピアノ・ベル(12 か所中 9 か所)・
   ベースの style-bass・キーボードの keys / synth が譜面にあるのに鳴らず、ヴィオラの長さの計算で
   絶対時刻と譜面の時刻が混ざっていた。強さ・奥行きは確定版(v5.67)の再生の値のまま */
function eventDepth(e,depth){
 const sp=e.space||{mul:1,add:0};
 return Math.min(1,depth*sp.mul+sp.add);
}
function playScoreEvent(t,e,start,room,depth){
 if(e.rest) return;
 const st=start+e.start;
 const lv=e.level*cellVolume(t,e.instrument,e.index,e.kind);
 const d=eventDepth(e,depth);
 switch(e.instrument){
  case "Piano": makePiano(e.n,st,e.duration,lv,room); return;
  case "Keyboard":
   if(e.kind==="pluck") makeStylePluck(e.n,st,e.duration,lv,room,d);
   else makeKeyboard(e.n,st,e.duration,lv,room,e.kind);
   return;
  case "Guitar":
   if(e.kind==="guitar-strum") makeAcousticGuitarStrum(e.n,st,e.duration,lv,room,"down");
   else makeAcousticGuitar(e.n,st,e.duration,lv,room);
   return;
  case "Drums":
   if(e.kind==="pulse") makePulse(st,e.duration,lv,room);
   else makeDrumHit(st,lv,room,e.kind);
   return;
  case "Bass":
   if(e.kind==="style-bass") makeStyleBass(e.n,st,e.duration,lv,room);
   else makeVoice("Bass",e.n,st,e.duration,lv,room,d);
   return;
  default: makeVoice(e.instrument,e.n,st,e.duration,lv,room,d);
 }
}
function playTrack(){
 if(!state.track){generate();return}
 if(state.playing)return;
 ensureAudio();
 const myToken=++playbackToken;
 const t=state.track;
 const tm=scoreTiming(t);
 const start=audioCtx.currentTime+.12;
 const depth=(+$("space").value)/100;
 const reverb=(+$("reverb").value)/100;
 const room=makeRoom(.02+reverb*.20);
 buildTruthScore(t).events.forEach(e=>playScoreEvent(t,e,start,room,depth));
'''
s = s[:a] + new + s[b:]
s = s.rstrip('\n') + '\n\n<!-- v5.68.0: playback plays buildTruthScore events (score = sound). Missing piano/bell/style-bass/keys/synth now sound; score levels match the v5.67 playback; viola sustain uses score-relative time. -->\n'
open(out_path, 'w', encoding='utf-8').write(s)
print('ok', len(s))
