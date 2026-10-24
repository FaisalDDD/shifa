import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>(), root: "" }));
vi.mock("electron", () => ({
  app: { getPath: () => state.root, whenReady: () => Promise.resolve(), on: vi.fn(), quit: vi.fn(), requestSingleInstanceLock: () => true },
  ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => state.handlers.set(name, handler) },
  BrowserWindow: class { static getAllWindows() { return []; } loadFile() {} loadURL() {} },
  dialog: { showMessageBox: async () => ({ response: 1 }) }, shell: {},
}));
vi.mock("../src/main/supabase", () => ({
  signIn: async () => ({ access_token: "isolated-test-token", user_id: "owner-fixture", email: "owner@example.invalid" }),
  postgrest: async (route: string) => route.startsWith("profiles") ? [{ role: "pharmacy_staff" }] : [{ pharmacy_id: "10000000-0000-4000-8000-000000000001", membership_role: "owner" }],
  pharmacyTeamAction: vi.fn(), changePassword: vi.fn(), insertProduct: vi.fn(), uploadProductImage: vi.fn(), lookupProductImage: vi.fn(),
}));

async function invoke(name: string, ...args: unknown[]) { const handler = state.handlers.get(name); expect(handler).toBeDefined(); return handler!(null, ...args); }
beforeAll(async () => {
  state.root = fs.mkdtempSync(path.join(os.tmpdir(), "shifa-ipc-"));
  await import("../electron/main");
  await new Promise(resolve => setImmediate(resolve));
});
afterAll(() => { fs.rmSync(state.root, { recursive: true, force: true }); });

describe("main-process authorization boundaries", () => {
  it("does not open customer records before sign-in", async () => {
    await expect(invoke("customers:list")).rejects.toThrow(/sign in/i);
    expect(fs.existsSync(path.join(state.root, "shifa-pro.db"))).toBe(false);
  });
  it("requires sign-out before changing a connected backend", async () => {
    await invoke("auth:signIn", "owner@example.invalid", "fixture-password");
    await expect(invoke("settings:setBackend", { url: "https://other.example", anonKey: "public-fixture-key-long-enough" })).rejects.toThrow(/sign out/i);
    await invoke("auth:signOut");
  });
  it("clears main-process access when signing out", async () => {
    await invoke("auth:signIn", "owner@example.invalid", "fixture-password");
    await invoke("catalog:list");
    await invoke("auth:signOut");
    await expect(invoke("catalog:list")).rejects.toThrow(/sign in/i);
  });
});
