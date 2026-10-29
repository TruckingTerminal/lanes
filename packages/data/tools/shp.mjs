// Minimal ESRI shapefile (polyline) + dBase reader. Usage: node shp.mjs <file.shp> <file.dbf> [inspect]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function readDbf(path) {
  const b = readFileSync(path);
  const count = b.readUInt32LE(4);
  const headerLen = b.readUInt16LE(8);
  const recLen = b.readUInt16LE(10);
  const fields = [];
  for (let off = 32; off < headerLen - 1; off += 32) {
    if (b[off] === 0x0d) break;
    const name = b.toString("latin1", off, off + 11).replace(/\0.*$/, "").trim();
    const type = String.fromCharCode(b[off + 11]);
    const len = b[off + 16];
    fields.push({ name, type, len });
  }
  const rows = [];
  for (let i = 0; i < count; i++) {
    const base = headerLen + i * recLen;
    let p = base + 1;
    const row = {};
    for (const f of fields) {
      const raw = b.toString("latin1", p, p + f.len).trim();
      row[f.name] = f.type === "N" || f.type === "F" ? (raw === "" ? null : Number(raw)) : raw;
      p += f.len;
    }
    rows.push(row);
  }
  return { fields, rows };
}

export function readShp(path) {
  const b = readFileSync(path);
  const shapeType = b.readInt32LE(32);
  const out = [];
  let p = 100;
  while (p < b.length) {
    const len = b.readInt32BE(p + 4) * 2; // content length in 16-bit words
    const start = p + 8;
    const type = b.readInt32LE(start);
    if (type === 3 || type === 13 || type === 23) {
      const numParts = b.readInt32LE(start + 36);
      const numPoints = b.readInt32LE(start + 40);
      const parts = [];
      for (let i = 0; i < numParts; i++) parts.push(b.readInt32LE(start + 44 + i * 4));
      const pts = [];
      const ptBase = start + 44 + numParts * 4;
      for (let i = 0; i < numPoints; i++) pts.push([b.readDoubleLE(ptBase + i * 16), b.readDoubleLE(ptBase + i * 16 + 8)]);
      const lines = [];
      for (let i = 0; i < numParts; i++) lines.push(pts.slice(parts[i], i + 1 < numParts ? parts[i + 1] : numPoints));
      out.push(lines);
    } else out.push(null);
    p = start + len;
  }
  return { shapeType, records: out };
}

// Inspect mode, only when run directly (the build tools import this file with their own arguments).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] && process.argv[3]) {
  const shp = readShp(process.argv[2]);
  const dbf = readDbf(process.argv[3]);
  console.log("shape type", shp.shapeType, "records", shp.records.length, "dbf rows", dbf.rows.length);
  console.log("fields:", dbf.fields.map((f) => `${f.name}:${f.type}${f.len}`).join(" "));
  const by = (k) => {
    const m = {};
    for (const r of dbf.rows) m[r[k]] = (m[r[k]] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 25);
  };
  for (const k of ["class", "type", "prefix", "toll", "state", "country", "scalerank"]) if (dbf.fields.some((f) => f.name === k)) console.log(k + ":", JSON.stringify(by(k)));
  let pts = 0;
  const cls = {};
  dbf.rows.forEach((r, i) => {
    const rec = shp.records[i];
    const n = rec ? rec.reduce((s, l) => s + l.length, 0) : 0;
    pts += n;
    const k = `${r.country}|${r.class}`;
    cls[k] = (cls[k] || 0) + n;
  });
  console.log("points", pts);
  console.log("points by country|class:", JSON.stringify(Object.entries(cls).sort((a, b) => b[1] - a[1]).slice(0, 12)));
  console.log("samples:", dbf.rows.filter((r) => r.country === "United States" && r.class === "Interstate").slice(0, 8).map((r) => JSON.stringify(r)).join("\n"));
}
