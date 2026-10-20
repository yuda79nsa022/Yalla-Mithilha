import { claimLowBalanceNotice, releaseLowBalanceNotice } from '../db';
import { escapeHtml, getEmailProvider, type EmailMessage } from './email';

/**
 * The "you're running low" email, in both languages (the server doesn't
 * know which one the player reads). The buy link opens the app's own
 * Buy-more screen, which starts a MyFatoorah checkout once the player is
 * signed in — the link itself carries no token or payment id, so a
 * forwarded email can't spend or charge anything.
 */
export function lowBalanceEmail(input: { to: string; username: string; gamesLeft: number; buyUrl: string | null }): EmailMessage {
  const { to, username, gamesLeft, buyUrl } = input;
  const subject = 'Bas Bedoon Kalam — you are running low on games / رصيد ألعابك قارب يخلص';
  const en = `Hi ${username}, you have ${gamesLeft} game${gamesLeft === 1 ? '' : 's'} left in your Bas Bedoon Kalam wallet.`;
  const ar = `هلا ${username}، باقي لك ${gamesLeft} من الألعاب في محفظة بس بدون كلام.`;
  const enCta = 'Buy more games';
  const arCta = 'اشترِ ألعاب زيادة';
  const text = buyUrl ? `${en}\n${enCta}: ${buyUrl}\n\n${ar}\n${arCta}: ${buyUrl}` : `${en}\n\n${ar}`;
  const link = (label: string) =>
    buyUrl ? `<p><a href="${escapeHtml(buyUrl)}" style="background:#8038D1;color:#fff;padding:12px 20px;text-decoration:none;font-weight:bold">${label}</a></p>` : '';
  const html = `<div style="font-family:sans-serif"><p>${escapeHtml(en)}</p>${link(enCta)}<hr/><div dir="rtl"><p>${escapeHtml(ar)}</p>${link(arCta)}</div></div>`;
  return { to, subject, text, html };
}

function buyUrlFromEnv(): string | null {
  const base = process.env.PUBLIC_BASE_URL?.trim();
  return base ? `${base.replace(/\/+$/, '')}/buy` : null;
}

/**
 * Emails a player once when their games left drop below the threshold —
 * at most once per dip: the notice is claimed atomically before sending
 * (two games started at once can't both email), and only re-armed once a
 * top-up lifts them back up (see `releaseLowBalanceNotice` in db.ts). A
 * failed send gives the claim back so the next game tries again. Never
 * throws: a mail outage must not fail the game that triggered it.
 */
export async function notifyLowBalance(playerId: string): Promise<void> {
  const notice = claimLowBalanceNotice(playerId);
  if (!notice) return;
  try {
    await getEmailProvider().send(lowBalanceEmail({ ...notice, buyUrl: buyUrlFromEnv() }));
  } catch (err) {
    releaseLowBalanceNotice(playerId);
    // eslint-disable-next-line no-console
    console.error('low-balance email failed', err instanceof Error ? err.message : err);
  }
}
