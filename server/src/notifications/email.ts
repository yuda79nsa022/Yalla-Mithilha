/**
 * Outgoing email, behind one small interface — same seam as
 * `PaymentProvider` (payments/provider.ts) and `ResetCodeProvider`, so the
 * code that decides *when* to email someone never depends on *how* it's
 * delivered.
 *
 * Picked from the environment:
 *   EMAIL_PROVIDER=resend  needs RESEND_API_KEY and EMAIL_FROM — sends for real
 *   anything else (unset)  logs to the server console instead — development only
 *
 * Resend is called over its plain HTTPS API with `fetch`, so sending mail
 * adds no dependency to the server.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  readonly name: string;
  /** Throws when the message could not be handed to the provider. */
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';

  async send(message: EmailMessage): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    // eslint-disable-next-line no-console
    console.log(`[email] to <${message.to}>: ${message.subject}\n${message.text}`);
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  constructor(private readonly config: { apiKey: string; from: string; timeoutMs?: number }) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.config.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
    });
    // Never echo the response body: it can carry the request back, address included.
    if (!res.ok) throw new Error(`email provider answered ${res.status}`);
  }
}

export function emailProviderFromEnv(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  if (env.EMAIL_PROVIDER === 'resend') {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      throw new Error('EMAIL_PROVIDER=resend needs both RESEND_API_KEY and EMAIL_FROM to be set');
    }
    return new ResendEmailProvider({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  }
  return new ConsoleEmailProvider();
}

let current: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!current) current = emailProviderFromEnv();
  return current;
}

/** Tests swap in a capturing provider; `null` goes back to reading the environment. */
export function setEmailProviderForTests(provider: EmailProvider | null): void {
  current = provider;
}

/** For values interpolated into an HTML email body. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
