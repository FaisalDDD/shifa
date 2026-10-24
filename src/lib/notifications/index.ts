import "server-only";

/**
 * Extensible notification system.
 *
 * Email is delivered through a provider adapter and only activates when
 * EMAIL_PROVIDER_API_KEY is configured. When it is not configured, we log a
 * warning and continue — the app must never crash over a missing optional
 * notification credential.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailChannel {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

const warned = new Set<string>();

function warnOnce(key: string, message: string) {
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(message);
  }
}

/** Writes email to the log when no real provider is configured. */
class LoggingEmailChannel implements EmailChannel {
  readonly name = "logging";
  async send(message: EmailMessage): Promise<void> {
    warnOnce(
      "email-unconfigured",
      "[notifications] EMAIL_PROVIDER_API_KEY is not configured — " +
        `email to ${message.to} was NOT sent. Subject: "${message.subject}". ` +
        "Set EMAIL_PROVIDER_API_KEY to enable real delivery.",
    );
  }
}

/** Resend (https://resend.com) transactional email via its REST API. */
class ResendEmailChannel implements EmailChannel {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Email provider returned ${res.status}: ${body.slice(0, 200)}`);
    }
  }
}

export function getEmailChannel(): EmailChannel {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  if (!apiKey) return new LoggingEmailChannel();

  const provider = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();
  const from = process.env.EMAIL_FROM ?? "Shifa <no-reply@shifa.example>";

  if (provider === "resend") {
    return new ResendEmailChannel(apiKey, from);
  }
  // Unknown provider: fall back to logging rather than crash.
  warnOnce(
    "email-unknown-provider",
    `[notifications] Unknown EMAIL_PROVIDER "${provider}" — falling back to logging.`,
  );
  return new LoggingEmailChannel();
}
