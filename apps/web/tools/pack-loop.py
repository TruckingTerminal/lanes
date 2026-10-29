#!/usr/bin/env python3
"""Packs an animation loop's frames (frame-01.png … from pixellab.py animate; frame-00 is the input) into one
sheet, a grid of `cols` columns, for the client: pack-loop.py <loop-dir> <out.png> [--cols 4]"""
import glob
import importlib.util
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("pm", os.path.join(HERE, "paint-map.py"))
pm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pm)  # type: ignore[union-attr]

src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[sys.argv.index("--cols") + 1]) if "--cols" in sys.argv else 4
frames = [pm.read_png(f) for f in sorted(glob.glob(os.path.join(src, "frame-*.png")))[1:]]
h, w, _ = frames[0].shape
rows = -(-len(frames) // cols)
sheet = np.zeros((rows * h, cols * w, 4), np.uint8)
for i, f in enumerate(frames):
    r, c = divmod(i, cols)
    sheet[r * h : (r + 1) * h, c * w : (c + 1) * w] = f
pm.write_png(out, sheet)
json.dump({"frames": len(frames), "cols": cols, "w": w, "h": h}, open(out[:-4] + ".json", "w"))
print(f"{out}: {len(frames)} frames of {w}×{h} in {cols} columns")
