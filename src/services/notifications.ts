import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailChannel } from "@/lib/notifications";
import type { Notification } from "@/types";

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  /** Optional email address to also deliver to (in-app is always created). */
  email?: string | null;
}

/** Create an in-app notification for a user (and optionally email it). */
export async function notifyUser(input: NotifyInput): Promise<Notification | null> {
  const admin = createAdminClient();

  // In-app notification is the primary, always-on channel.
  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: input.userId,
      notification_type: input.type,
      title: input.title,
      body: input.body,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[notifications] failed to create in-app notification", error.message);
  }

  // Optional email via the configured channel (degrades to a log line).
  if (input.email) {
    try {
      const channel = getEmailChannel();
      await channel.send({
        to: input.email,
        subject: input.title,
        html: `<p>${escapeHtml(input.body)}</p>`,
        text: input.body,
      });
    } catch (err) {
      console.error("[notifications] email delivery failed", err);
    }
  }

  return (data as Notification | null) ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
