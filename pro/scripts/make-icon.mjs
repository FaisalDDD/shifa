// Generates build/icon.ico + build/icon.png + public/logo.png from the source
// logo PNG. Fixes the earlier "broken" icon:
//   1. Luminance-based matte with smooth falloff (kills the white halo),
//   2. padding so the mark never touches the canvas edges,
//   3. drop-glyph-only for small sizes (the "shifa" wordmark is illegible
//      at 16-48px, so small icons use just the drop).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const src = process.argv[2] || "C:/Users/FKDMA/OneDrive/Pictures/shifa logo 1.png";
const outDir = path.join(process.cwd(), "build");
fs.mkdirSync(outDir, { recursive: true });

const input = fs.readFileSync(src);
const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;

// 1) Luminance matte with smooth falloff — no hard white halo.
const HI = 240, LO = 200;
for (let i = 0; i < data.length; i += C) {
  const L = (data[i] + data[i + 1] + data[i + 2]) / 3;
  let a;
  if (L >= HI) a = 0;
  else if (L <= LO) a = 255;
  else a = Math.round((255 * (HI - L)) / (HI - LO));
  data[i + 3] = a;
}

const matted = await sharp(data, {
  raw: { width: W, height: H, channels: 4 },
})
  .png()
  .toBuffer();

const trimmed = await sharp(matted).trim().png().toBuffer();
const tMeta = await sharp(trimmed).metadata();

// Drop glyph is the top ~66% of the mark (wordmark sits below a small gap).
const drop = await sharp(trimmed)
  .extract({ left: 0, top: 0, width: tMeta.width, height: Math.round(tMeta.height * 0.62) })
  .trim()
  .png()
  .toBuffer();

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// 2) Contain the mark at ~82% of the canvas and pad the rest (breathing room).
async function padInto(buf, s) {
  const inner = Math.round(s * 0.82);
  const pad = Math.round((s - inner) / 2);
  return sharp(buf)
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: TRANSPARENT })
    .png()
    .toBuffer();
}

const smallSizes = [16, 24, 32, 48];
const largeSizes = [64, 128, 256];
const pngs = [];
for (const s of smallSizes) pngs.push(await padInto(drop, s));
for (const s of largeSizes) pngs.push(await padInto(trimmed, s));

const iconPng = await padInto(trimmed, 256);
fs.writeFileSync(path.join(outDir, "icon.png"), iconPng);
const ico = await pngToIco(pngs);
fs.writeFileSync(path.join(outDir, "icon.ico"), ico);
fs.writeFileSync(path.join(process.cwd(), "public", "logo.png"), iconPng);

console.log("trimmed mark:", tMeta.width + "x" + tMeta.height);
console.log("wrote build/icon.png + build/icon.ico (" + ico.length + " bytes) + public/logo.png");
