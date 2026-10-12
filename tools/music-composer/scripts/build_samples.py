#!/usr/bin/env python3
"""MUSIC-AUDIO-001: CC0 サンプルから、試作に必要な分だけの MP3 を作る。

入力は固定コミットの3リポジトリ(どれも LICENSE が CC0 1.0):
  VCSL       https://github.com/sgossner/VCSL        (ピアノ: Upright Piano, Knight / Sustains / vl2、
                                                       ハープ: Concert Harp / f、ベル: Hand Chimes / sus、
                                                       ドラム: Frame Drum / Hit v3(大=キック、小=スネア、各 rr1・rr2)、
                                                       キーボード: Electrophones/TX81Z/FM Piano / vl2)
  VSCO-2-CE  https://github.com/sgossner/VSCO-2-CE   (フルート: Woodwinds/Flute/susvib / v1、
                                                       ヴィオラ: Strings/Viola Section/susvib / v2、
                                                       チェロ: Strings/Cello Section/susvib / v3、
                                                       ベース: Strings/Solo Contrabass/SusNV / v1)
  FreePats   https://github.com/freepats/spanish-classical-guitar
                                                      (ギター: Spanish classical guitar 2019-06-18、タグ v1.0.0。
                                                       SFZ + FLAC。SFZ はブラウザで鳴らせないので、FLAC を他と同じ
                                                       MP3 に変換し、音域の割り当ては manifest に書く)

使い方(git / ffmpeg / numpy が必要。数 GB の全体は取らず、使うファイルだけ取り出す):
  git clone --filter=blob:none --no-checkout https://github.com/sgossner/VCSL vcsl
  git clone --filter=blob:none --no-checkout https://github.com/sgossner/VSCO-2-CE vsco
  git clone --filter=blob:none --no-checkout https://github.com/freepats/spanish-classical-guitar fpg
  python3 -I build_samples.py --vcsl vcsl --vsco vsco --fpg fpg --out ../samples

処理: 先頭の無音を削る → モノラル化 → 長さを切り詰めて末尾をフェード → 44.1kHz MP3。
弦(loop あり)は末尾をフェードせず、ループ区間の終わりを始まりの手前と等パワーでクロスフェードして
つなぎ目を消し、ループ位置(発音の頭からの秒)を manifest.js に書く。長い音は再生側でループする。
自己相関で実測した音高のずれ(cent)を manifest.js に書き、再生側で補正する。
"""
import argparse, json, math, os, subprocess, sys
import numpy as np

VCSL_COMMIT = "c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e"
VSCO_COMMIT = "440300901dfe9275fd84e0b7763af1f8443ae62e"
FPG_COMMIT = "6f4eb1b092acc88f5448cea1a0001bd07b971af8"   # freepats/spanish-classical-guitar v1.0.0
SR = 44100
NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# ファイル名の音名はほとんど「科学的表記 - 1 オクターブ」(A3 = MIDI 69)。ハープと TX81Z は科学的表記(A4 = MIDI 69)。
# build 時に実測して確かめる(50 cent 以上ずれたら止まる)。
def vendor_name(midi):
    return f"{NAMES[midi % 12]}{midi // 12 - 2}"

def sci_name(midi):
    return f"{NAMES[midi % 12]}{midi // 12 - 1}"

PIANO = {
    "repo": "vcsl", "commit": VCSL_COMMIT,
    "dir": "Chordophones/Zithers/Upright Piano, Knight/Sustains",
    "file": lambda m: f"Player_vl2_rr1_{vendor_name(m)}.wav",
    "midis": list(range(35, 97, 2)),   # 全音おき(収録どおり)。B1〜B6
    "seconds": 3.5, "fade": 0.5, "bitrate": "112k",
}
FLUTE = {
    "repo": "vsco", "commit": VSCO_COMMIT,
    "dir": "Woodwinds/Flute/susvib",
    "file": lambda m: f"LDFlute_susvib_{vendor_name(m)}_v1_1.wav",
    "midis": [60, 64, 69, 72, 76, 81, 84, 88, 93, 96],  # 収録は長3度/完全4度おき
    "seconds": 4.0, "fade": 0.4, "bitrate": "112k",
}

# 弦: 1.2〜3.6 秒をループ(弓の立ち上がりの後の、ビブラートが安定した区間)
STRING_LOOP = {"loop": (1.2, 3.6), "xfade": 0.3, "seconds": 3.6, "fade": 0, "bitrate": "112k"}
VIOLA = {
    "repo": "vsco", "commit": VSCO_COMMIT,
    "dir": "Strings/Viola Section/susvib",
    "file": lambda m: f"ViolaEns_susvib_{vendor_name(m)}_v2_1.wav",
    "midis": [48, 50, 52, 55, 59, 62, 65, 69, 72, 76, 79, 83, 86],
    **STRING_LOOP,
}
CELLO = {
    "repo": "vsco", "commit": VSCO_COMMIT,
    "dir": "Strings/Cello Section/susvib",
    "file": lambda m: f"susvib_{vendor_name(m)}_v3_1.wav",
    "midis": [36, 40, 43, 47, 50, 53, 57, 60, 64, 67, 71, 74, 77],
    **STRING_LOOP,
}

HARP = {
    "repo": "vcsl", "commit": VCSL_COMMIT,
    "dir": "Chordophones/Composite Chordophones/Concert Harp",
    # f 層(C3 だけ f2 しか無い)。mf 層は C3 が -34 dB と小さく、揃わない
    "file": lambda m: f"KSHarp_{sci_name(m)}_{'f2' if m == 48 else 'f1'}.wav",
    "midis": [45, 48, 52, 55, 59, 62, 65, 69, 72, 76, 79, 83, 86, 89, 93, 98],  # 収録は3度おき
    "seconds": 4.0, "fade": 0.6, "bitrate": "112k",
}
BELL = {
    "repo": "vcsl", "commit": VCSL_COMMIT,
    "dir": "Idiophones/Struck Idiophones/Hand Chimes",
    "file": lambda m: f"sus_{vendor_name(m)}_r01_main.wav",
    "midis": [60, 64, 68, 72, 76, 80, 84, 88, 92, 96],  # 収録は全音おき。長3度おきに間引く
    "seconds": 4.5, "fade": 0.8, "bitrate": "112k",
}

BASS = {
    "repo": "vsco", "commit": VSCO_COMMIT,
    "dir": "Strings/Solo Contrabass/SusNV",
    # v1: 0.4 秒ほどで立ち上がって安定する(v3 は 1 秒以上かけて膨らむ)
    "file": lambda m: f"BKCtbss_SusNV_{vendor_name(m)}_v1_rr1.wav",
    "midis": [28, 31, 34, 36, 38, 40, 42, 45, 49, 52, 56, 59],
    "loop": (1.0, 3.0), "xfade": 0.3, "seconds": 3.0, "fade": 0, "bitrate": "112k",
}
# 打楽器: 音程なし。midi は GM のキック 36・スネア 38 を名前代わりに使う。同じ midi の rr は交互に鳴らす
DRUMS = {
    "repo": "vcsl", "commit": VCSL_COMMIT,
    "dir": "Membranophones/Struck Membranophones/Frame Drum",
    "items": [(36, "HDrumL_Hit_v3_rr1_Sum.wav"), (36, "HDrumL_Hit_v3_rr2_Sum.wav"),
              (38, "HDrumS_Hit_v3_rr1_Sum.wav"), (38, "HDrumS_Hit_v3_rr2_Sum.wav")],
    "unpitched": True, "seconds": 1.4, "fade": 0.5, "bitrate": "112k",
}

KEYBOARD = {
    "repo": "vcsl", "commit": VCSL_COMMIT,
    "dir": "Electrophones/TX81Z/FM Piano",
    "file": lambda m: f"FMPiano_{sci_name(m)}_vl2.wav",
    "midis": [60, 64, 68, 72, 76, 80, 84, 88, 92, 96],  # 収録は長3度おき(C・E・G#)
    "seconds": 3.0, "fade": 0.6, "bitrate": "112k",
}

# 弱い層(layer "soft")。ピアノ・ハープ・キーボードの譜面の音は弱い(強さの基準の 0.5 未満)ことが多いので、
# 強い層を lowpass で暗くする代わりに、弱く弾いた収録音を使う。音量は強い層と最初の 1 秒の RMS でそろえ
# (ゾーンの gain)、強弱は再生側の level だけで決まる。ピアノの弱い層はアプリの通し再生で使う音域だけ
PIANO_SOFT = {**PIANO, "file": lambda m: f"Player_vl1_rr1_{vendor_name(m)}.wav", "midis": list(range(43, 89, 2)), "layer": "soft"}
HARP_SOFT = {**HARP, "file": lambda m: f"KSHarp_{sci_name(m)}_{'mf3' if m == 48 else 'mf1'}.wav", "midis": HARP["midis"][:-1], "layer": "soft"}  # D7 は mf 層が無い

KEYBOARD_SOFT = {**KEYBOARD, "file": lambda m: f"FMPiano_{sci_name(m)}_vl1.wav", "layer": "soft"}

# SFZ(SpanishClassicalGuitar-20190618.sfz)にある収録音のうち、アプリが使う C2〜C6。ファイル名は科学的表記
GUITAR_KEYS = [36, 37, 38, 39, 40, 41, 43, 45, 47, 48, 50, 52] + [m for m in range(53, 85) if m != 68]   # G#4 は収録が無い(SFZ も A4 で代用)
GUITAR = {
    "repo": "fpg", "commit": FPG_COMMIT,
    "dir": "samples",
    "file": lambda m: f"{sci_name(m)}.flac",
    "midis": GUITAR_KEYS,
    "seconds": 3.5, "fade": 0.6, "bitrate": "112k",
}

def git_blob(repo, commit, path):
    return subprocess.run(["git", "-C", repo, "show", f"{commit}:{path}"], check=True, capture_output=True).stdout

def decode(wav_bytes):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", "-", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         input=wav_bytes, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)

def onset(x):
    peak = np.max(np.abs(x[: SR * 2])) or 1.0
    idx = int(np.argmax(np.abs(x) > peak * 0.02))
    return max(0, idx - int(SR * 0.004))

# sample-engine.js の findOnset と同じ。ループ位置をこの頭からの秒で書く
def runtime_onset(x):
    head = x[:SR]
    peak = np.max(np.abs(head)) or 1.0
    idx = int(np.argmax(np.abs(head) > peak * 0.02))
    return max(0, idx - int(SR * 0.002)) / SR

# ループ終端の後ろには、ループ始端からの続きを 0.1 秒足す(decode の誤差で終端がはみ出してもループが効く)
def crossfade_loop(x, ls, le, c):
    y = np.concatenate([x[:le], x[ls:ls + int(SR * 0.1)]])
    k = np.arange(c) / c
    y[le - c:le] = x[le - c:le] * np.cos(k * np.pi / 2) + x[ls - c:ls] * np.sin(k * np.pi / 2)
    return y

def measure_midi(x):
    seg = x[int(SR * 0.3): int(SR * 1.3)]
    seg = seg - seg.mean()
    n = 1 << (len(seg) * 2 - 1).bit_length()
    X = np.fft.rfft(seg, n)
    ac = np.fft.irfft(X * np.conj(X))[: len(seg)]
    lo, hi = int(SR / 2500), int(SR / 25)
    best = lo + int(np.argmax(ac[lo:hi]))
    thr = 0.9 * ac[best]
    for L in range(lo + 1, hi - 1):
        if ac[L] >= thr and ac[L] >= ac[L - 1] and ac[L] >= ac[L + 1]:
            best = L
            break
    a, b, c = ac[best - 1], ac[best], ac[best + 1]
    den = a - 2 * b + c
    p = 0.5 * (a - c) / den if den else 0.0
    return 69 + 12 * math.log2((SR / (best + p)) / 440)

def encode(x, path, bitrate):
    pcm = np.clip(x, -1, 1).astype(np.float32).tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "libmp3lame", "-b:a", bitrate, "-map_metadata", "-1", path],
                   input=pcm, check=True)

def rms_head(x):
    return float(np.sqrt(np.mean(x[:SR] ** 2))) or 1e-9

def build(spec, name, args, match=None):
    """match: 強い層の {midi: RMS}。渡すと弱い層として作り、ゾーンに layer と gain を書く"""
    layer = spec.get("layer")
    rms = {}
    repo = {"vcsl": args.vcsl, "vsco": args.vsco, "fpg": args.fpg}[spec["repo"]]
    os.makedirs(os.path.join(args.out, name), exist_ok=True)
    zones = []
    items = spec.get("items") or [(m, spec["file"](m)) for m in spec["midis"]]
    seen = {}
    for m, fname in items:
        src = f"{spec['dir']}/{fname}"
        x = decode(git_blob(repo, spec["commit"], src))
        if spec.get("unpitched"):
            cents = 0.0
        else:
            measured = measure_midi(x)
            cents = round((measured - m) * 100, 1)
            if abs(cents) > 50:
                sys.exit(f"pitch mismatch: {src} expected MIDI {m}, measured {measured:.2f}")
        seen[m] = seen.get(m, 0) + 1
        rr = seen[m]
        x = x[onset(x):]
        loop = None
        if spec.get("loop"):
            ls, le = (int(SR * t) for t in spec["loop"])
            x = crossfade_loop(x, ls, le, int(SR * spec["xfade"]))
            loop = (ls, le)
        else:
            x = x[: int(SR * spec["seconds"])]
            fade = int(SR * spec["fade"])
            x[-fade:] *= np.linspace(1, 0, fade) ** 2
        x = x / (np.max(np.abs(x)) or 1) * 0.89  # -1 dBFS に揃える。強弱は再生側で付ける
        rel = f"{name}/{name}_{m:03d}.mp3" if not spec.get("items") else f"{name}/{name}_{m:03d}_rr{rr}.mp3"
        if layer:
            rel = f"{name}/{name}_{layer}_{m:03d}.mp3"
        rms[m] = rms_head(x)
        encode(x, os.path.join(args.out, rel), spec["bitrate"])
        zone = {"midi": m, "cents": cents, "file": rel, "source": src}
        if spec.get("items"):
            zone["rr"] = rr
        if layer:
            zone["layer"] = layer
            zone["gain"] = round(match[m] / rms[m], 4)
        if loop:
            o = runtime_onset(x)
            zone["loopStart"] = round(loop[0] / SR - o, 5)
            zone["loopEnd"] = round(loop[1] / SR - o, 5)
        zones.append(zone)
        print(f"{rel}  <- {src}  ({cents:+.1f} cent)")
    return {"repo": spec["repo"], "commit": spec["commit"], "zones": zones}, rms

def with_soft(loud_spec, soft_spec, name, args):
    out, rms = build(loud_spec, name, args)
    soft, _ = build(soft_spec, name, args, match=rms)
    out["zones"] += soft["zones"]
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vcsl", required=True)
    ap.add_argument("--vsco", required=True)
    ap.add_argument("--fpg", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    one = lambda spec, name: build(spec, name, args)[0]
    manifest = {
        "Piano": with_soft(PIANO, PIANO_SOFT, "piano", args), "Flute": one(FLUTE, "flute"),
        "Viola": one(VIOLA, "viola"), "Cello": one(CELLO, "cello"),
        "Harp": with_soft(HARP, HARP_SOFT, "harp", args), "Bell": one(BELL, "bell"),
        "Bass": one(BASS, "bass"), "Drums": one(DRUMS, "drums"),
        "Keyboard": with_soft(KEYBOARD, KEYBOARD_SOFT, "keyboard", args),
        "Guitar": one(GUITAR, "guitar"),
    }
    body = json.dumps(manifest, indent=1, ensure_ascii=False)
    with open(os.path.join(args.out, "manifest.js"), "w") as f:
        f.write("/* build_samples.py が生成。手で編集しない */\n")
        f.write(f"window.SAMPLE_MANIFEST = {body};\n")

if __name__ == "__main__":
    main()
