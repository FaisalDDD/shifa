import fs from "node:fs";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// A Supabase anon key is designed to be public. Never put a service-role key here.
// Defaults to the hosted production project (packaged EXEs must reach production,
// not the local dev stack). Local dev overrides via env vars.
let active: SupabaseConfig = {
  url: process.env.SHIFA_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "https://lfumkuzmkmniwstzqcct.supabase.co",
  anonKey: process.env.SHIFA_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    "sb_publishable_W1_hnE6z2yM5T5UsO1A_Tw_NEZBQV1g",
};

export function loadSupabaseConfig(filePath: string): void {
  try {
    const saved = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<SupabaseConfig>;
    if (saved.url) {
      active = saved.anonKey
        ? validateSupabaseConfig({ url: saved.url, anonKey: saved.anonKey })
        : { url: saved.url, anonKey: "" };
    }
  } catch {
    // First run or unreadable settings: keep local-first environment/default configuration.
  }
}

export function getSupabaseConfig(): SupabaseConfig {
  return { ...active };
}

export function saveSupabaseConfig(filePath: string, input: SupabaseConfig): SupabaseConfig {
  active = validateSupabaseConfig(input);
  fs.writeFileSync(filePath, JSON.stringify(active, null, 2), { encoding: "utf8", mode: 0o600 });
  return getSupabaseConfig();
}

function validateSupabaseConfig(input: SupabaseConfig): SupabaseConfig {
  let parsed: URL;
  try {
    parsed = new URL(input.url.trim());
  } catch {
    throw new Error("Enter a valid Supabase project URL.");
  }
  if (!(parsed.protocol === "https:" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "10.0.2.2")) {
    throw new Error("Supabase URL must use HTTPS, except for a local development server.");
  }
  const anonKey = input.anonKey.trim();
  if (anonKey.length < 20 || /service[_-]?role/i.test(anonKey)) {
    throw new Error("Enter the public anon/publishable key. Never use a service-role key.");
  }
  return { url: parsed.toString().replace(/\/$/, ""), anonKey };
}
