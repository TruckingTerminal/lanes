#!/usr/bin/env python3
"""The company switcher's glyph for the top strip, drawn by hand at 16 × 16 (the painted icons/switch.png blurs below
about 16 px): two arrows chasing round a circle, the palette's amber over the top and its cyan under, each a half turn
of the other, a pixel apart where one's tail meets the other's tip, outlined in ink and lit from above.

  switch-glyph.py   → assets/icons/switch16.png
"""
import importlib.util
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("pm", os.path.join(HERE, "paint-map.py"))
pm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pm)  # type: ignore[union-attr]

HEX = lambda h: tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))
INK, GOLD, AMBER, AMBER_D, CYAN, TEAL = map(HEX, ("#090c17", "#ffd96a", "#f4a83c", "#c96a26", "#7fdcea", "#2f7f86"))

# The amber arrow, row by row (first and last column filled): over the top clockwise, its head pointing down at the
# right. The cyan one is the same turned half round.
ARROW = {2: [(5, 10)], 3: [(3, 12)], 4: [(2, 13)], 5: [(2, 4), (11, 13)], 6: [(10, 14)], 7: [(11, 13)], 8: [(12, 12)]}


def main() -> None:
    n = 16
    who = np.zeros((n, n), int)  # 0 empty, 1 amber, 2 cyan
    for y, spans in ARROW.items():
        for x0, x1 in spans:
            who[y, x0 : x1 + 1] = 1
            who[n - 1 - y, n - 1 - x1 : n - x0] = 2
    out = np.zeros((n, n, 4), np.uint8)
    for y in range(n):
        for x in range(n):
            k = who[y, x]
            if not k:
                continue
            top = y == 0 or who[y - 1, x] != k
            bottom = y == n - 1 or who[y + 1, x] != k
            if k == 1:
                c = GOLD if top else AMBER_D if bottom else AMBER
            else:
                c = TEAL if bottom else CYAN
            out[y, x] = (*c, 255)
    on = who > 0
    ring = np.zeros_like(on)
    ring[1:] |= on[:-1]
    ring[:-1] |= on[1:]
    ring[:, 1:] |= on[:, :-1]
    ring[:, :-1] |= on[:, 1:]
    ring &= ~on
    out[ring] = (*INK, 255)
    path = os.path.join(HERE, "..", "assets", "icons", "switch16.png")
    pm.write_png(path, out)
    print(f"icons/switch16.png: {n}×{n}")


if __name__ == "__main__":
    main()
