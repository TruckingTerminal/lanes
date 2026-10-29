#!/usr/bin/env python3
"""
Builds the level-1 seasons of the painted map without spending a generation: the colour of the
painted level-0 season (l0-<season>.png, an edit of the painted summer with the same layout) is
carried onto level 1's detail (l1-summer.png, painted from the summer doubled).

  season-l1.py [winter autumn spring]

For every pixel, in luma and chroma: the season's level 0, doubled smoothly, plus the difference
between level 1 and the summer level 0 doubled the same way. Luma detail is scaled by the
season's brightness against summer's (snow brightens it, bare woods keep it), chroma detail by
the season's saturation against summer's, so snowfields stay white with level 1's texture in
them while lakes and roads keep their colour. Output: apps/web/assets/map/l1-<season>.png.
"""
import importlib.util
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
# paint-map.py's PNG codec (the file's name has a hyphen, so it is loaded by path).
_spec = importlib.util.spec_from_file_location("paint_map", os.path.join(HERE, "paint-map.py"))
_pm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pm)
read_png, write_png = _pm.read_png, _pm.write_png

MAP = os.path.join(os.path.dirname(HERE), "assets", "map")


def up2(a: np.ndarray) -> np.ndarray:
    """Doubles an image bilinearly with half-pixel alignment (each source pixel spreads 3:1 into its two halves)."""
    def axis(x: np.ndarray, ax: int) -> np.ndarray:
        prev = np.roll(x, 1, axis=ax)
        nxt = np.roll(x, -1, axis=ax)
        idx = [slice(None)] * x.ndim
        idx[ax] = slice(0, 1)
        prev[tuple(idx)] = x[tuple(idx)]
        idx[ax] = slice(-1, None)
        nxt[tuple(idx)] = x[tuple(idx)]
        lo = 0.75 * x + 0.25 * prev
        hi = 0.75 * x + 0.25 * nxt
        out = np.stack([lo, hi], axis=ax + 1)
        shape = list(x.shape)
        shape[ax] *= 2
        return out.reshape(shape)
    return axis(axis(a, 0), 1)


def ycc(rgb: np.ndarray):
    y = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    return y, rgb[..., 2] - y, rgb[..., 0] - y


def rgb_of(y: np.ndarray, cb: np.ndarray, cr: np.ndarray) -> np.ndarray:
    r = y + cr
    b = y + cb
    g = (y - 0.299 * r - 0.114 * b) / 0.587
    return np.clip(np.stack([r, g, b], axis=-1), 0, 255)


def build(season: str, s0: np.ndarray, s1: np.ndarray) -> None:
    t = time.time()
    w0 = read_png(os.path.join(MAP, f"l0-{season}.png"))[..., :3].astype(np.float32)
    s0u = up2(s0)
    w0u = up2(w0)
    ys, cbs, crs = ycc(s0u)
    yw, cbw, crw = ycc(w0u)
    y1, cb1, cr1 = ycc(s1)
    gain = np.clip((yw + 12) / (ys + 12), 0.5, 1.25)
    y = yw + (y1 - ys) * gain
    sat_s = np.sqrt(cbs * cbs + crs * crs) + 4
    sat_w = np.sqrt(cbw * cbw + crw * crw) + 4
    cgain = np.clip(sat_w / sat_s, 0, 1)
    cb = cbw + (cb1 - cbs) * cgain
    cr = crw + (cr1 - crs) * cgain
    out = np.empty(s1.shape[:2] + (4,), np.uint8)
    out[..., :3] = (rgb_of(y, cb, cr) + 0.5).astype(np.uint8)
    out[..., 3] = 255
    path = os.path.join(MAP, f"l1-{season}.png")
    write_png(path, out)
    print(f"{path}: {out.shape[1]}×{out.shape[0]} in {time.time() - t:.0f}s", flush=True)


def main() -> None:
    seasons = sys.argv[1:] or ["winter", "autumn", "spring"]
    t = time.time()
    s0 = read_png(os.path.join(MAP, "l0-summer.png"))[..., :3].astype(np.float32)
    s1 = read_png(os.path.join(MAP, "l1-summer.png"))[..., :3].astype(np.float32)
    assert s1.shape[0] == 2 * s0.shape[0] and s1.shape[1] == 2 * s0.shape[1], (s0.shape, s1.shape)
    print(f"read summer in {time.time() - t:.0f}s", flush=True)
    for season in seasons:
        build(season, s0, s1)


if __name__ == "__main__":
    main()
