/**
 * Bootstraps the first admin account (or adds another one from the CLI).
 * There is no API route for this without already being logged in — someone
 * has to exist first. Run from a machine with direct access to the server:
 *
 *   npm run create-admin -- --username=jane --password=supersecret123
 */
import './loadEnv';
import { createAdminUser, DuplicateUsernameError } from './db';
import { hashPassword } from './auth';
import { parseCreateAdminUserBody, ValidationError } from './validate';

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
  try {
    const { username, password } = parseCreateAdminUserBody(args);
    const passwordHash = await hashPassword(password);
    const user = createAdminUser({ username, passwordHash });
    console.log(`Created admin "${user.username}" (id ${user.id}).`);
  } catch (err) {
    if (err instanceof ValidationError || err instanceof DuplicateUsernameError) {
      console.error(`Error: ${err.message}`);
      console.error('Usage: npm run create-admin -- --username=<name> --password=<at least 8 chars>');
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

void main();
