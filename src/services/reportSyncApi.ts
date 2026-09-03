import { APP_VERSION, CATALOGUE_API_URL } from '../config';
import type { PromptReport } from '../engine/types';

export class ReportSyncError extends Error {}

/** The server enforces this too — chunking here keeps one oversized local queue from failing outright. */
const MAX_PER_BATCH = 50;

async function postBatch(reports: PromptReport[], baseUrl: string, timeoutMs: number): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reports: reports.map((r) => ({
          id: r.id,
          promptId: r.promptId,
          reason: r.reason,
          lang: r.lang,
          createdAt: r.createdAt,
          appVersion: APP_VERSION,
        })),
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new ReportSyncError(`sync failed with status ${res.status}`);
  } catch (err) {
    if (err instanceof ReportSyncError) throw err;
    throw new ReportSyncError('could not reach the server');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Syncs the app's offline report queue. Never requires a player session —
 * reporting a card never needs an account, online or offline. Throws on any
 * failure (network, bad status) without syncing anything from the failed
 * chunk; the caller decides what stays queued for next time.
 */
export async function syncReports(
  reports: PromptReport[],
  baseUrl: string = CATALOGUE_API_URL,
  timeoutMs = 8000
): Promise<void> {
  if (!reports.length) return;
  for (let i = 0; i < reports.length; i += MAX_PER_BATCH) {
    await postBatch(reports.slice(i, i + MAX_PER_BATCH), baseUrl, timeoutMs);
  }
}
