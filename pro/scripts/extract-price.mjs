// Extracts full text from the Wefam price-list PDF to a plain-text file.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const src = process.argv[2] || "C:/Users/FKDMA/Downloads/price wefam 13-10-2026.pdf";
const out = process.argv[3] || "C:/Users/FKDMA/AppData/Local/hermes/cache/scratch/wefam-price.txt";

const buf = fs.readFileSync(src);
const data = await pdfParse(buf);
fs.writeFileSync(out, data.text, "utf8");
console.log("pages:", data.numpages);
console.log("chars:", data.text.length);
console.log("wrote:", out);
