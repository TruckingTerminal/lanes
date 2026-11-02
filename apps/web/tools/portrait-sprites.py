#!/usr/bin/env python3
"""Iuliia's portrait sheet (Jeff, 2026-11-01: "She has 3 arms. This is slop. Don't make her animations loops").

Her body never moves: one portrait, assets/people/iuliia.png, two hands (one on the folder, one with the pen), is the
rest frame and the poster. Everything she does is a change to her face pasted over it: the source faces in
assets/people/iuliia-faces (frames of PixelLab animations of that same portrait) are aligned to her face, and only the
eye, mouth or face area where they differ is kept. src/portrait.ts plays them on a seeded schedule, with the nod, the
breath and the pen's glint done in code. The sheet holds the rest frame and the patches at 128, 96 and 64 px, each size
resized from the full composed face (area average snapped back to her colours) so a patch and its rest frame share
every pixel they don't change.

  portrait-sprites.py   → assets/people/iuliia-sheet.png, and the table between the portrait markers in src/portrait.ts
"""
import importlib.util
import os
import re

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("pm", os.path.join(HERE, "paint-map.py"))
pm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pm)  # type: ignore[union-attr]
sspec = importlib.util.spec_from_file_location("ts", os.path.join(HERE, "title-sprites.py"))
ts = importlib.util.module_from_spec(sspec)
sspec.loader.exec_module(ts)  # type: ignore[union-attr]

PEOPLE = os.path.join(HERE, "..", "assets", "people")
OUT_TS = os.path.join(HERE, "..", "src", "portrait.ts")
SIZES = (128, 96, 64)
ALIGN = (30, 4, 96, 64)  # x0, y0, x1, y1: face and hair outline, what a source face is aligned on
REGIONS = {"eyes": (46, 24, 80, 40), "mouth": (50, 42, 76, 58), "face": (44, 18, 84, 62)}
# Each pose: its source face and the areas it may change.
POSES = {
    "half": ("blink-half.png", ("eyes",)),
    "shut": ("blink.png", ("eyes",)),
    "side": ("side.png", ("eyes", "mouth")),
    "grin": ("laugh1.png", ("mouth",)),
    "laugh1": ("laugh1.png", ("face",)),
    "laugh2": ("laugh2.png", ("face",)),
}
PEN_BOX = (104, 100, 124, 113)  # the pen, above the hand that holds it, for its glint


def flat(img: np.ndarray, bg: np.ndarray) -> np.ndarray:
    a = img[..., 3:4].astype(np.float32) / 255
    out = np.zeros_like(img)
    out[..., :3] = (img[..., :3] * a + bg * (1 - a)).round().astype(np.uint8)
    out[..., 3] = 255
    return out


def aligned(src: np.ndarray, base: np.ndarray) -> np.ndarray:
    """The source shifted (by whole pixels, up to 10) to sit best on the base's face and hair outline."""
    x0, y0, x1, y1 = ALIGN
    ref = base[y0:y1, x0:x1, :3].astype(int)
    pad = np.pad(src, ((12, 12), (12, 12), (0, 0)), mode="edge")
    best, shift = None, (0, 0)
    for dy in range(-10, 11):
        for dx in range(-10, 11):
            cut = pad[y0 - dy + 12 : y1 - dy + 12, x0 - dx + 12 : x1 - dx + 12, :3].astype(int)
            e = np.abs(cut - ref).mean()
            if best is None or e < best:
                best, shift = e, (dx, dy)
    dx, dy = shift
    return np.roll(np.roll(src, dy, 0), dx, 1)


def composed(base: np.ndarray, src: np.ndarray, areas) -> np.ndarray:
    """The base with the source's face pasted where it differs, inside the pose's areas, grown by a pixel."""
    d = np.abs(src[..., :3].astype(int) - base[..., :3].astype(int)).sum(2) > 36
    keep = np.zeros_like(d)
    for name in areas:
        x0, y0, x1, y1 = REGIONS[name]
        keep[y0:y1, x0:x1] = d[y0:y1, x0:x1]
    grown = keep.copy()
    grown[1:] |= keep[:-1]
    grown[:-1] |= keep[1:]
    grown[:, 1:] |= keep[:, :-1]
    grown[:, :-1] |= keep[:, 1:]
    inside = np.zeros_like(d)  # never past the areas
    for name in areas:
        x0, y0, x1, y1 = REGIONS[name]
        inside[y0:y1, x0:x1] = True
    grown &= inside
    out = base.copy()
    out[grown] = src[grown]
    return out


def main() -> None:
    base = pm.read_png(os.path.join(PEOPLE, "iuliia.png"))
    bg = base[0, 0, :3].astype(np.float32)
    poses = {}
    for name, (file, areas) in POSES.items():
        src = flat(pm.read_png(os.path.join(PEOPLE, "iuliia-faces", file)), bg)
        poses[name] = composed(base, aligned(src, base), areas)
    cells: dict = {}
    table: dict = {}
    for s in SIZES:
        rest = base if s == 128 else ts.resize(base, s, s)
        cells[f"rest-{s}"] = rest
        for name, pose in poses.items():
            p = pose if s == 128 else ts.resize(pose, s, s)
            d = np.abs(p[..., :3].astype(int) - rest[..., :3].astype(int)).sum(2) > (0 if s == 128 else 30)
            if not d.any():
                continue
            if POSES[name][1] == ("eyes",):  # a blink covers its whole eye area, so it also closes the side glance's eyes
                x0, y0, x1, y1 = REGIONS["eyes"]
                g = 0 if s == 128 else 1
                d[max(0, y0 * s // 128 - g) : -(-y1 * s // 128) + g, max(0, x0 * s // 128 - g) : -(-x1 * s // 128) + g] = True
            ys, xs = np.nonzero(d)
            x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            patch = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
            patch[d[y0:y1, x0:x1]] = p[y0:y1, x0:x1][d[y0:y1, x0:x1]]
            cells[f"{name}-{s}"] = patch
            table[f"{name}-{s}"] = (int(x0), int(y0))
    # The pen: its bright pixels, from the cap to the nib, for a glint to run along.
    x0, y0, x1, y1 = PEN_BOX
    box = base[y0:y1, x0:x1, :3].astype(int)
    lit = (box.sum(2) > 360) & (box[..., 0] > box[..., 2] + 20)
    pen = [(int(x0 + np.nonzero(lit[y])[0].min()), int(y0 + y)) for y in range(lit.shape[0]) if lit[y].any()]  # its left edge, cap to nib
    pen = [q for i, q in enumerate(pen) if i == 0 or q[0] <= pen[i - 1][0]]  # one steady line down
    # Shelf-pack.
    order = sorted(cells, key=lambda n: -cells[n].shape[0])
    width, x, y, row, rects = 256, 0, 0, 0, {}
    for n in order:
        h, w = cells[n].shape[:2]
        if x + w > width:
            x, y, row = 0, y + row + 1, 0
        rects[n] = (x, y, w, h)
        x, row = x + w + 1, max(row, h)
    sheet = np.zeros((y + row, width, 4), np.uint8)
    for n, (x, y, w, h) in rects.items():
        sheet[y : y + h, x : x + w] = cells[n]
    pm.write_png(os.path.join(PEOPLE, "iuliia-sheet.png"), sheet)
    lines = []
    for n in sorted(rects):
        x, y, w, h = rects[n]
        dx, dy = table.get(n, (0, 0))
        lines.append(f'  "{n}": [{x}, {y}, {w}, {h}, {dx}, {dy}]')
    block = (
        "// <portrait> written by tools/portrait-sprites.py\n"
        "const CELLS: Record<string, readonly [number, number, number, number, number, number]> = {\n" + ",\n".join(lines) + ",\n};\n"
        f"const PEN = {[list(p) for p in pen]} as const;\n"
        "// </portrait>"
    )
    src = open(OUT_TS).read()
    src, n = re.subn(r"// <portrait>.*?// </portrait>", lambda _: block, src, flags=re.S)
    assert n == 1, "portrait.ts needs the portrait markers"
    open(OUT_TS, "w").write(src)
    print(f"iuliia-sheet.png: {len(rects)} cells in {width}×{sheet.shape[0]}; pen glint along {len(pen)} pixels")


if __name__ == "__main__":
    main()
