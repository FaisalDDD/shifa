import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb, persist, run, get } from "../src/main/db";

const directories: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function file() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shifa-persist-")); directories.push(dir); return path.join(dir, "test.db"); }

describe("durable local database persistence", () => {
  it("keeps the previous database as a recoverable backup", async () => {
    const location = file();
    const local = await openDb(location);
    run(local.db, "INSERT INTO meta(key,value) VALUES('probe','before')");
    persist(local);
    run(local.db, "UPDATE meta SET value='after' WHERE key='probe'");
    persist(local);
    expect(fs.existsSync(`${location}.bak`)).toBe(true);
    const backup = await openDb(`${location}.bak`);
    expect(get<{ value: string }>(backup.db, "SELECT value FROM meta WHERE key='probe'")?.value).toBe("before");
    backup.db.close(); local.db.close();
  });

  it("leaves the committed database untouched if atomic replacement fails", async () => {
    const location = file();
    const local = await openDb(location);
    run(local.db, "INSERT INTO meta(key,value) VALUES('probe','before')"); persist(local);
    const original = fs.readFileSync(location);
    run(local.db, "UPDATE meta SET value='after' WHERE key='probe'");
    const rename = fs.renameSync;
    vi.spyOn(fs, "renameSync").mockImplementation((source, destination) => {
      if (String(destination) === location) throw new Error("simulated disk failure");
      return rename(source, destination);
    });
    expect(() => persist(local)).toThrow("simulated disk failure");
    expect(fs.readFileSync(location).equals(original)).toBe(true);
    expect(fs.readdirSync(path.dirname(location)).some(name => name.endsWith(".tmp"))).toBe(false);
    local.db.close();
  });
});
