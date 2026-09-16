/**
 * What the rest of the app knows about delivering a password-reset code.
 * The forgot-password flow (`src/routes/playerAuth.ts`) is written against
 * this interface only — never against a specific email/SMS SDK — so
 * swapping `ConsoleResetCodeProvider` for a real `SesResetCodeProvider` (or
 * an SMS-based one) later is an isolated change, same reasoning as
 * `PaymentProvider` in `src/payments/provider.ts`.
 *
 * A real provider would additionally need its own credentials (an API key
 * env var, following the same pattern as `SESSION_SECRET`), and should
 * throw if delivery fails so the route never tells a player a code was sent
 * when it wasn't.
 */
export interface ResetCodeProvider {
  readonly name: string;
  sendResetCode(input: { to: string; username: string; code: string }): Promise<void>;
}

/**
 * Stands in for a real email (or SMS) provider until one is wired up.
 * Logs the code to the server's own console instead of delivering it
 * anywhere — enough to exercise the whole request/confirm flow in dev, but
 * not a real delivery channel, so this must never run in production.
 */
export class ConsoleResetCodeProvider implements ResetCodeProvider {
  readonly name = 'console';

  async sendResetCode(input: { to: string; username: string; code: string }): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      `[password-reset] code for "${input.username}" <${input.to}>: ${input.code} (expires in 10 minutes)`
    );
  }
}

export const resetCodeProvider: ResetCodeProvider = new ConsoleResetCodeProvider();
