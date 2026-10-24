import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditLog } from "@/types";

export interface AuditInput {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append an entry to the audit log. Uses the service-role client so writes
 * are permitted regardless of the caller's RLS scope. Never pass secrets,
 * passwords, tokens, or health-related data in `metadata`.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });
  if (error) {
    console.error("[audit] failed to write audit log", error.message);
  }
}

export async function listAuditLogs(
  limit = 100,
  offset = 0,
): Promise<AuditLog[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data as AuditLog[]) ?? [];
}
