#!/usr/bin/env python3
"""
Paints one level of the LANES map: the code-drawn base (a crop saved by tools/map-harness) repainted by
PixelLab's Pro editor as overlapping 512 × 512 tiles, feathered together so the joins don't show.

  paint-map.py <base.png> <marks.json> <out.png> [--level 0|1] [--season summer|autumn|winter|spring]
               [--seed N] [--dry] [--only r,c] [--resume] [--upscale-from <painted.png>] [--from-painted <painted.png>]

--upscale-from paints a level from the painting one level down, doubled, instead of from the code
base (the editor keeps too much of the code base's flat texture at 2×). --from-painted paints a
season from the painted summer: everything stays where it is and only the season changes.

Tiles go row by row, left to right; the strip a tile shares with its already-painted neighbours is
copied from the painting into the tile's input, so the editor continues the painted ground, and the
result is blended over that strip with a linear ramp. Every tile's prompt names the hubs inside it
with their landmarks (tools/landmarks.json), biggest first and never more than fits the editor's
2,000-character prompt, and tells the editor to write no names (it lettered the cities when they were
only listed). A record of every job goes next to the output as <out>.json so a tile can be redone
(--only r,c) or a stopped run continued (--resume) without repainting the rest. 25 generations a tile.
"""
import base64
import json
import os
import struct
import sys
import zlib

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pixellab  # noqa: E402  (the API client: token, call, wait_job)

TILE = 512
STEP = 480  # 32 pixels of overlap between neighbours
MAX_DESC = 2000
# Hubs biggest first, so a crowded tile names the cities that matter.
PRIORITY = ("CHI EWR LAX DAL HOU ATL MIA SEA OAK DEN PHX BOS PHL DTW MSP STL MEM BNA MSY LAS SLC PDX PIT CLE MKC OKC SAT BWI CLT "
            "MCO TPA JAX IND CMH CVG MKE SDF OMA DSM BUF ALB RIC RDU BHM LIT ELP ABQ TYS SAV LRD ONT FAT SCK RNO BOI FAR ICT AMA MDT ABE").split()
CITIES_PER_TILE = {0: 8, 1: 12}

# --- PNG without an imaging library (8-bit RGB/RGBA, non-interlaced) -------------------------------

def read_png(path: str) -> np.ndarray:
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", path
    pos, chunks, w = 8, [], 0
    while pos < len(data):
        (n,) = struct.unpack(">I", data[pos : pos + 4])
        kind = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + n]
        pos += 12 + n
        if kind == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
            assert depth == 8 and interlace == 0 and ctype in (2, 6), (depth, ctype, interlace)
            ch = 3 if ctype == 2 else 4
        elif kind == b"IDAT":
            chunks.append(body)
    raw = zlib.decompress(b"".join(chunks))
    stride = w * ch
    rows = np.frombuffer(raw, dtype=np.uint8).reshape(h, stride + 1)
    out = np.zeros((h, stride), dtype=np.uint8)
    prev = np.zeros(stride, dtype=np.int32)
    for y in range(h):
        f = rows[y, 0]
        cur = rows[y, 1:].astype(np.int32)
        if f == 0:
            line = cur
        elif f == 1:
            line = cur.copy()
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 255
        elif f == 2:
            line = (cur + prev) & 255
        elif f == 3:
            line = cur.copy()
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            line = cur.copy()
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pred) & 255
        else:
            raise ValueError(f"filter {f}")
        out[y] = line
        prev = line
    img = out.reshape(h, w, ch)
    if ch == 3:
        img = np.concatenate([img, np.full((h, w, 1), 255, np.uint8)], axis=2)
    return img


def write_png(path: str, img: np.ndarray) -> None:
    h, w, _ = img.shape
    raw = b"".join(b"\x00" + img[y].tobytes() for y in range(h))
    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    open(path, "wb").write(png)


def png_b64(img: np.ndarray) -> str:
    h, w, _ = img.shape
    raw = b"".join(b"\x00" + img[y].tobytes() for y in range(h))
    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")
    return base64.b64encode(png).decode()


def b64_png(s: str) -> np.ndarray:
    tmp = os.path.join(HERE, ".tile.png")
    open(tmp, "wb").write(base64.b64decode(s))
    img = read_png(tmp)
    os.remove(tmp)
    return img


# --- The prompts -----------------------------------------------------------------------------------

STYLE = ("highly detailed HD painterly pixel art shading with layered depth, warm late-afternoon light and a saturated palette")
SEASON = {
    "summer": "high summer: deep green woods, golden and green farmland, bright desert, snow only on the highest peaks",
    "autumn": "autumn: the eastern and northern woods in red, orange and gold, harvested brown and gold fields, low amber light, the first snow on the high peaks",
    "winter": "deep winter: snow covers the northern half of the country and every mountain range, bare grey woods, frozen white lakes and rivers in the north, dry brown grass and snow-dusted desert in the south, low cold blue light and long shadows",
    "spring": "early spring: fresh light-green woods and fields, flooded brown rivers, melting snow left on the peaks and the far north, soft clear light",
}
LEVEL = {
    0: ("repaint this top-down pixel art map of the United States as an isometric tycoon game world with {style}: the ground stays a top-down map with every "
        "coastline, river, state line and highway exactly where it is, but the mountain ranges rise as shaded isometric peaks with snow, the forests become "
        "clusters of tiny isometric trees, the farmland a patchwork of fields with tiny barns, every city skyline becomes a small cluster of isometric "
        "buildings with lit windows and every town dot a few tiny isometric houses; {season}. Land across the border in Canada and Mexico is painted as the same kind of terrain, a little more muted, never dark or blank. "
        "Never write any words, names, letters or labels anywhere on the map. Landmarks to draw at the cities in this part of the map (draw them, never their names): {cities}."),
    1: ("repaint this top-down pixel art map of part of the United States as an isometric tycoon game world with {style}, at twice the detail: the ground stays "
        "a top-down map with every coastline, river, state line and highway exactly where it is, with the highways drawn as real roads with lanes and tiny "
        "semi trucks, the mountain ranges as shaded isometric peaks with snow and valleys, the forests as clusters of isometric trees, the farmland as a "
        "patchwork of fields with barns and silos, every city as a cluster of isometric buildings with its real landmarks recognisable, and every town as "
        "a few isometric houses with a water tower; {season}. Land across the border in Canada and Mexico is painted as the same kind of terrain, a little more muted, never dark or blank. "
        "Never write any words, names, letters or labels anywhere on the map. Landmarks to draw at the cities in this part of the map (draw them, never their names): {cities}."),
}


LEVEL["season"] = (
    "repaint this isometric tycoon game map of part of the United States, keeping every coastline, river, road, mountain, forest, field, "
    "town and city exactly where it is and in the same {style}, changing only the season to {season}. Never write any words, names, "
    "letters or labels anywhere on the map. The cities in this part of the map keep their landmarks: {cities}."
)


def prompt(level: int, season: str, hubs_in_tile: list) -> str:
    """The tile's prompt, naming the biggest hubs' landmarks and dropping the smallest until it fits the limit."""
    hubs = list(hubs_in_tile)
    while True:
        cities = "; ".join(hubs) if hubs else "none, open country"
        text = LEVEL[level].format(style=STYLE, season=SEASON[season], cities=cities)
        if len(text) <= MAX_DESC or not hubs:
            return text
        hubs.pop()


# --- Painting ----------------------------------------------------------------------------------------

def windows(w: int, h: int):
    xs = list(range(0, max(1, w - TILE) + 1, STEP))
    if xs[-1] + TILE < w:
        xs.append(w - TILE)
    ys = list(range(0, max(1, h - TILE) + 1, STEP))
    if ys[-1] + TILE < h:
        ys.append(h - TILE)
    return [(r, c, x, y) for r, y in enumerate(ys) for c, x in enumerate(xs)]


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opt = lambda k, d=None: (sys.argv[sys.argv.index(k) + 1] if k in sys.argv and sys.argv.index(k) + 1 < len(sys.argv) else d)
    base_path, marks_path, out = args[0], args[1], args[2]
    level: object = int(opt("--level", 0))
    season = opt("--season", "summer")
    seed = int(opt("--seed", 914065385))
    dry = "--dry" in sys.argv
    only = opt("--only")
    resume = "--resume" in sys.argv
    landmarks = json.load(open(os.path.join(HERE, "landmarks.json")))
    marks = json.load(open(marks_path))
    base = read_png(base_path)
    up = opt("--upscale-from")
    if up:
        src = read_png(up)
        base = np.repeat(np.repeat(src, 2, axis=0), 2, axis=1)[: base.shape[0], : base.shape[1]]
        print(f"painting from {up} doubled to {base.shape[1]}×{base.shape[0]}", flush=True)
    from_painted = opt("--from-painted")
    if from_painted:
        base = read_png(from_painted)
        level = "season"
        print(f"painting the {season} of {from_painted}", flush=True)
    h, w, _ = base.shape
    record_path = out + ".json"
    record = json.load(open(record_path)) if os.path.exists(record_path) and (only or resume) else {"tiles": {}}
    painted = read_png(out) if os.path.exists(out) and (only or resume) else base.copy()
    done = np.zeros((h, w), dtype=bool)
    if only:
        # Redo one tile: its neighbours stay, its own area comes from the base again.
        for key, t in record["tiles"].items():
            if key != only:
                done[t["y"] : t["y"] + TILE, t["x"] : t["x"] + TILE] = True
    if resume:
        for t in record["tiles"].values():
            done[t["y"] : t["y"] + TILE, t["x"] : t["x"] + TILE] = True
    print(f"{base_path}: {w}×{h}, level {level}, {season}, seed {seed}; tiles: {windows(w, h)}", flush=True)
    for r, c, x, y in windows(w, h):
        key = f"{r},{c}"
        if only and key != only:
            continue
        if resume and key in record["tiles"]:
            continue
        # The hubs inside this tile (a margin in, so a city on the edge is still named), biggest first.
        ids = [k for k, (mx, my) in marks.items() if x - 8 <= mx < x + TILE + 8 and y - 8 <= my < y + TILE + 8]
        ids.sort(key=lambda k: PRIORITY.index(k) if k in PRIORITY else 99)
        inside = [landmarks.get(k, k) for k in ids[: CITIES_PER_TILE.get(level, 8)]]  # type: ignore[call-overload]
        desc = prompt(level, season, inside)
        tile_in = base[y : y + TILE, x : x + TILE].copy()
        # Where neighbours are already painted, show the painting so the editor continues it.
        mask = done[y : y + TILE, x : x + TILE]
        tile_in[mask] = painted[y : y + TILE, x : x + TILE][mask]
        if dry:
            print(f"tile {key} at {x},{y}: {int(mask.sum())} px of painted context; {len(inside)} hubs\n  {desc[:160]}…", flush=True)
            continue
        body = {
            "method": "edit_with_text",
            "edit_images": [{"image": {"type": "base64", "base64": png_b64(tile_in)}, "width": TILE, "height": TILE}],
            "image_size": {"width": TILE, "height": TILE},
            "description": desc,
            "no_background": False,
            "seed": seed,
        }
        job = pixellab.call("POST", "/edit-images-v2", body).get("background_job_id")
        print(f"tile {key} at {x},{y}: job {job} ({len(inside)} hubs, {int(mask.sum())} px context)", flush=True)
        lr = pixellab.wait_job(job)
        tile_out = b64_png(lr["images"][0]["base64"])[:, :, :4]
        spent = (lr.get("billing_usage") or {}).get("generations")
        # Blend: a ramp from the painted neighbour to the new tile across every overlap, new paint elsewhere.
        alpha = np.ones((TILE, TILE), dtype=np.float32)
        row = mask[TILE // 2, :]
        col = mask[:, TILE // 2]
        run = lambda line: len(line) if line.all() else int(np.argmin(line))  # painted pixels from the start of the line
        left, right, top, bottom = run(row), run(row[::-1]), run(col), run(col[::-1])
        if 0 < left < TILE:
            alpha[:, :left] = np.minimum(alpha[:, :left], np.linspace(0, 1, left, dtype=np.float32)[None, :])
        if 0 < right < TILE:
            alpha[:, TILE - right :] = np.minimum(alpha[:, TILE - right :], np.linspace(1, 0, right, dtype=np.float32)[None, :])
        if 0 < top < TILE:
            alpha[:top, :] = np.minimum(alpha[:top, :], np.linspace(0, 1, top, dtype=np.float32)[:, None])
        if 0 < bottom < TILE:
            alpha[TILE - bottom :, :] = np.minimum(alpha[TILE - bottom :, :], np.linspace(1, 0, bottom, dtype=np.float32)[:, None])
        alpha[~mask] = 1
        dst = painted[y : y + TILE, x : x + TILE].astype(np.float32)
        src = tile_out.astype(np.float32)
        painted[y : y + TILE, x : x + TILE] = (dst * (1 - alpha[:, :, None]) + src * alpha[:, :, None]).round().astype(np.uint8)
        painted[y : y + TILE, x : x + TILE, 3] = 255
        done[y : y + TILE, x : x + TILE] = True
        record["tiles"][key] = {"x": x, "y": y, "job": job, "seed": lr.get("seed"), "generations": spent, "hubs": len(inside), "description": desc}
        record.update({"base": os.path.basename(base_path), "level": level, "season": season, "size": [w, h]})
        write_png(out, painted)
        json.dump(record, open(record_path, "w"), indent=1)
        print(f"  saved {out} ({spent} generations)", flush=True)


if __name__ == "__main__":
    main()
