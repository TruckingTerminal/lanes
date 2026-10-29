#!/usr/bin/env python3
"""
PixelLab asset tool for LANES. Reads the API token from .pixellab.token at the repo root
(never committed). Each command spends one generation on the account.

  pixellab.py balance
  pixellab.py object  "description" <size 24-168> <out-dir> [--view "low top-down"|"high top-down"|side] [--palette]
      → an 8-direction object: <out-dir>/<east|south-east|...>.png
  pixellab.py image   "description" <w> <h> <out.png> [--view side|"low top-down"|"high top-down"] [--transparent] [--palette] [--detail low|medium|high]
      → one pixflux image (synchronous)
  pixellab.py character "description" <out-dir> [--view ...]
      → an 8-direction character (v3): <out-dir>/<direction>.png

The LANES palette ("Interstate Dusk", apps/web/src/art.ts) is passed as the target palette with --palette.
"""
import base64
import json
import os
import ssl
import sys
import time
import urllib.request

# python.org builds ship without the system certificate bundle; macOS keeps one here.
_CA = next((p for p in ("/etc/ssl/cert.pem", "/private/etc/ssl/cert.pem") if os.path.exists(p)), None)
try:
    import certifi  # type: ignore

    _CA = certifi.where()
except ImportError:
    pass
CTX = ssl.create_default_context(cafile=_CA) if _CA else ssl.create_default_context()

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
API = "https://api.pixellab.ai/v2"
PALETTE = [
    "#090c17", "#10172a", "#1a2340", "#283659", "#45587c", "#7b8db0", "#b6c4dc", "#ece4cf", "#fbf7ea",
    "#ffd96a", "#f4a83c", "#c96a26", "#9b3c26", "#8f573a", "#d84a3a", "#8e2a24", "#ee9680",
    "#e0c48e", "#b8945f", "#cf9f66", "#9ea36b", "#707f3f", "#5d8a44", "#44703a", "#2f5a3a", "#203f2d",
    "#857870", "#594c45", "#a89b90", "#e8eef3", "#112640", "#18385a", "#2b5a7e", "#5f93b4", "#2f7f86", "#7fdcea",
    "#4070c8", "#2a4b8c", "#7fa0e4", "#a9dc62", "#6a3d70", "#dfe8f2", "#9fb0c8",
]
DIRS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"]


def token() -> str:
    for p in (os.path.join(ROOT, ".pixellab.token"), os.path.join(os.getcwd(), ".pixellab.token")):
        if os.path.exists(p):
            return open(p).read().strip()
    sys.exit("no .pixellab.token found at the repo root")


def call(method: str, path: str, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} → {e.code}: {e.read().decode()[:600]}")


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=120, context=CTX) as r:
        return r.read()


def flag(name: str, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith("--"):
            return sys.argv[i + 1]
        return True
    return default


VALUE_FLAGS = ("--view", "--detail", "--size")


def args():
    """Positional arguments: everything after the command that isn't a flag or a value flag's value."""
    out, skip = [], False
    for a in sys.argv[2:]:
        if skip:
            skip = False
            continue
        if a in VALUE_FLAGS:
            skip = True
            continue
        if a.startswith("--"):
            continue
        out.append(a)
    return out


def save_sheet(object_id: str, out_dir: str, name: str, kind: str = "objects") -> None:
    """The spritesheet export: a zip with one PNG (8 cells in a row) and its layout JSON."""
    import io
    import zipfile

    req = urllib.request.Request(f"{API}/{kind}/{object_id}/spritesheet", headers={"Authorization": f"Bearer {token()}"})
    with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
        data = r.read()
    z = zipfile.ZipFile(io.BytesIO(data))
    for info in z.infolist():
        ext = os.path.splitext(info.filename)[1].lower()
        if ext in (".png", ".json"):
            open(os.path.join(out_dir, f"{name}{ext}"), "wb").write(z.read(info))


def wait_object(object_id: str, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    name = os.path.basename(os.path.normpath(out_dir))
    for _ in range(120):
        o = call("GET", f"/objects/{object_id}")
        st = o.get("status")
        if st == "completed":
            save_sheet(object_id, out_dir, name)
            open(os.path.join(out_dir, "object.json"), "w").write(json.dumps({"id": object_id, "prompt": o.get("prompt"), "size": o.get("size"), "view": o.get("view")}, indent=1))
            print(f"saved {out_dir}/{name}.png + .json ({o['size']['width']}×{o['size']['height']} cells, 8 directions)")
            return
        if st == "failed":
            sys.exit(f"object {object_id} failed: {json.dumps(o)[:400]}")
        print(f"  {st} {o.get('progress_percent') or 0}% eta {o.get('eta_seconds')}s", flush=True)
        time.sleep(10)
    sys.exit("timed out")


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    pos = args()
    if cmd == "balance":
        print(json.dumps(call("GET", "/balance")))
    elif cmd == "object":
        desc, size, out_dir = pos[0], int(pos[1]), pos[2]
        body = {"description": desc, "size": size, "view": flag("--view", "low top-down")}
        if flag("--palette"):
            body["target_palette"] = {"colors": PALETTE}
        r = call("POST", "/create-8-direction-object", body)
        print(f"job {r['background_job_id']} object {r['object_id']}")
        wait_object(r["object_id"], out_dir)
    elif cmd == "image":
        desc, w, h, out = pos[0], int(pos[1]), int(pos[2]), pos[3]
        body = {"description": desc, "image_size": {"width": w, "height": h}, "no_background": bool(flag("--transparent"))}
        v = flag("--view")
        if v:
            body["view"] = v
        d = flag("--detail")
        if d:
            body["detail"] = {"low": "low detail", "medium": "medium detail", "high": "highly detailed"}[d]
        body["outline"] = "single color black outline"
        body["shading"] = "medium shading"
        if flag("--palette"):
            # pixflux takes a colour image: a strip of the palette.
            body["color_image"] = {"type": "base64", "base64": palette_strip(), "format": "png"}
        r = call("POST", "/create-image-pixflux", body)
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        open(out, "wb").write(base64.b64decode(r["image"]["base64"]))
        print(f"saved {out}")
    elif cmd == "character":
        desc, out_dir = pos[0], pos[1]
        body = {"description": desc, "view": flag("--view", "low top-down"), "no_background": True, "outline": "single color black outline", "detail": "medium detail"}
        size = flag("--size")
        if size:
            body["image_size"] = {"width": int(size), "height": int(size)}
        r = call("POST", "/create-character-v3", body)
        cid = r["character_id"]
        print(f"job {r['background_job_id']} character {cid}")
        os.makedirs(out_dir, exist_ok=True)
        name = os.path.basename(os.path.normpath(out_dir))
        for _ in range(120):
            c = call("GET", f"/characters/{cid}")
            st = c.get("status")
            if st == "completed":
                save_sheet(cid, out_dir, name, kind="characters")
                open(os.path.join(out_dir, "character.json"), "w").write(json.dumps({"id": cid, "prompt": c.get("prompt"), "size": c.get("size"), "view": c.get("view"), "directions": c.get("directions")}, indent=1))
                print(f"saved {out_dir}/{name}.png + .json ({c.get('size')}, {c.get('directions')} directions)")
                return
            if st == "failed":
                sys.exit(f"character failed: {json.dumps(c)[:400]}")
            print(f"  {st}", flush=True)
            time.sleep(10)
    else:
        print(__doc__)


def palette_strip() -> str:
    """A tiny PNG whose pixels are the palette, built without any imaging library."""
    import struct
    import zlib

    cols = [tuple(int(c[i : i + 2], 16) for i in (1, 3, 5)) for c in PALETTE]
    w, h = len(cols), 4
    raw = b"".join(b"\x00" + b"".join(bytes(c) for c in cols) for _ in range(h))

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
    return base64.b64encode(png).decode()


if __name__ == "__main__":
    main()
