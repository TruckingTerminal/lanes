#!/usr/bin/env python3
"""The title's sprite atlas (Jeff, 2026-11-01: a real semi, traffic and life at random, no loops).

title.ts draws both shots live, in code, from one atlas and a seeded schedule; this cuts the atlas. Sources, in
assets/title/objects (asset-pass.sh titlesprites): tractor.png, pickup.png and sedan.png, PixelLab eight-direction
sheets (cells south, south-east, east, north-east, north, north-west, west, south-west); assets/title/parallax:
diner.png and scrub.png (plants on one sheet, cut apart at empty columns); assets/title/approach.png, the original
painting with its truck painted out.

Side view, at one scale (about 2.15 px a foot): the tractor's east view (the trailer behind it is drawn in code, so
the gap, the fifth wheel, the landing gear and the rear tandem are exact) in four paints, the pickup in two, the sedan,
the diner, the plants and a tumbleweed in four turns, dimmed toward the dusk. Head-on view: the painting's rig, cut
out to stay where it stands; its diner, cut out to drive away from; and its sky and mesas with the poles and the diner
taken out, for the world to stream past under.

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
# The tractor's east view in its 85-px cell: tyre centres and radius, the fifth wheel, the frame top, the sleeper's back.
TRACTOR = {"wheels": [(11, 57), (24, 57), (73, 57)], "r": 5, "fifth": 17, "frame": 48, "back": 34}
PAINTS = {"red": 2, "white": None, "amber": 38}  # hue in degrees for the tractor's other paints (None: white)
# The pickup's second paint, the slate teal of the first painted title's pickup: hue, and its saturation and value scales.
PICKUP_TEAL = (192, 0.5, 0.82)
# The side view's pickup and sedan, facing right, measured on their scaled sprites: tyre centres and radius (title.ts
# rolls its own wheels there, so the painted tyres are taken out), the headlight, the tail light and the tailpipe.
SIDE_CARS = {
    "pickup": {"wheels": [[9, 16], [35, 16]], "r": 3, "head": [39, 10], "tail": [1, 9], "pipe": [3, 16]},
    "sedan": {"wheels": [[9, 12], [29, 12]], "r": 2, "head": [34, 8], "tail": [0, 9], "pipe": [2, 12]},
}
# The head-on shot, its camera backing down the road ahead of the painting's rig: the rig (cut where the painting and
# its truckless copy differ, inside this box), the diner (its building and roof, its sign) to drive away from, and the
# sky and mesas above the horizon with the poles and the diner taken out.
TRUCK_BOX = (122, 56, 202, 112)
DINER_BOX = (8, 62, 85, 98)
DINER_PARTS = [(9, 69, 84, 97), (44, 62, 75, 79)]
SKY_ROWS = 89


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


def repaint_red(img: np.ndarray, hue: float, s_k: float, v_k: float) -> np.ndarray:
    """The pickup's red body moved to another paint, shading kept; chrome, glass and tyres untouched."""
    out = img.copy()
    for y in range(img.shape[0]):
        for x in range(img.shape[1]):
            if img[y, x, 3] == 0:
                continue
            r, g, b = (img[y, x, :3] / 255).tolist()
            h, s, v = colorsys.rgb_to_hsv(r, g, b)
            if (h < 0.04 or h > 0.94) and s > 0.35:
                nr, ng, nb = colorsys.hsv_to_rgb(hue / 360, s * s_k, min(1, v * v_k))
                out[y, x, :3] = [round(nr * 255), round(ng * 255), round(nb * 255)]
    return out


def tyres_out(img: np.ndarray, wheels, r: float) -> np.ndarray:
    """The painted tyres taken out (their dark pixels inside each wheel's disc), for wheels drawn in code."""
    out = img.copy()
    ys, xs = np.mgrid[0 : img.shape[0], 0 : img.shape[1]]
    dark = img[..., :3].astype(int).sum(2) < 200
    for cx, cy in wheels:
        out[((xs - round(cx)) ** 2 + (ys - round(cy)) ** 2 <= (r + 0.7) ** 2) & dark, 3] = 0
    return out


def painted_truck() -> tuple:
    """The painting's rig, cut out where title.png and approach.png (the same with the truck painted out) differ:
    closed, hole-filled, cropped; and where its top-left corner stands in the painting."""
    title, empty = read(TITLE, "title.png"), read(TITLE, "approach.png")
    x0, y0, x1, y1 = TRUCK_BOX
    d = np.abs(title[y0:y1, x0:x1, :3].astype(int) - empty[y0:y1, x0:x1, :3].astype(int)).sum(2)
    m = d > 45
    for _ in range(2):
        g = m.copy()
        g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
        m = g
    for _ in range(2):
        e = m.copy()
        e[1:] &= m[:-1]; e[:-1] &= m[1:]; e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]
        m = e
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
    return truck, (x0 + cx, y0 + cy)


def head_diner() -> tuple:
    """The painting's diner, cut on its own (its building and roof, its sign), and where it stands in the painting."""
    empty = read(TITLE, "approach.png")
    x0, y0, x1, y1 = DINER_BOX
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    out[..., :3] = empty[y0:y1, x0:x1, :3]
    keep = np.zeros(out.shape[:2], bool)
    for bx0, by0, bx1, by1 in DINER_PARTS:
        keep[by0 - y0 : by1 - y0, bx0 - x0 : bx1 - x0] = True
    out[..., 3] = np.where(keep, 255, 0)
    return out, (x0, y0)


def head_sky() -> np.ndarray:
    """The painting above its horizon with the poles, their wires and the diner taken out, for a camera that moves:
    thin dark poles and wires filled across from their neighbours, the diner's patch across from the mesa either side."""
    empty = read(TITLE, "approach.png")
    sky = empty[:SKY_ROWS].copy()
    rgb = sky[..., :3].astype(int)
    lum = rgb @ np.array([0.3, 0.59, 0.11])
    mask = np.zeros(sky.shape[:2], bool)
    right = np.zeros_like(mask)
    right[:, 200:] = True
    mask |= right & (lum < 78) & (rgb[..., 0] >= rgb[..., 2] - 4)  # the poles' and wires' brown, not the mesas' purple
    grown = mask.copy()
    grown[:, 1:] |= mask[:, :-1]
    grown[:, :-1] |= mask[:, 1:]
    mask = grown
    for bx0, by0, bx1, by1 in DINER_PARTS:
        mask[by0:min(by1, SKY_ROWS), bx0 - 1 : bx1 + 1] = True
    out = sky.copy()
    for y in range(SKY_ROWS):
        row = mask[y]
        if not row.any():
            continue
        xs = np.nonzero(~row)[0]
        for x in np.nonzero(row)[0]:
            l = xs[xs < x]
            r = xs[xs > x]
            if len(l) and len(r):
                f = (x - l[-1]) / (r[0] - l[-1])
                c = sky[y, l[-1], :3] * (1 - f) + sky[y, r[0], :3] * f
            else:
                c = sky[y, (l[-1] if len(l) else r[0]), :3]
            out[y, x, :3] = np.clip(c + (np.random.default_rng(y * 999 + x).normal(0, 3)), 0, 255)
    return out


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
    t = TRACTOR
    meta["tractor"] = {
        "wheels": [[round((x - tx) * k, 1), round((y - ty) * k, 1)] for x, y in t["wheels"]],
        "r": round(t["r"] * k, 1),
        "fifth": round((t["fifth"] - tx) * k, 1),
        "frame": round((t["frame"] - ty) * k, 1),
        "back": round((t["back"] - tx) * k, 1),
    }
    tw = meta["tractor"]["wheels"]
    sprites["tractor"] = tyres_out(dusk(tractor), tw, 3)
    for name, hue in PAINTS.items():
        sprites[f"tractor-{name}"] = tyres_out(dusk(scaled(repaint(te, hue), SIDE)), tw, 3)
    for kind, s in (("pickup", 0.51), ("sedan", 0.42)):
        side = crop(cell(read(TITLE, "objects", f"{kind}.png"), "e"))[0]
        sprites[kind] = tyres_out(dusk(scaled(side, s)), SIDE_CARS[kind]["wheels"], SIDE_CARS[kind]["r"])
        if kind == "pickup":
            teal = repaint_red(side, *PICKUP_TEAL)
            sprites["pickup-teal"] = tyres_out(dusk(scaled(teal, s)), SIDE_CARS[kind]["wheels"], SIDE_CARS[kind]["r"])
    sprites["diner"] = crop(read(TITLE, "parallax", "diner.png"))[0]
    sage, grass, saguaro, pear, rocks, weed = plants(read(TITLE, "parallax", "scrub.png"))
    sprites.update(sage=sage, grass=grass, saguaro=saguaro, pear=pear, rocks=rocks)
    weed = scaled(weed, 0.6)
    for i in range(4):
        sprites[f"weed{i}"] = np.rot90(weed, -i).copy()
    # The head-on view: its traffic is modelled and drawn live (tools/title-vehicles.py); only what stands in front of
    # its far rails is cut from the painting here.
    sprites["truck"], meta["truck"] = painted_truck()
    sprites["head-diner"], meta["diner"] = head_diner()
    sprites["head-sky"] = head_sky()
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
        f"const CARS = {repr(SIDE_CARS).replace(chr(39), chr(34))} as const;\n"
        f"const TRUCK_AT = {list(meta['truck'])} as const;\n"
        f"const DINER_AT = {list(meta['diner'])} as const;\n"
        "// </sprites>"
    )
    src = open(TS).read()
    src, n = re.subn(r"// <sprites>.*?// </sprites>", lambda _: block, src, flags=re.S)
    assert n == 1, "title.ts needs the sprite markers"
    open(TS, "w").write(src)
    print(f"sprites.png: {len(rects)} sprites in {width}×{atlas.shape[0]}; title.ts table updated")


if __name__ == "__main__":
    main()
