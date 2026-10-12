"""v5.68.0 → v5.69.0: ギターの譜面イベントを編集できるようにする(音程・タイミング・長さ)。
あわせて、譜面エディタの音名の欄が空だった不具合(どの音も C4 に変わる)を直す。

ギターのセルを選んで「この音を変更」すると、track.guitarEdits[イベント番号] = {shift, offset, d} に保存する。
  shift : 半音。ストロークは和音ごと移調(音名の欄は和音の一番低い音)
  offset: 開始のずれ(拍、-1〜1)
  d     : 長さ(拍)。null なら元の長さ
buildTruthScore がこれを当てるので、譜面の表示と通し再生(playScoreEvent)の両方に同じ値が入る。
調整が無いとき、v5.68.0 と同じ譜面・同じ音になる。v5.68.0 は読むだけ。

  python3 -I make_v569.py ARPG_Music_AI_Composer_v5_68_0.html ARPG_Music_AI_Composer_v5_69_0.html
"""
import sys
src_path, out_path = sys.argv[1], sys.argv[2]
s = open(src_path, encoding='utf-8').read()

def r(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a))
    s = s.replace(a, b)

# --- 譜面: ギターの調整を当てる ---
r('''    add("Guitar",i,bs,guitarDur,voicing,tavernMixLevel(t,"Guitar",level),"guitar-strum",false);''',
  '''    // v5.69: ギターの調整(移調・開始のずれ・長さ)。無ければ v5.68 と同じ
    const ge=t.guitarEdits?.[i], shift=Number(ge?.shift)||0;
    add("Guitar",i,bs+(Number(ge?.offset)||0)*sec,ge?.d!=null?Math.max(.05,Number(ge.d))*sec:guitarDur,shift?voicing.map(n=>n+shift):voicing,tavernMixLevel(t,"Guitar",level),"guitar-strum",true);''')
r('''add("Guitar",idx,actual,sec*.30,x.n,tavernMixLevel(t,"Guitar",.024*style.guitar),"guitar",false);''',
  '''const ge=t.guitarEdits?.[idx];add("Guitar",idx,actual+(Number(ge?.offset)||0)*sec,ge?.d!=null?Math.max(.05,Number(ge.d))*sec:sec*.30,x.n+(Number(ge?.shift)||0),tavernMixLevel(t,"Guitar",.024*style.guitar),"guitar",true);''')

# --- エディタ: 「ずれ(拍)」の欄(ギターのときだけ出す) ---
r('''     <label>長さ<input id="editDuration" type="number" min=".05" max="2.5" step=".05"></label>''',
  '''     <label>長さ<input id="editDuration" type="number" min=".05" max="2.5" step=".05"></label>
     <label id="editOffsetWrap" style="display:none">ずれ(拍)<input id="editOffset" type="number" min="-1" max="1" step=".05" value="0"></label>''')

r('''function updateScoreEditor(track){
 const ed=$("scoreEditor");if(!ed)return;''',
  '''/* v5.69: ギターの調整前の値(一番低い音・長さ[拍])。調整を外して譜面を作り直して読む */
function guitarOriginal(track,index){
 const sec=scoreTiming(track).sec, saved=track.guitarEdits;
 track.guitarEdits=null;
 let e=null;
 try{ e=buildTruthScore(track).events.find(x=>x.instrument==="Guitar"&&x.index===index&&!x.rest); }
 finally{ track.guitarEdits=saved; }
 if(!e) return null;
 return {low:Array.isArray(e.n)?Math.min(...e.n):e.n,d:e.duration/sec};
}
function setPitchSelect(n){
 const names=noteNames();
 let closest=names[0],best=999;
 names.forEach(name=>{const d=Math.abs(midiFromName(name)-n);if(d<best){best=d;closest=name}});
 $("editPitch").value=closest;
}
function updateGuitarEditor(track){
 const ed=$("scoreEditor"),o=guitarOriginal(track,scoreSelected.index);
 if(!ed||!o)return;
 const ge=track.guitarEdits?.[scoreSelected.index]||{};
 ed.classList.toggle("show",scoreEditMode);
 $("editOffsetWrap").style.display="";
 $("editStep").value=scoreSelected.index+1;$("editStep").disabled=true;
 $("scoreDeleteNote").disabled=true;
 $("editDuration").max="4";
 $("editDuration").value=Number(ge.d??o.d).toFixed(2);
 $("editOffset").value=Number(ge.offset||0).toFixed(2);
 setPitchSelect(o.low+(Number(ge.shift)||0));
}
function applyGuitarEdit(t){
 const i=scoreSelected.index,o=guitarOriginal(t,i);
 if(!o)return;
 const shift=midiFromName($("editPitch").value)-o.low;
 const offset=clamp(Number($("editOffset").value)||0,-1,1);
 const dv=clamp(Number($("editDuration").value)||o.d,.05,4);
 const d=Math.abs(dv-o.d)<.006?null:dv;   // 欄の丸め(小数2桁)だけの差は「変えていない」
 t.guitarEdits=t.guitarEdits||{};
 if(!shift&&!offset&&d==null) delete t.guitarEdits[i];
 else t.guitarEdits[i]={shift,offset,d};
 buildScoreTimeline(t);updateScoreEditor(t);
 renderResult();renderEdit();
}
function updateScoreEditor(track){
 const ed=$("scoreEditor");if(!ed)return;
 if(scoreSelected.row==="Guitar"){updateGuitarEditor(track);return;}
 $("editOffsetWrap").style.display="none";$("editStep").disabled=false;$("scoreDeleteNote").disabled=false;$("editDuration").max="2.5";''')

r('''  const t=state.track;if(!t)return;
  const arr=selectedPhraseArray(t,scoreSelected.row),idx=Math.max(0,Math.min(79,Number($("editStep").value)-1));''',
  '''  const t=state.track;if(!t)return;
  if(scoreSelected.row==="Guitar"){applyGuitarEdit(t);return;}   // v5.69
  const arr=selectedPhraseArray(t,scoreSelected.row),idx=Math.max(0,Math.min(79,Number($("editStep").value)-1));''')
r('''  const t=state.track;if(!t)return;
  const arr=selectedPhraseArray(t,scoreSelected.row),x=arr?.[scoreSelected.index];
  if(!x)return;
  x.rest=true;''',
  '''  const t=state.track;if(!t)return;
  if(scoreSelected.row==="Guitar")return;   // v5.69: ギターは休符にしない(主旋律を消してしまうため)
  const arr=selectedPhraseArray(t,scoreSelected.row),x=arr?.[scoreSelected.index];
  if(!x)return;
  x.rest=true;''')

# --- 既存の不具合: 音名の欄に選択肢が無い(buildPitchOptions が呼ばれていない)。
#     v5.68 までは「この音を変更」で音名が空 → midiFromName("") = 60 になり、どの音も C4 に変わっていた ---
r('''function initScoreEditing(){
 $("scoreEditToggle").onclick=()=>{''',
  '''function initScoreEditing(){
 buildPitchOptions();   // v5.69: 音名の選択肢を入れる(v5.68 までは空で、変更するとどの音も C4 になった)
 $("scoreEditToggle").onclick=()=>{''')

s = s.rstrip('\n') + '\n\n<!-- v5.69.0: guitar score events are editable (transpose / start offset / length via track.guitarEdits); score and playback share the edit. Pitch select now has options (was empty: edits turned every note into C4). No edits = v5.68.0. -->\n'
open(out_path, 'w', encoding='utf-8').write(s)
print('ok', len(s))
