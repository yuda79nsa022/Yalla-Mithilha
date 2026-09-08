import {
  awardRound,
  charadesForPlayer,
  currentTeamIndex,
  draftCharades,
  isCharadesComplete,
  makeCharadesId,
  skipRound,
  unlockCharades,
  type CharadesTitle,
} from '../src/engine/charades';

const titles: CharadesTitle[] = Array.from({ length: 10 }, (_, i) => ({
  id: `t${i}`,
  text: `Title ${i}`,
  deckNameAr: 'مجموعة',
  deckNameEn: 'Deck',
}));

describe('draftCharades', () => {
  it('starts locked, with no titles and zero scores', () => {
    const state = draftCharades('Falcons', 'Hawks');
    expect(state.lock).toBe('locked');
    expect(state.titles).toEqual([]);
    expect(state.scores).toEqual([0, 0]);
    expect(state.index).toBe(0);
  });

  it('generates a unique id by default, but accepts an explicit one', () => {
    const a = draftCharades('A', 'B');
    const b = draftCharades('A', 'B');
    expect(a.id).not.toBe(b.id);

    const explicit = draftCharades('A', 'B', 'fixed-id');
    expect(explicit.id).toBe('fixed-id');
  });
});

describe('makeCharadesId', () => {
  it('produces unique ids', () => {
    expect(makeCharadesId()).not.toBe(makeCharadesId());
  });
});

describe('unlockCharades', () => {
  it('deals the given titles and flips the lock', () => {
    const drafted = draftCharades('A', 'B');
    const unlocked = unlockCharades(drafted, titles, 'player-1');
    expect(unlocked.lock).toBe('unlocked');
    expect(unlocked.titles).toEqual(titles);
  });

  it('stamps the paying player onto the game, even over an unclaimed guest draft', () => {
    const guestDraft = draftCharades('A', 'B');
    expect(guestDraft.playerId).toBeNull();
    const unlocked = unlockCharades(guestDraft, titles, 'player-1');
    expect(unlocked.playerId).toBe('player-1');
  });
});

describe('charadesForPlayer', () => {
  it('returns null for no saved game', () => {
    expect(charadesForPlayer(null, 'player-1')).toBeNull();
  });

  it('lets anyone resume an unclaimed guest draft, guest or signed in', () => {
    const draft = draftCharades('A', 'B');
    expect(charadesForPlayer(draft, null)).toBe(draft);
    expect(charadesForPlayer(draft, 'player-1')).toBe(draft);
  });

  it('never hands an unlocked (paid) game to a different player, or to a guest', () => {
    const unlocked = unlockCharades(draftCharades('A', 'B'), titles, 'player-1');
    expect(charadesForPlayer(unlocked, 'player-1')).toBe(unlocked);
    expect(charadesForPlayer(unlocked, 'player-2')).toBeNull();
    expect(charadesForPlayer(unlocked, null)).toBeNull();
  });

  it('never hands a draft already tied to one signed-in player to a different one', () => {
    const claimedDraft = draftCharades('A', 'B', undefined, 'player-1');
    expect(charadesForPlayer(claimedDraft, 'player-1')).toBe(claimedDraft);
    expect(charadesForPlayer(claimedDraft, 'player-2')).toBeNull();
    expect(charadesForPlayer(claimedDraft, null)).toBeNull();
  });
});

describe('currentTeamIndex', () => {
  it('alternates strictly, team A first', () => {
    let state = unlockCharades(draftCharades('A', 'B'), titles, 'player-1');
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(currentTeamIndex(state));
      state = skipRound(state);
    }
    expect(seen).toEqual([0, 1, 0, 1]);
  });
});

describe('awardRound / skipRound', () => {
  it('awarding increments the given team score and advances the round', () => {
    const state = unlockCharades(draftCharades('A', 'B'), titles, 'player-1');
    const next = awardRound(state, 0);
    expect(next.scores).toEqual([1, 0]);
    expect(next.index).toBe(1);
  });

  it('skipping advances the round without changing any score', () => {
    const state = unlockCharades(draftCharades('A', 'B'), titles, 'player-1');
    const next = skipRound(state);
    expect(next.scores).toEqual([0, 0]);
    expect(next.index).toBe(1);
  });

  it('never mutates the input state', () => {
    const state = unlockCharades(draftCharades('A', 'B'), titles, 'player-1');
    const frozen = JSON.stringify(state);
    awardRound(state, 1);
    skipRound(state);
    expect(JSON.stringify(state)).toBe(frozen);
  });
});

describe('isCharadesComplete', () => {
  it('is false while locked, even with no titles', () => {
    expect(isCharadesComplete(draftCharades('A', 'B'))).toBe(false);
  });

  it('is false while rounds remain', () => {
    const state = unlockCharades(draftCharades('A', 'B'), titles, 'player-1');
    expect(isCharadesComplete(state)).toBe(false);
  });

  it('is true once every title has been played', () => {
    let state = unlockCharades(draftCharades('A', 'B'), titles, 'player-1');
    for (let i = 0; i < titles.length; i++) state = skipRound(state);
    expect(isCharadesComplete(state)).toBe(true);
  });

  it('handles a deck dealt with fewer than the usual title count', () => {
    let state = unlockCharades(draftCharades('A', 'B'), titles.slice(0, 3), 'player-1');
    expect(isCharadesComplete(state)).toBe(false);
    state = skipRound(skipRound(skipRound(state)));
    expect(isCharadesComplete(state)).toBe(true);
  });
});
