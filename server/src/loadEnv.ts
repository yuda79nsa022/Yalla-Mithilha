/**
 * Side-effect-only import, always the first line of every entry point
 * (index.ts, seed.ts, createAdmin.ts) — must run before ./db or ./auth are
 * imported, since those read process.env.* at module load time. Silently
 * does nothing if .env is missing (e.g. in CI, where real env vars are set
 * directly), which is dotenv's default behaviour.
 */
import dotenv from 'dotenv';

dotenv.config();
