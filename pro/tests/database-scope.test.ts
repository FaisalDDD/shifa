import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
const branchA = "10000000-0000-4000-8000-000000000001";
const branchB = "10000000-0000-4000-8000-000000000002";
async function subject() { return import("../src/main/database-scope").catch(() => null); }

describe("branch database ownership", () => {
  it("uses different database files for different branches and backends", async () => {
    const scope = await subject(); expect(scope).not.toBeNull(); if (!scope) return;
    const a = scope.databasePath("root", "https://one.example/", branchA);
    expect(a).not.toBe(scope.databasePath("root", "https://one.example", branchB));
    expect(a).not.toBe(scope.databasePath("root", "https://two.example", branchA));
    expect(a).toBe(scope.databasePath("root", "https://one.example", branchA));
    expect(() => scope.databasePath("root", "https://one.example", "../../escape")).toThrow();
  });
  it("never silently imports the legacy shared database", async () => {
    const scope = await subject(); expect(scope).not.toBeNull(); if (!scope) return;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shifa-scope-")); dirs.push(dir);
    fs.writeFileSync(path.join(dir, "shifa-pro.db"), "legacy fixture");
    const target = scope.databasePath(dir, "https://one.example", branchA);
    expect(scope.legacyImportAvailable(dir)).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
    scope.importLegacyDatabase(dir, target);
    expect(fs.readFileSync(target, "utf8")).toBe("legacy fixture");
    expect(fs.readFileSync(path.join(dir, "shifa-pro.db"), "utf8")).toBe("legacy fixture");
    expect(scope.legacyImportAvailable(dir)).toBe(false);
    expect(() => scope.importLegacyDatabase(dir, scope.databasePath(dir, "https://one.example", branchB))).toThrow();
  });
});
