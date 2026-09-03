import { MemoryStore } from '../src/engine/persistence';
import { FREE_PACKS, grantPack, ownedPacks } from '../src/services/entitlements';

describe('ownedPacks', () => {
  it('always includes the free packs, even with nothing stored', async () => {
    const store = new MemoryStore();
    expect(await ownedPacks(store)).toEqual(FREE_PACKS);
  });

  it('adds a purchased pack and keeps it on the next read', async () => {
    const store = new MemoryStore();
    await grantPack(store, 'nostalgia');
    expect(await ownedPacks(store)).toEqual(
      expect.arrayContaining([...FREE_PACKS, 'nostalgia'])
    );
  });
});
