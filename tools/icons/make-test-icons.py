"""テスト専用 PWA のアイコンを作る(TEST-PWA-ENTRY-001)。

通常版のアイコン(public/icons/icon-*.png。暗い地・金の輪・橙の円)と同じ作りで、
中の円を青緑(テストモード画面の --mp 系の色)にし、下に「TEST」の帯を掛ける。
発光・ガラス風の透過は使わない(マットで単純な見た目)。

出力: public/icons/test-icon-180.png(apple-touch-icon)/ test-icon-192.png / test-icon-512.png
実行: python3 tools/icons/make-test-icons.py
文字は DejaVu Serif Bold(Bitstream Vera 系の自由なライセンス)。無ければ既定の字形で描く。
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'icons')
BG = (12, 10, 16, 255)          # #0c0a10(manifest の background_color と同じ)
RING = (200, 162, 78, 255)      # 通常版の輪と同じ金
INNER_C = (82, 156, 186)        # 円の中心(青緑)
INNER_E = (32, 86, 110)         # 円の縁
BAND = (26, 20, 30, 255)
BAND_LINE = RING
TEXT = (232, 206, 140, 255)
FONT_PATHS = ['/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']

def font(size):
    for p in FONT_PATHS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def draw(size):
    S = 1024   # 大きく描いて縮める(縁を滑らかに)
    im = Image.new('RGBA', (S, S), BG)
    d = ImageDraw.Draw(im)
    cx = cy = S // 2
    r_out, r_in = int(S * 0.36), int(S * 0.30)
    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], fill=RING)
    # 中の円: 中心から縁へ色を変える(段を細かくして、ぼかさない)
    steps = 120
    for i in range(steps, 0, -1):
        k = i / steps
        r = int(r_in * k)
        col = tuple(int(INNER_C[j] + (INNER_E[j] - INNER_C[j]) * k) for j in range(3)) + (255,)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    # 「TEST」の帯(円の下側に掛ける)
    bh = int(S * 0.20)
    by = int(S * 0.64)
    d.rectangle([int(S * 0.08), by, int(S * 0.92), by + bh], fill=BAND)
    lw = max(4, S // 128)
    d.rectangle([int(S * 0.08), by, int(S * 0.92), by + bh], outline=BAND_LINE, width=lw)
    f = font(int(bh * 0.72))
    text = 'TEST'
    box = d.textbbox((0, 0), text, font=f)
    tw, th = box[2] - box[0], box[3] - box[1]
    d.text((cx - tw / 2 - box[0], by + (bh - th) / 2 - box[1]), text, font=f, fill=TEXT)
    out = im.resize((size, size), Image.LANCZOS)
    # apple-touch-icon は透過を使わない(iOS は透過部分を黒で埋める)。地は不透明のまま
    return out.convert('RGB') if size == 180 else out

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for size in (180, 192, 512):
        path = os.path.join(OUT, f'test-icon-{size}.png')
        draw(size).save(path, optimize=True)
        print('wrote', path)
