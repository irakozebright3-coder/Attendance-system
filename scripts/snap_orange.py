#!/usr/bin/env python3
"""Snap every orange in the stylesheets to a small deliberate ramp.

The recolor pass preserved each colour's lightness, which left ~27 near-miss
oranges. A coherent system uses a handful. Reds (#f43f5e etc) and ambers
(hue > 38 deg, used for warnings) are deliberately left alone.
"""
import colorsys, re, sys

RAMP = [  # (max lightness, hex, rgb)  darkest -> lightest
    (0.30, "#7c2d12"), (0.42, "#c2410c"), (0.55, "#f97316"),
    (0.68, "#fb923c"), (0.80, "#fdba74"), (1.01, "#fed7aa"),
]
def snap(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r/255, g/255, b/255)
    deg = h * 360
    if not (14 <= deg < 38) or s < 0.40:
        return None  # not one of our oranges (red, amber, neutral)
    if l > 0.90:
        return "#fff7ed"  # near-white warm paper
    for top, hexv in RAMP:
        if l < top:
            return hexv
    return None

HEX = re.compile(r"#[0-9a-fA-F]{6}\b")
RGBA = re.compile(r"rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)")
RGB = re.compile(r"rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)")

def hexsub(m):
    h = m.group(0)
    out = snap(*[int(h[i:i+2], 16) for i in (1, 3, 5)])
    return out or h
def rgbasub(m):
    out = snap(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    if not out: return m.group(0)
    return "rgba(%d,%d,%d,%s)" % (int(out[1:3],16), int(out[3:5],16), int(out[5:7],16), m.group(4))
def rgbsub(m):
    out = snap(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return out or m.group(0)

for path in sys.argv[1:]:
    t = open(path).read()
    t = HEX.sub(hexsub, t); t = RGBA.sub(rgbasub, t); t = RGB.sub(rgbsub, t)
    open(path, "w").write(t)
    print("snapped", path)
