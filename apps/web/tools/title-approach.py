#!/usr/bin/env python3
"""The title's head-on shot (Jeff, 2026-11-01): a still camera on the original painting, the truck driving up its lane.

Inputs: assets/title/title.png, the painting with its truck, and assets/title/approach.png, the same painting with
the truck painted out (asset-pass.sh titleapproach). The truck is cut out where the two differ inside its box, then
drawn at SIZES sizes from S0 to 100%, each the area average of the original's pixels snapped back to its own
colours, into assets/title/approach-truck.png: COLS columns of cells, each sprite standing at its cell's bottom
centre. title.ts (APPROACH) draws one cell a frame along the lane, from the vanishing point to where the painting
has the truck, the size growing as 1 / distance; nothing else moves but the diner's neon.

  title-approach.py [--preview <dir>]
      → assets/title/approach-truck.png, and prints the numbers APPROACH in title.ts needs; --preview writes the
        shot's frames as title.ts draws them, 10 a second, for review.
"""
import importlib.util
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("pm", os.path.join(HERE, "paint-map.py"))
pm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pm)  # type: ignore[union-attr]

ASSETS = os.path.join(HERE, "..", "assets", "title")
BOX = (122, 56, 202, 112)  # x0, y0, x1, y1: the painting's truck down to its tyres (its headlights' wash is drawn)
GLOW = (-0.16, 0.05, 0.5, 0.11, 0.55)  # the wash: centre x, y and radii x, y as shares of the truck's width; strength
SIZES, COLS, S0 = 40, 8, 0.18
VP = (211, 89)  # where the lane meets the horizon
SHOT_S = 21  # the shot's length with its fade out, as title.ts plays it
SIGN = (46, 63, 27, 14)  # the diner's neon: x, y, w, h


def mask_of(title: np.ndarray, empty: np.ndarray) -> np.ndarray:
    """The truck: where the painting differs from its empty road inside BOX, closed and with its holes filled."""
    x0, y0, x1, y1 = BOX
    d = np.abs(title[y0:y1, x0:x1, :3].astype(int) - empty[y0:y1, x0:x1, :3].astype(int)).sum(2)
    m = d > 45
    for _ in range(2):  # close small gaps: grow, then shrink
        g = m.copy()
        g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
        m = g
    for _ in range(2):
        s = m.copy()
        s[1:] &= m[:-1]; s[:-1] &= m[1:]; s[:, 1:] &= m[:, :-1]; s[:, :-1] &= m[:, 1:]
        m = s
    outside = np.zeros_like(m)  # fill holes: whatever the border can't reach through empty pixels is truck
    stack = [(y, x) for y in range(m.shape[0]) for x in (0, m.shape[1] - 1)] + [(y, x) for x in range(m.shape[1]) for y in (0, m.shape[0] - 1)]
    while stack:
        y, x = stack.pop()
        if 0 <= y < m.shape[0] and 0 <= x < m.shape[1] and not m[y, x] and not outside[y, x]:
            outside[y, x] = True
            stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    return ~outside


def box_weights(n_out: int, n_in: int) -> np.ndarray:
    """Area-average weights from n_in pixels down to n_out (each output pixel covers n_in / n_out input pixels)."""
    w = np.zeros((n_out, n_in), np.float32)
    step = n_in / n_out
    for o in range(n_out):
        a, b = o * step, (o + 1) * step
        for i in range(int(a), min(n_in, int(np.ceil(b)))):
            w[o, i] = min(b, i + 1) - max(a, i)
    return w / w.sum(1, keepdims=True)


def shrink(sprite: np.ndarray, s: float, palette: np.ndarray) -> np.ndarray:
    h0, w0 = sprite.shape[:2]
    w, h = max(1, round(w0 * s)), max(1, round(h0 * s))
    if (w, h) == (w0, h0):
        return sprite.copy()
    a = sprite[..., 3:4].astype(np.float32) / 255
    wy, wx = box_weights(h, h0), box_weights(w, w0)
    alpha = wy @ a[..., 0] @ wx.T
    rgb = np.stack([wy @ (sprite[..., c] * a[..., 0]) @ wx.T for c in range(3)], -1) / np.maximum(alpha[..., None], 1e-6)
    near = ((rgb[:, :, None, :] - palette[None, None, :, :]) ** 2).sum(-1).argmin(-1)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = palette[near]
    out[..., 3] = np.where(alpha >= 0.5, 255, 0)
    return out


def main() -> None:
    title = pm.read_png(os.path.join(ASSETS, "title.png"))
    empty = pm.read_png(os.path.join(ASSETS, "approach.png"))
    m = mask_of(title, empty)
    ys, xs = np.nonzero(m)
    x0, y0 = BOX[0], BOX[1]
    bx0, bx1, by0, by1 = x0 + xs.min(), x0 + xs.max() + 1, y0 + ys.min(), y0 + ys.max() + 1
    sprite = np.zeros((by1 - by0, bx1 - bx0, 4), np.uint8)
    sprite[..., :3] = title[by0:by1, bx0:bx1, :3]
    sprite[..., 3] = np.where(m[by0 - y0 : by1 - y0, bx0 - x0 : bx1 - x0], 255, 0)
    h0, w0 = sprite.shape[:2]
    palette = np.unique(sprite[sprite[..., 3] > 0][:, :3], axis=0).astype(np.float32)
    cw, ch = w0 + 2, h0 + 2
    rows = -(-SIZES // COLS)
    strip = np.zeros((rows * ch, COLS * cw, 4), np.uint8)
    scales = [S0 * (1 / S0) ** (i / (SIZES - 1)) for i in range(SIZES)]
    for i, s in enumerate(scales):
        sp = shrink(sprite, s, palette)
        r, c = divmod(i, COLS)
        h, w = sp.shape[:2]
        x, y = c * cw + (cw - w) // 2, r * ch + ch - h
        strip[y : y + h, x : x + w] = sp
    pm.write_png(os.path.join(ASSETS, "approach-truck.png"), strip)
    ref = ((bx0 + bx1) / 2, by1)
    print(f"approach-truck.png: {SIZES} sizes of a {w0}×{h0} truck in {COLS} columns of {cw}×{ch} cells")
    print(f"APPROACH = {{ sizes: {SIZES}, cols: {COLS}, cw: {cw}, ch: {ch}, w: {w0}, s0: {S0}, vp: [{VP[0]}, {VP[1]}], at: [{ref[0]}, {ref[1]}], glow: [{', '.join(map(str, GLOW))}], sign: [{', '.join(map(str, SIGN))}] }}")
    if "--preview" in sys.argv:
        d = sys.argv[sys.argv.index("--preview") + 1]
        os.makedirs(d, exist_ok=True)
        n = SHOT_S * 10
        for k in range(n + 1):
            u = k / n
            s = 1 / (1 / S0 + (1 - 1 / S0) * u)
            i = min(SIZES - 1, max(0, round(np.log(s / S0) / np.log(1 / S0) * (SIZES - 1))))
            px, py = VP[0] + (ref[0] - VP[0]) * s, VP[1] + (ref[1] - VP[1]) * s
            f = empty.copy()
            w = w0 * s  # the headlights' wash on the road, as title.ts draws it: a soft warm ellipse, added
            gx, gy, rx, ry = px + GLOW[0] * w, py + GLOW[1] * w, GLOW[2] * w, GLOW[3] * w
            yy, xx = np.mgrid[0 : f.shape[0], 0 : f.shape[1]]
            fall = np.clip(1 - ((xx - gx) / rx) ** 2 - ((yy - gy) / ry) ** 2, 0, 1) * GLOW[4]
            f[..., :3] = np.clip(f[..., :3] + fall[..., None] * np.array([255, 196, 110]) * 0.6, 0, 255).astype(np.uint8)
            r, c = divmod(i, COLS)
            cell = strip[r * ch : (r + 1) * ch, c * cw : (c + 1) * cw]
            x, y = round(px - cw / 2), round(py - ch)
            reg = f[max(0, y) : y + ch, max(0, x) : x + cw]
            src = cell[max(0, -y) : max(0, -y) + reg.shape[0], max(0, -x) : max(0, -x) + reg.shape[1]]
            a = src[..., 3:4] > 0
            reg[..., :3] = np.where(a, src[..., :3], reg[..., :3])
            pm.write_png(os.path.join(d, f"frame-{k:03d}.png"), f)
        print(f"preview: {n + 1} frames in {d}")


if __name__ == "__main__":
    main()
