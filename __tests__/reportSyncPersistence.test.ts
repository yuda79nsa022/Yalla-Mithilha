import { MemoryStore, loadSyncedReportIds, markReportsSynced } from '../src/engine/persistence';

describe('synced report ids', () => {
  it('starts empty', async () => {
    const store = new MemoryStore();
    expect(await loadSyncedReportIds(store)).toEqual([]);
  });

  it('records ids as synced', async () => {
    const store = new MemoryStore();
    await markReportsSynced(store, ['rep-1', 'rep-2']);
    expect(await loadSyncedReportIds(store)).toEqual(['rep-1', 'rep-2']);
  });

  it('does not duplicate an id marked synced twice', async () => {
    const store = new MemoryStore();
    await markReportsSynced(store, ['rep-1']);
    await markReportsSynced(store, ['rep-1', 'rep-2']);
    expect(await loadSyncedReportIds(store)).toEqual(['rep-1', 'rep-2']);
  });
});
