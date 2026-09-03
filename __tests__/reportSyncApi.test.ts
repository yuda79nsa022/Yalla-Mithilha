import { ReportSyncError, syncReports } from '../src/services/reportSyncApi';
import type { PromptReport } from '../src/engine/types';

function mockFetch(impl: typeof fetch) {
  (global as unknown as { fetch: typeof fetch }).fetch = impl;
}

afterEach(() => {
  jest.restoreAllMocks();
});

function makeReport(id: string): PromptReport {
  return { id, promptId: 'act-1', reason: 'unclear', createdAt: Date.now(), lang: 'en' };
}

describe('syncReports', () => {
  it('does nothing for an empty queue', async () => {
    const fetchSpy = jest.fn();
    mockFetch(fetchSpy as unknown as typeof fetch);
    await syncReports([], 'http://example.test');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts the batch to /reports', async () => {
    let body: any;
    mockFetch(async (_url, init: any) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({ received: 1 }), { status: 201 });
    });
    await syncReports([makeReport('rep-1')], 'http://example.test');
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]).toMatchObject({ id: 'rep-1', promptId: 'act-1', reason: 'unclear' });
    expect(typeof body.reports[0].appVersion).toBe('string');
  });

  it('throws a ReportSyncError on a non-OK status', async () => {
    mockFetch(async () => new Response('nope', { status: 500 }));
    await expect(syncReports([makeReport('rep-1')], 'http://example.test')).rejects.toThrow(ReportSyncError);
  });

  it('wraps a network failure in a ReportSyncError', async () => {
    mockFetch(async () => {
      throw new Error('offline');
    });
    await expect(syncReports([makeReport('rep-1')], 'http://example.test')).rejects.toThrow(ReportSyncError);
  });

  it('splits a large queue into multiple batches', async () => {
    const bodies: any[] = [];
    mockFetch(async (_url, init: any) => {
      bodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ received: 1 }), { status: 201 });
    });
    const reports = Array.from({ length: 60 }, (_, i) => makeReport(`rep-${i}`));
    await syncReports(reports, 'http://example.test');
    expect(bodies).toHaveLength(2);
    expect(bodies[0].reports).toHaveLength(50);
    expect(bodies[1].reports).toHaveLength(10);
  });
});
