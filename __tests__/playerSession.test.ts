import { MemoryStore, clearPlayerSession, loadPlayerSession, savePlayerSession } from '../src/engine/persistence';

describe('player session persistence', () => {
  it('returns null when nothing is stored', async () => {
    const store = new MemoryStore();
    expect(await loadPlayerSession(store)).toBeNull();
  });

  it('round-trips a saved session', async () => {
    const store = new MemoryStore();
    await savePlayerSession(store, { id: '1', username: 'jane', token: 'tok' });
    expect(await loadPlayerSession(store)).toEqual({ id: '1', username: 'jane', token: 'tok' });
  });

  it('clears a saved session', async () => {
    const store = new MemoryStore();
    await savePlayerSession(store, { id: '1', username: 'jane', token: 'tok' });
    await clearPlayerSession(store);
    expect(await loadPlayerSession(store)).toBeNull();
  });

  it('returns null for corrupt or malformed data instead of throwing', async () => {
    const store = new MemoryStore();
    await store.setItem('ym:playerSession:v1', 'not json');
    expect(await loadPlayerSession(store)).toBeNull();

    await store.setItem('ym:playerSession:v1', JSON.stringify({ id: '1' }));
    expect(await loadPlayerSession(store)).toBeNull();
  });
});
