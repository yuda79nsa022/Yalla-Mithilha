import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-reports-${Date.now()}-${Math.random()}.sqlite`);

import { listContentReports, resetDbForTests, setReportStatusForPrompt, submitContentReports } from '../src/db';

beforeEach(() => resetDbForTests());

function makeReport(overrides: Partial<Parameters<typeof submitContentReports>[0][0]> = {}) {
  return {
    id: 'rep-1',
    promptId: 'act-42',
    reason: 'unclear' as const,
    lang: 'en',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('submitContentReports', () => {
  it('stores a report as open', () => {
    submitContentReports([makeReport()]);
    const [report] = listContentReports();
    expect(report).toMatchObject({ id: 'rep-1', promptId: 'act-42', reason: 'unclear', status: 'open' });
  });

  it('is idempotent per report id — a retried sync never creates a duplicate row', () => {
    submitContentReports([makeReport()]);
    const result = submitContentReports([makeReport()]);
    expect(result.received).toBe(0); // already received, nothing new
    expect(listContentReports()).toHaveLength(1);
  });

  it('reports how many of a batch were newly received', () => {
    submitContentReports([makeReport({ id: 'rep-1' })]);
    const result = submitContentReports([makeReport({ id: 'rep-1' }), makeReport({ id: 'rep-2' })]);
    expect(result.received).toBe(1);
    expect(listContentReports()).toHaveLength(2);
  });

  it('never stores any player identity — only what content moderation needs', () => {
    submitContentReports([makeReport({ appVersion: '0.1.0' })]);
    const [report] = listContentReports();
    expect(Object.keys(report).sort()).toEqual(
      ['appVersion', 'createdAt', 'id', 'lang', 'promptId', 'reason', 'receivedAt', 'status'].sort()
    );
  });
});

describe('listContentReports', () => {
  it('orders most-recent first', () => {
    submitContentReports([makeReport({ id: 'rep-1', createdAt: 1 })]);
    submitContentReports([makeReport({ id: 'rep-2', createdAt: 2 })]);
    expect(listContentReports().map((r) => r.id)).toEqual(['rep-2', 'rep-1']);
  });
});

describe('setReportStatusForPrompt', () => {
  it('resolves every open report for a card at once', () => {
    submitContentReports([
      makeReport({ id: 'rep-1', promptId: 'act-42' }),
      makeReport({ id: 'rep-2', promptId: 'act-42', reason: 'duplicate' }),
      makeReport({ id: 'rep-3', promptId: 'other-card' }),
    ]);
    const result = setReportStatusForPrompt('act-42', 'resolved');
    expect(result.updated).toBe(2);
    const byId = Object.fromEntries(listContentReports().map((r) => [r.id, r.status]));
    expect(byId).toEqual({ 'rep-1': 'resolved', 'rep-2': 'resolved', 'rep-3': 'open' });
  });

  it('never re-flips a report that is already resolved or dismissed', () => {
    submitContentReports([makeReport({ id: 'rep-1' })]);
    setReportStatusForPrompt('act-42', 'dismissed');
    const result = setReportStatusForPrompt('act-42', 'resolved');
    expect(result.updated).toBe(0);
    expect(listContentReports()[0].status).toBe('dismissed');
  });
});
