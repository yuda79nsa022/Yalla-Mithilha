/**
 * Bootstraps a player account with a starting wallet balance, so testing
 * "a player who already has N games left" doesn't require N manual top-ups
 * through the checkout flow by hand first. Real players only ever get
 * credits by paying — this shortcut exists for this script alone.
 *
 *   npm run create-test-player -- --username=tester --password=testPass123 --credits=3
 *
 * Re-running with the same username tops up an existing account instead of
 * failing, so it's safe to run again to add more credits later.
 */
import './loadEnv';
import { createPlayer, creditBalance, DuplicatePlayerUsernameError, getPlayerByUsernameWithHash, grantCredits } from './db';
import { hashPassword } from './auth';
import { parseRegisterPlayerBody, ValidationError } from './validate';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-zA-Z0-9_-]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const credits = Number(args.credits ?? '3');
  if (!Number.isInteger(credits) || credits < 0) {
    console.error('Error: --credits must be a non-negative integer');
    process.exitCode = 1;
    return;
  }

  try {
    const { username, password } = parseRegisterPlayerBody(args);
    const existing = getPlayerByUsernameWithHash(username);

    const player = existing ?? createPlayer({ username, passwordHash: await hashPassword(password) });
    if (!existing) console.log(`Created player "${player.username}" (id ${player.id}).`);
    else console.log(`Player "${player.username}" already exists (id ${player.id}) — topping up.`);

    if (credits > 0) grantCredits(player.id, credits);
    console.log(`Wallet balance for "${player.username}": ${creditBalance(player.id)} game(s).`);
  } catch (err) {
    if (err instanceof ValidationError || err instanceof DuplicatePlayerUsernameError) {
      console.error(`Error: ${err.message}`);
      console.error(
        'Usage: npm run create-test-player -- --username=<name> --password=<at least 8 chars> [--credits=<n>]'
      );
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

void main();
