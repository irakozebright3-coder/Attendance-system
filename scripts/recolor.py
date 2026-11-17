#!/usr/bin/env python3
"""Retheme the stylesheets to black / white / orange.

Every blue, cyan, indigo, violet and purple color becomes orange (keeping its
lightness and alpha so glows, shadows and contrast relationships survive), and
every blue-tinted grey becomes a true neutral grey. Reds, greens and ambers are
left alone: they carry meaning (absent, present, warning).

Usage: python3 scripts/recolor.py src/style.css src/design-system.css ...
"""
import colorsys
import re
import sys

ORANGE_HUE = 24 / 360  # #f97316 is hue ~25 degrees
HEX = re.compile(r"#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")
RGB = re.compile(r"rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*(?:[,/]\s*([0-9.]+%?)\s*)?\)")


def to_rgb_hex(token):
    h = token[1:]
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    alpha = h[6:8] if len(h) == 8 else ""
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)), alpha


def classify(r, g, b):
    """Return 'blue' (blue/cyan/indigo/violet/purple/pink-violet), 'tint' or None."""
    rf, gf, bf = r / 255, g / 255, b / 255
    h, l, s = colorsys.rgb_to_hls(rf, gf, bf)
    deg = h * 360
    if l < 0.03 or l > 0.985:
        return None
    if s < 0.06:
        return None  # already neutral
    if 165 <= deg < 330:
        # Role by lightness: very dark colours are SURFACES (page, cards) and
        # very light ones are TEXT/PAPER, so both become true neutrals. Only
        # the mid-tone saturated colours are ACCENTS, and those become orange.
        if l < 0.24 or l > 0.93:
            return "tint"
        # weakly saturated blue-greys (slate) are neutral text/borders
        return "blue" if s >= 0.30 else "tint"
    return None


def recolor(r, g, b):
    kind = classify(r, g, b)
    if kind is None:
        return (r, g, b)
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if kind == "tint":
        v = round(l * 255)
        return (v, v, v)
    # Keep lightness, force the orange hue, keep it vivid but not neon.
    new_s = min(0.92, max(0.75, s))
    nr, ng, nb = colorsys.hls_to_rgb(ORANGE_HUE, l, new_s)
    return (round(nr * 255), round(ng * 255), round(nb * 255))


def hex_sub(m):
    token = m.group(0)
    (r, g, b), alpha = to_rgb_hex(token)
    nr, ng, nb = recolor(r, g, b)
    if (nr, ng, nb) == (r, g, b):
        return token
    out = "#%02x%02x%02x" % (nr, ng, nb)
    return out + alpha


def rgb_sub(m):
    r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
    nr, ng, nb = recolor(r, g, b)
    if (nr, ng, nb) == (r, g, b):
        return m.group(0)
    a = m.group(4)
    return ("rgba(%d,%d,%d,%s)" % (nr, ng, nb, a)) if a is not None else ("rgb(%d,%d,%d)" % (nr, ng, nb))


def main(paths):
    for path in paths:
        text = open(path).read()
        before = text
        text = HEX.sub(hex_sub, text)
        text = RGB.sub(rgb_sub, text)
        open(path, "w").write(text)
        changed = sum(1 for a, b in zip(before.split("\n"), text.split("\n")) if a != b)
        print("%s: %d lines recolored" % (path, changed))


if __name__ == "__main__":
    main(sys.argv[1:])
