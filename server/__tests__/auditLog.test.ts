import os from 'os';
import path from 'path';

process.env.DB_PATH = path.join(os.tmpdir(), `yalla-test-audit-${Date.now()}-${Math.random()}.sqlite`);

import { listAuditLog, recordAudit, resetDbForTests } from '../src/db';

beforeEach(() => resetDbForTests());

describe('recordAudit / listAuditLog', () => {
  it('round-trips actor, action, target and before/after snapshots', () => {
    recordAudit({
      actorId: 'admin-1',
      actorUsername: 'jane',
      action: 'category.create',
      target: 'kuwaiti-series',
      after: { id: 'kuwaiti-series', tier: 'free' },
    });

    const [entry] = listAuditLog();
    expect(entry).toMatchObject({
      actorId: 'admin-1',
      actorUsername: 'jane',
      action: 'category.create',
      target: 'kuwaiti-series',
      before: null,
      after: { id: 'kuwaiti-series', tier: 'free' },
    });
    expect(typeof entry.createdAt).toBe('number');
  });

  it('orders most-recent first', () => {
    recordAudit({ actorId: 'a', actorUsername: 'a', action: 'first', target: 'x' });
    recordAudit({ actorId: 'a', actorUsername: 'a', action: 'second', target: 'x' });
    const entries = listAuditLog();
    expect(entries.map((e) => e.action)).toEqual(['second', 'first']);
  });

  it('respects a limit', () => {
    for (let i = 0; i < 5; i++) {
      recordAudit({ actorId: 'a', actorUsername: 'a', action: `action-${i}`, target: 'x' });
    }
    expect(listAuditLog(2)).toHaveLength(2);
  });

  it('never throws, even for a caller that ignores its return value', () => {
    expect(() => recordAudit({ actorId: 'a', actorUsername: 'a', action: 'noop', target: 'x' })).not.toThrow();
  });
});
