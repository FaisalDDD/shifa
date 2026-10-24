import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
vi.mock("server-only", () => ({}));
import { getProRelease } from "@/services/pharmacy-portal/pro-release";
import { GET } from "@/app/api/downloads/pro/route";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(process.env.TMPDIR ?? "C:/Users/FKDMA/AppData/Local/hermes/cache/scratch", "portal-release-"));
  await mkdir(path.join(root, "pro", "release"), { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(root);
});
afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });
const installer = (name: string, content = "MZ-test-installer") => writeFile(path.join(root, "pro", "release", name), content);

describe("fixed-path Pro installer download", () => {
  it("returns an honest 503 with no installer", async () => {
    expect(await getProRelease()).toBeNull();
    expect((await GET()).status).toBe(503);
  });
  it("selects the newest numeric version, not portable executables or arbitrary files", async () => {
    await installer("Shifa Pro Setup 0.9.0.exe", "MZ-old");
    await installer("Shifa Pro Setup 0.10.0.exe", "MZ-new");
    await installer("Shifa Pro 99.0.0.exe", "MZ-portable");
    await installer("malicious.exe", "MZ-other");
    expect((await getProRelease())?.version).toBe("0.10.0");
    expect(await (await GET()).text()).toBe("MZ-new");
  });
  it("does not advertise an empty installer", async () => {
    await installer("Shifa Pro Setup 0.1.0.exe", "");
    expect(await getProRelease()).toBeNull();
    expect((await GET()).status).toBe(503);
  });

  it("streams the real installer bytes with attachment headers, ignoring client paths", async () => {
    await installer("Shifa Pro Setup 0.1.0.exe");
    const metadata = await getProRelease();
    expect(metadata).toEqual({ filename: "Shifa Pro Setup 0.1.0.exe", version: "0.1.0", sizeBytes: Buffer.byteLength("MZ-test-installer"), downloadUrl: "/api/downloads/pro" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain('attachment; filename="Shifa Pro Setup 0.1.0.exe"');
    expect(response.headers.get("Content-Length")).toBe(String(Buffer.byteLength("MZ-test-installer")));
    expect(await response.text()).toBe("MZ-test-installer");
  });
});
