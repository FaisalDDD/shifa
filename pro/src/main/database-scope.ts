import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/** Stable private path: branch IDs and backend URLs never become path fragments. */
export function databasePath(userData: string, backendUrl: string, branchId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) {
    throw new Error("Select a valid pharmacy branch before opening local records.");
  }
  const backend = new URL(backendUrl);
  if (!["http:", "https:"].includes(backend.protocol) || backend.username || backend.password || backend.search || backend.hash) {
    throw new Error("Select a valid pharmacy backend.");
  }
  const identity = `${backend.toString().replace(/\/+$/, "")}\n${branchId.toLowerCase()}`;
  const scope = createHash("sha256").update(identity).digest("hex");
  return path.join(userData, "branches", scope, "shifa-pro.db");
}

export function legacyImportAvailable(userData: string): boolean {
  return fs.existsSync(path.join(userData, "shifa-pro.db")) &&
    !fs.existsSync(path.join(userData, "legacy-database-claim.json"));
}

/** Called only after an authenticated owner explicitly chooses the target branch. */
export function importLegacyDatabase(userData: string, target: string): void {
  const relative = path.relative(path.join(userData, "branches"), target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || path.basename(target) !== "shifa-pro.db") {
    throw new Error("Invalid branch database destination.");
  }
  if (!legacyImportAvailable(userData) || fs.existsSync(target)) {
    throw new Error("Existing records are already assigned or the branch has its own records.");
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const marker = path.join(userData, "legacy-database-claim.json");
  const descriptor = fs.openSync(marker, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, JSON.stringify({ target: relative, imported_at: new Date().toISOString() }));
    fs.fsyncSync(descriptor);
  } finally { fs.closeSync(descriptor); }
  try {
    // Keep the original file untouched for recovery, and never import it twice.
    fs.copyFileSync(path.join(userData, "shifa-pro.db"), target, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    fs.rmSync(marker, { force: true });
    throw error;
  }
}
