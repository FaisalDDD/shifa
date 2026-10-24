import type { Pharmacy } from "@/types";

/** No optimistic success: callers update visible persisted data only after this resolves. */
export async function savePortalChange(kind: "profile" | "availability", body: unknown): Promise<Pharmacy> {
  const response = await fetch(`/api/pharmacy/${kind}`, {
    method: kind === "profile" ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok || !json.ok || !json.data || typeof json.data.id !== "string") {
    throw new Error("The change could not be saved.");
  }
  return json.data as Pharmacy;
}
