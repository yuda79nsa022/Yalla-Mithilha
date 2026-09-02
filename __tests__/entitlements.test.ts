import { MemoryStore } from '../src/engine/persistence';
import {
  boardCredits,
  FREE_PACKS,
  grantCredits,
  grantPack,
  ownedPacks,
  spendCredit,
} from '../src/services/entitlements';

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

describe('boardCredits', () => {
  it('starts at zero', async () => {
    const store = new MemoryStore();
    expect(await boardCredits(store)).toBe(0);
  });

  it('grants add to the balance, including bundle purchases', async () => {
    const store = new MemoryStore();
    await grantCredits(store, 2); // "2 games" bundle
    expect(await boardCredits(store)).toBe(2);
    await grantCredits(store, 1);
    expect(await boardCredits(store)).toBe(3);
  });

  it('spendCredit decrements the balance by one', async () => {
    const store = new MemoryStore();
    await grantCredits(store, 2);
    const remaining = await spendCredit(store);
    expect(remaining).toBe(1);
    expect(await boardCredits(store)).toBe(1);
  });

  it('spendCredit refuses and changes nothing when the balance is empty', async () => {
    const store = new MemoryStore();
    const result = await spendCredit(store);
    expect(result).toBeNull();
    expect(await boardCredits(store)).toBe(0);
  });
});
