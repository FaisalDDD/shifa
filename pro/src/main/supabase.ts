// Minimal PostgREST client for talking to the Supabase backend.
// The main process uses this for sync (pull catalog, push queued changes).
// The anon key reads public rows; authenticated writes pass the user's JWT.

import { getSupabaseConfig } from "./config";

export interface PostgrestOptions {
  token?: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function postgrest<T = Record<string, unknown>>(
  path: string,
  opts: PostgrestOptions = {},
): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: opts.token
      ? `Bearer ${opts.token}`
      : `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  };

  // PostgREST returns an empty body on POST unless we ask for the full row.
  if (opts.method === "POST") {
    headers["Prefer"] = "return=representation";
  }

  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostgREST ${res.status} ${path}: ${text.slice(0, 300)}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/** Sign in with the same Shifa account (Supabase Auth email/password). */
export async function signIn(
  email: string,
  password: string,
): Promise<{ access_token: string; user_id: string; email: string }> {
  const { url, anonKey } = getSupabaseConfig();
  if (!anonKey) throw new Error("Add the Supabase public anon/publishable key in Server connection before signing in.");
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    user: { id: string; email: string };
  };
  return {
    access_token: data.access_token,
    user_id: data.user.id,
    email: data.user.email,
  };
}

export interface PharmacyTeamMember {
  user_id: string;
  membership_role: "owner" | "staff";
  created_at?: string;
  profiles?: { display_name: string | null; email: string | null } | null;
}

export interface RemoteShift {
  id: string;
  employee_user_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  profiles?: { display_name: string | null; email: string | null } | null;
}

export async function pharmacyTeamAction<T>(
  token: string,
  input: Record<string, unknown>,
): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  const res = await fetch(`${url}/functions/v1/pharmacy-team`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await res.json().catch(() => ({})) as { error?: string } & T;
  if (!res.ok) throw new Error(payload.error ?? `Team request failed (${res.status}).`);
  return payload;
}

/** Sign up a new account (returns a session when email confirmation is off). */
export async function signUp(
  email: string,
  password: string,
): Promise<{ access_token: string; user_id: string; email: string }> {
  const { url, anonKey } = getSupabaseConfig();
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Signup ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    user: { id: string; email: string };
  };
  return {
    access_token: data.access_token,
    user_id: data.user.id,
    email: data.user.email,
  };
}

export interface ProductSubmission {
  canonical_name: string;
  brand_name?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  barcode?: string | null;
  prescription_classification: string;
  image_url?: string | null;
}

/** Submit a new product as 'pending' for admin verification. */
export async function insertProduct(
  token: string,
  userId: string,
  payload: ProductSubmission,
): Promise<{ id: string }> {
  const rows = await postgrest<{ id: string }[]>(`products?select=id`, {
    token,
    method: "POST",
    body: {
      canonical_name: payload.canonical_name,
      submitted_by: userId,
      brand_name: payload.brand_name ?? null,
      strength: payload.strength ?? null,
      dosage_form: payload.dosage_form ?? null,
      barcode: payload.barcode ?? null,
      image_url: payload.image_url ?? null,
      prescription_classification: payload.prescription_classification,
      verification_status: "pending",
      is_demo: false,
    },
  });
  return rows[0];
}

/** Upload an image to the product-images bucket; returns the public URL. */
export async function uploadProductImage(
  token: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  const { url, anonKey } = getSupabaseConfig();
  const encoded = encodeURIComponent(filename);
  const res = await fetch(
    `${url}/storage/v1/object/product-images/${encoded}`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: new Uint8Array(buffer),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload ${res.status}: ${text.slice(0, 300)}`);
  }
  return `${url}/storage/v1/object/public/product-images/${encoded}`;
}

/**
 * Optional automatic product-image lookup. Without a licensed drug-image API
 * (or a configured search provider) this returns null and the caller falls
 * back to manual attach. Set PRODUCT_IMAGE_LOOKUP_URL to a template containing
 * {q}, e.g. "https://api.example.com/images?query={q}".
 */
export async function lookupProductImage(name: string): Promise<string | null> {
  const { anonKey } = getSupabaseConfig();
  const template = process.env.PRODUCT_IMAGE_LOOKUP_URL;
  if (!template) return null;
  try {
    const res = await fetch(template.replace("{q}", encodeURIComponent(name)), {
      headers: { apikey: anonKey },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      image_url?: string;
      thumbnail?: string;
    };
    return data.image_url ?? data.thumbnail ?? null;
  } catch {
    return null;
  }
}

/** Change the signed-in user's password (Supabase Auth). */
export async function changePassword(
  token: string,
  newPassword: string,
): Promise<void> {
  const { url, anonKey } = getSupabaseConfig();
  const res = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Change password ${res.status}: ${text.slice(0, 200)}`);
  }
}
