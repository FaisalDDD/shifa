import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = path.join(projectRoot, "release");
const runtimeArchive = path.join(releaseRoot, "win-unpacked", "resources", "app.asar");
const stageDirectory = path.join(projectRoot, ".cache", "staff-app-stage");
const rebuiltArchive = path.join(projectRoot, ".cache", "staff-app.asar");

if (!fs.existsSync(runtimeArchive)) {
  throw new Error(`Packaged desktop runtime not found: ${runtimeArchive}`);
}

fs.rmSync(stageDirectory, { recursive: true, force: true });
fs.mkdirSync(stageDirectory, { recursive: true });
asar.extractAll(runtimeArchive, stageDirectory);

for (const directory of ["dist", "dist-electron"]) {
  const target = path.join(stageDirectory, directory);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(path.join(projectRoot, directory), target, { recursive: true });
}

fs.rmSync(rebuiltArchive, { force: true });
await asar.createPackage(stageDirectory, rebuiltArchive);
fs.copyFileSync(rebuiltArchive, runtimeArchive);

for (const packagedApp of ["Shifa-Pro-Finance-Local", "win-unpacked"]) {
  const targetArchive = path.join(releaseRoot, packagedApp, "resources", "app.asar");
  fs.mkdirSync(path.dirname(targetArchive), { recursive: true });
  fs.copyFileSync(rebuiltArchive, targetArchive);
}

console.log(`Updated local Shifa Pro app archives with the latest renderer and main process: ${rebuiltArchive}`);
