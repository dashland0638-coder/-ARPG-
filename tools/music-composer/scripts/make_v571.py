"""v5.70.0 → v5.71.0: 酒場 BGM の低音の持続音(チェロ)を、次のチェロの始まりまで伸ばす。

v5.70.0 までのチェロ(foundation)は、ベースの 8 音ごとに 1 音、長さはベースの長さの 0.9 倍だった。
次のチェロまでの時刻(nextBassSt)を計算していたのに使っておらず、8 拍のうち最後の 1 拍(約 0.58 秒)が切れていた。
剣士・魔法使いの段(ピアノ・チェロ・フルート)では、この 1 拍に鳴っている音が無く(ピアノは 4 拍に 1 回で、もう消えている)、
iPhone で「途中で 1 小節ほど音が途切れる」と聞こえた(MUSIC-BGM-TAVERN-003)。

v5.71.0 は、酒場の曲だけ、チェロを次のチェロの始まり(最後のチェロは 1 周の終わり)まで鳴らす。重ねない(ちょうど次の音の始まりで止める)ので、
同時に鳴る音を見て和音を選ぶギター(v5.70)の判定は変わらない。音の高さ・強さ・始まり・他の楽器・旋律・和音・酒場以外の曲は v5.70.0 のまま。
v5.70.0 は読むだけ。

  python3 -I make_v571.py ARPG_Music_AI_Composer_v5_70_0.html ARPG_Music_AI_Composer_v5_71_0.html
"""
import sys
src_path, out_path = sys.argv[1], sys.argv[2]
s = open(src_path, encoding='utf-8').read()

def r(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a))
    s = s.replace(a, b)

r('''   const celloDur=Math.max(.12,sec*x.d*.90);''',
  '''   // v5.71: 酒場は次のチェロ(8 音後)の始まりまで鳴らす。v5.70 までは 0.9 倍で、8 拍のうち最後の 1 拍が切れていた
   const nextCelloSt=tm.eventStart(Math.min((Number(x.m)||0)+8,phrase.length));
   const celloDur=isTavernTrack(t)?Math.max(.12,sec*x.d*.90,nextCelloSt-st):Math.max(.12,sec*x.d*.90);''')

r('''<!-- v5.70.0: tavern guitar strums''',
  '''<!-- v5.71.0: tavern only - cello foundation holds until the next cello (v5.70.0 cut the last beat of every 8, leaving a silent beat in the early tavern stages). Ends exactly at the next onset, so guitar voicing is unchanged. Everything else unchanged from v5.70.0. -->
<!-- v5.70.0: tavern guitar strums''')

open(out_path, 'w', encoding='utf-8').write(s)
