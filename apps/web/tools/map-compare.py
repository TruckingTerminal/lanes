#!/usr/bin/env python3
"""Builds the map style comparison page (self-contained, images inlined) from the base crops and the samples.
   map-compare.py <base-dir> <samples-dir> <out.html>"""
import base64, os, sys
base, samples, out = sys.argv[1:4]

def img(path, scale):
    if not os.path.exists(path):
        return f'<div class="missing">{os.path.basename(path)} (not generated)</div>'
    b = base64.b64encode(open(path, "rb").read()).decode()
    return f'<img src="data:image/png;base64,{b}" style="width:{scale}">'

rows = [
    ("The whole country at 512 × 320", "us-512", "100%"),
    ("The West at the real map scale (512 × 512 of 1536 × 1024)", "west-1536", "100%"),
    ("The Northeast at the real map scale", "east-1536", "100%"),
]
cols = [("Today (code-drawn)", lambda c: f"{base}/base-{c}.png"), ("Pure painterly", lambda c: f"{samples}/map-{c}-painterly.png"), ("Painterly + isometric mix", lambda c: f"{samples}/map-{c}-mix.png")]
html = ['<!doctype html><meta charset="utf-8"><title>LANES map styles</title><style>',
        'body{margin:0;padding:16px;background:#10172a;color:#ece4cf;font:14px/1.4 system-ui,sans-serif}',
        'h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 8px;color:#b6c4dc}',
        '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
        '.grid div{min-width:0}.grid b{display:block;margin-bottom:4px;color:#ffd96a;font-weight:600}',
        'img{display:block;image-rendering:pixelated;width:100%;border:1px solid #283659;background:#090c17}',
        '.missing{padding:40px 10px;border:1px dashed #45587c;color:#7b8db0;text-align:center}',
        'p{max-width:70ch;color:#b6c4dc}</style>',
        '<h1>The large US map: pure painterly vs. the isometric mix</h1>',
        '<p>Each row is the same crop of the real map (the base the game paints today, left) repainted by PixelLab\'s Pro editor with one instruction per style. Pixel-exact; zoom the page to inspect.</p>']
for title, crop, scale in rows:
    html.append(f'<h2>{title}</h2><div class="grid">')
    for label, f in cols:
        html.append(f'<div><b>{label}</b>{img(f(crop), scale)}</div>')
    html.append('</div>')
html.append('<h2>Zoomed in on a city (what a 512 × 512 detail tile looks like at the closest zoom)</h2>'
            '<p>Today the map only has one painting, so zooming in scales its pixels up (left, Chicago at 4×). With a zoom pyramid the close levels get their own art: a painted tile per style (middle and right, new Pro images in the title\'s style, not repaints).</p><div class="grid">')
for label, path in [("Today at 4× (Chicago)", f"{base}/base-chi-128.png"), ("Pure painterly", f"{samples}/zoom-painterly.png"), ("Painterly + isometric mix", f"{samples}/zoom-mix.png")]:
    html.append(f'<div><b>{label}</b>{img(path, "100%")}</div>')
html.append('</div>')
open(out, "w").write("\n".join(html))
print(out, os.path.getsize(out) // 1024, "KB")
