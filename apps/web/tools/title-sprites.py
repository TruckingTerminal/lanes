#!/usr/bin/env python3
"""The title's sprite atlas (Jeff, 2026-11-01: a real semi, traffic and life at random, no loops).

title.ts draws both shots live, in code, from one atlas and a seeded schedule; this cuts the atlas. Sources, in
assets/title/objects (asset-pass.sh titlesprites): tractor.png, pickup.png and sedan.png, PixelLab eight-direction
sheets (cells south, south-east, east, north-east, north, north-west, west, south-west); assets/title/parallax:
diner.png and scrub.png (plants on one sheet, cut apart at empty columns); assets/title/title.png and approach.png,
the original painting and the same with its truck painted out, so the truck is cut out where the two differ.

Side view, at one scale (about 2.15 px a foot): the tractor's east view (the trailer behind it is drawn in code, so
the gap, the fifth wheel, the landing gear and the rear tandem are exact) in four paints, the pickup and the sedan,
the diner, the plants and a tumbleweed in four turns. Head-on view: the painting's truck and the pickup's and
sedan's south-west (coming) and north-east (going) views at HEAD sizes, each the area average of its pixels snapped
back to its own colours, shrinking only, except the painting's truck past its painted size, which is pixel-doubled
for the moment it passes the camera. Everything but the painting's truck is dimmed toward the dusk.

  title-sprites.py   → assets/title/sprites.png, and the table between the sprite markers in src/title.ts
"""
import colorsys
import importlib.util
import os
import re

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("pm", os.path.join(HERE, "paint-map.py"))
pm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pm)  # type: ignore[union-attr]

TITLE = os.path.join(HERE, "..", "assets", "title")
TS = os.path.join(HERE, "..", "src", "title.ts")
DIRS = ["s", "se", "e", "ne", "n", "nw", "w", "sw"]
GRADE = np.array([0.88, 0.8, 0.84], np.float32)  # the game's flat colours toward the evening light
SIDE = 0.7  # the tractor's sheet to the side view's scale
HEAD_N, HEAD_S0, HEAD_S1 = 30, 0.1, 2.8  # head-on sizes: scale 1 is the depth where the painting has its truck
HEAD_W1 = {"truck": None, "pickup": 30, "sedan": 28}  # width at scale 1 (the truck's is its painted width)
BOX = (122, 56, 202, 112)  # the painting's truck, down to its tyres
# The tractor's east view in its 85-px cell: tyre centres and radius, the fifth wheel, the frame top, the sleeper's back.
TRACTOR = {"wheels": [(11, 57), (24, 57), (73, 57)], "r": 5, "fifth": 17, "frame": 48, "back": 34}
PAINTS = {"red": 2, "white": None, "amber": 38}  # hue in degrees for the tractor's other paints (None: white)


def read(*p: str) -> np.ndarray:
    return pm.read_png(os.path.join(*p))


def cell(sheet: np.ndarray, d: str) -> np.ndarray:
    c = sheet.shape[0]
    i = DIRS.index(d)
    return sheet[:, i * c : (i + 1) * c]


def crop(img: np.ndarray):
    ys, xs = np.nonzero(img[..., 3] > 0)
    return img[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1], int(xs.min()), int(ys.min())


def box_weights(n_out: int, n_in: int) -> np.ndarray:
    w = np.zeros((n_out, n_in), np.float32)
    step = n_in / n_out
    for o in range(n_out):
        a, b = o * step, (o + 1) * step
        for i in range(int(a), min(n_in, int(np.ceil(b)))):
            w[o, i] = min(b, i + 1) - max(a, i)
    return w / w.sum(1, keepdims=True)


def resize(img: np.ndarray, w: int, h: int) -> np.ndarray:
    """Area average down (snapped back to the sprite's own colours), pixel repeat up."""
    h0, w0 = img.shape[:2]
    if w >= w0 and h >= h0:
        ys = (np.arange(h) * h0 / h).astype(int)
        xs = (np.arange(w) * w0 / w).astype(int)
        return img[ys][:, xs].copy()
    a = img[..., 3].astype(np.float32) / 255
    wy, wx = box_weights(h, h0), box_weights(w, w0)
    alpha = wy @ a @ wx.T
    rgb = np.stack([wy @ (img[..., c] * a) @ wx.T for c in range(3)], -1) / np.maximum(alpha[..., None], 1e-6)
    palette = np.unique(img[img[..., 3] > 0][:, :3], axis=0).astype(np.float32)
    near = ((rgb[:, :, None, :] - palette[None, None, :, :]) ** 2).sum(-1).argmin(-1)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = palette[near]
    out[..., 3] = np.where(alpha >= 0.5, 255, 0)
    return out


def scaled(img: np.ndarray, s: float) -> np.ndarray:
    h0, w0 = img.shape[:2]
    return resize(img, max(1, round(w0 * s)), max(1, round(h0 * s)))


def dusk(img: np.ndarray) -> np.ndarray:
    out = img.copy()
    out[..., :3] = (img[..., :3].astype(np.float32) * GRADE).round().clip(0, 255).astype(np.uint8)
    return out


def repaint(img: np.ndarray, hue) -> np.ndarray:
    """The cyan paint moved to another hue (or to white), shading kept; a swap of colours, not a filter."""
    out = img.copy()
    for y in range(img.shape[0]):
        for x in range(img.shape[1]):
            if img[y, x, 3] == 0:
                continue
            r, g, b = (img[y, x, :3] / 255).tolist()
            h, s, v = colorsys.rgb_to_hsv(r, g, b)
            if 0.45 < h < 0.58 and s > 0.3:
                if hue is None:
                    nr, ng, nb = colorsys.hsv_to_rgb(0.6, 0.06, min(1, v * 1.05))
                else:
                    nr, ng, nb = colorsys.hsv_to_rgb(hue / 360, min(1, s * 1.05), v * 0.92)
                out[y, x, :3] = [round(nr * 255), round(ng * 255), round(nb * 255)]
    return out


def painted_truck() -> np.ndarray:
    title, empty = read(TITLE, "title.png"), read(TITLE, "approach.png")
    x0, y0, x1, y1 = BOX
    d = np.abs(title[y0:y1, x0:x1, :3].astype(int) - empty[y0:y1, x0:x1, :3].astype(int)).sum(2)
    m = d > 45
    for _ in range(2):
        g = m.copy()
        g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
        m = g
    for _ in range(2):
        s = m.copy()
        s[1:] &= m[:-1]; s[:-1] &= m[1:]; s[:, 1:] &= m[:, :-1]; s[:, :-1] &= m[:, 1:]
        m = s
    outside = np.zeros_like(m)
    stack = [(y, x) for y in range(m.shape[0]) for x in (0, m.shape[1] - 1)] + [(y, x) for x in range(m.shape[1]) for y in (0, m.shape[0] - 1)]
    while stack:
        y, x = stack.pop()
        if 0 <= y < m.shape[0] and 0 <= x < m.shape[1] and not m[y, x] and not outside[y, x]:
            outside[y, x] = True
            stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    m = ~outside
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = title[y0:y1, x0:x1, :3]
    rgba[..., 3] = np.where(m, 255, 0)
    truck, cx, cy = crop(rgba)
    return truck, (x0 + cx + truck.shape[1] / 2, y0 + cy + truck.shape[0])


def plants(sheet: np.ndarray) -> list:
    filled = (sheet[..., 3] > 0).any(axis=0)
    out, x = [], 0
    while x < len(filled):
        if filled[x]:
            start = x
            while x < len(filled) and filled[x]:
                x += 1
            out.append(crop(sheet[:, start:x])[0])
        x += 1
    return out


def main() -> None:
    sprites: dict = {}
    meta: dict = {}
    # The side view.
    tsheet = read(TITLE, "objects", "tractor.png")
    te, tx, ty = crop(cell(tsheet, "e"))
    tractor = scaled(te, SIDE)
    k = tractor.shape[1] / te.shape[1]
    sprites["tractor"] = dusk(tractor)
    for name, hue in PAINTS.items():
        sprites[f"tractor-{name}"] = dusk(scaled(repaint(te, hue), SIDE))
    t = TRACTOR
    meta["tractor"] = {
        "wheels": [[round((x - tx) * k, 1), round((y - ty) * k, 1)] for x, y in t["wheels"]],
        "r": round(t["r"] * k, 1),
        "fifth": round((t["fifth"] - tx) * k, 1),
        "frame": round((t["frame"] - ty) * k, 1),
        "back": round((t["back"] - tx) * k, 1),
    }
    for kind, s in (("pickup", 0.51), ("sedan", 0.42)):
        side = crop(cell(read(TITLE, "objects", f"{kind}.png"), "e"))[0]
        sprites[kind] = dusk(scaled(side, s))
    sprites["diner"] = crop(read(TITLE, "parallax", "diner.png"))[0]
    sage, grass, saguaro, pear, rocks, weed = plants(read(TITLE, "parallax", "scrub.png"))
    sprites.update(sage=sage, grass=grass, saguaro=saguaro, pear=pear, rocks=rocks)
    weed = scaled(weed, 0.6)
    for i in range(4):
        sprites[f"weed{i}"] = np.rot90(weed, -i).copy()
    # The head-on view.
    truck, at = painted_truck()
    meta["at"] = [round(at[0], 1), round(at[1], 1)]
    heads = [HEAD_S0 * (HEAD_S1 / HEAD_S0) ** (i / (HEAD_N - 1)) for i in range(HEAD_N)]
    for i, s in enumerate(heads):
        sprites[f"truck-sw-{i}"] = scaled(truck, s)
    for kind in ("pickup", "sedan"):
        sheet = read(TITLE, "objects", f"{kind}.png")
        for d in ("sw", "ne"):
            src = dusk(crop(cell(sheet, d))[0])
            for i, s in enumerate(heads):
                w = max(2, round(HEAD_W1[kind] * s))
                sprites[f"{kind}-{d}-{i}"] = resize(src, min(w, src.shape[1]), max(1, round(src.shape[0] * min(w, src.shape[1]) / src.shape[1])))
    meta["heads"] = [round(s, 4) for s in heads]
    meta["w1"] = {"truck": truck.shape[1], "pickup": HEAD_W1["pickup"], "sedan": HEAD_W1["sedan"]}
    # Shelf-pack, tallest first, one pixel apart.
    order = sorted(sprites, key=lambda n: -sprites[n].shape[0])
    width, x, y, row, rects = 512, 0, 0, 0, {}
    for n in order:
        h, w = sprites[n].shape[:2]
        if x + w > width:
            x, y, row = 0, y + row + 1, 0
        rects[n] = (x, y, w, h)
        x, row = x + w + 1, max(row, h)
    atlas = np.zeros((y + row, width, 4), np.uint8)
    for n, (x, y, w, h) in rects.items():
        atlas[y : y + h, x : x + w] = sprites[n]
    pm.write_png(os.path.join(TITLE, "sprites.png"), atlas)
    table = ",\n".join(f'  "{n}": [{x}, {y}, {w}, {h}]' for n, (x, y, w, h) in sorted(rects.items()))
    block = (
        "// <sprites> written by tools/title-sprites.py\n"
        f"const SPR: Record<string, readonly [number, number, number, number]> = {{\n{table},\n}};\n"
        f"const TRACTOR = {repr(meta['tractor']).replace(chr(39), chr(34))} as const;\n"
        f"const HEADS = {meta['heads']} as const;\n"
        f"const HEAD_W1 = {repr(meta['w1']).replace(chr(39), chr(34))} as const;\n"
        f"const PAINTED_AT = {meta['at']} as const;\n"
        "// </sprites>"
    )
    src = open(TS).read()
    src, n = re.subn(r"// <sprites>.*?// </sprites>", lambda _: block, src, flags=re.S)
    assert n == 1, "title.ts needs the sprite markers"
    open(TS, "w").write(src)
    print(f"sprites.png: {len(rects)} sprites in {width}×{atlas.shape[0]}; title.ts table updated")


if __name__ == "__main__":
    main()
