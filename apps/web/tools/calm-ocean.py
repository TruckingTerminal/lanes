#!/usr/bin/env python3
"""Evens the open sea of a painted level: each tile paints the deep water its own shade, so far from any
land the water takes the shade of the level below, doubled smoothly, with a feather toward the coast.
   calm-ocean.py <level.png> <base.png> <lower-level.png> [--reach 24]"""
import importlib.util
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("pm", os.path.join(HERE, "paint-map.py"))
pm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pm)  # type: ignore[union-attr]

level, base_path, lower = sys.argv[1:4]
reach = int(sys.argv[sys.argv.index("--reach") + 1]) if "--reach" in sys.argv else 24
img = pm.read_png(level).astype(np.float32)
base = pm.read_png(base_path)
h, w, _ = img.shape
# Sea in the code base: the two deep-water shades (the base's PAL.sea / seaD) and nothing else.
r, g, b = base[:, :, 0].astype(int), base[:, :, 1].astype(int), base[:, :, 2].astype(int)
sea = (b > r + 20) & (b > g) & (r < 90)
# Distance from land, by repeated erosion: `d` counts how many erosions a pixel survives.
d = np.zeros((h, w), np.int32)
cur = sea.copy()
for i in range(reach):
    cur = cur & np.roll(cur, 1, 0) & np.roll(cur, -1, 0) & np.roll(cur, 1, 1) & np.roll(cur, -1, 1)
    d[cur] = i + 1
alpha = np.clip(d / reach, 0, 1).astype(np.float32)[:, :, None]
low = pm.read_png(lower).astype(np.float32)
f = low
rows = np.empty((f.shape[0] * 2, f.shape[1], 4), np.float32)
rows[0::2] = f
rows[1::2] = (f + np.roll(f, -1, axis=0)) / 2
cols = np.empty((rows.shape[0], rows.shape[1] * 2, 4), np.float32)
cols[:, 0::2] = rows
cols[:, 1::2] = (rows + np.roll(rows, -1, axis=1)) / 2
up = cols[:h, :w]
out = img * (1 - alpha) + up * alpha
out[:, :, 3] = 255
pm.write_png(level, out.round().astype(np.uint8))
print(f"{level}: {int((alpha[:, :, 0] > 0).sum())} sea pixels evened, {int((alpha[:, :, 0] >= 1).sum())} fully")
