#!/usr/bin/env python3
"""Draw the app icons — a flashcard in flag colours on the app's green.

Stdlib only (zlib + struct PNG writer), like the rest of the app. Run once after
changing the design; the PNGs are committed:

    python3 07-DeutschCard/icons/make_icons.py
"""

import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
GREEN = (45, 106, 79)          # --primary in style.css
CARD = (255, 255, 255)
SHADOW = (30, 75, 56)
STRIPES = [(0, 0, 0), (221, 0, 0), (255, 206, 0)]
SS = 4                         # supersampling per axis, for smooth edges


def in_round_rect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def colour_at(u, v, full_bleed):
    """u, v in 0..1. Returns (r, g, b, a)."""
    if not full_bleed and not in_round_rect(u, v, 0, 0, 1, 1, 0.22):
        return (0, 0, 0, 0)
    # the card: 60 % wide, inside the 80 % maskable safe zone
    x0, y0, x1, y1, r = 0.20, 0.27, 0.80, 0.73, 0.06
    if in_round_rect(u, v, x0, y0, x1, y1, r):
        band = (v - y0) / (y1 - y0)
        if band < 0.36:                       # flag band across the top of the card
            return STRIPES[min(int(band / 0.12), 2)] + (255,)
        if 0.55 < band < 0.63 and x0 + 0.08 < u < x1 - 0.08:
            return GREEN + (255,)             # a "word" line
        if 0.72 < band < 0.78 and x0 + 0.08 < u < x1 - 0.22:
            return (190, 205, 198, 255)       # a shorter "translation" line
        return CARD + (255,)
    if in_round_rect(u, v, x0 + 0.03, y0 + 0.04, x1 + 0.03, y1 + 0.04, r):
        return SHADOW + (255,)                # the card below it in the deck
    return GREEN + (255,)


def render(size, full_bleed):
    rows = []
    n = SS * SS
    for py in range(size):
        row = bytearray([0])                  # PNG filter type 0
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    c = colour_at((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, full_bleed)
                    a = c[3]
                    acc[0] += c[0] * a; acc[1] += c[1] * a; acc[2] += c[2] * a; acc[3] += a
            a = acc[3]
            row += bytes([acc[0] // a, acc[1] // a, acc[2] // a, a // n] if a else [0, 0, 0, 0])
        rows.append(bytes(row))
    return png(size, b"".join(rows))


def png(size, raw):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)   # 8-bit RGBA
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


if __name__ == "__main__":
    for name, size, bleed in (("icon-192.png", 192, False), ("icon-512.png", 512, False),
                              ("maskable-512.png", 512, True), ("favicon-32.png", 32, False)):
        with open(os.path.join(HERE, name), "wb") as f:
            f.write(render(size, bleed))
        print(name)
