import {
  ASSIST_EXTRA_SECONDS,
  DIFFICULTY_POINTS,
  MAX_STEALS_PER_GAME,
  STEAL_POINTS,
  adjustScore,
  assistAvailable,
  awardRound,
  canPickDifficulty,
  consumeAssist,
  currentTeamIndex,
  draftModifiedCharades,
  isModifiedCharadesComplete,
  pickDifficulty,
  pointsForGuess,
  revealLetters,
  skipRound,
  stackSizes,
  canSteal,
  stealRound,
  stealsLeft,
  unlockModifiedCharades,
  type CharadesDeal,
  type CharadesTitle,
} from '../src/engine/modifiedCharades';

function makeTitle(id: string, difficulty: 'easy' | 'medium' | 'hard'): CharadesTitle {
  return { id, text: `Title ${id}`, deckNameAr: 'مجموعة', deckNameEn: 'Deck', difficulty };
}

function dealOf(rounds: number): CharadesDeal {
  return {
    rounds,
    stacks: {
      easy: Array.from({ length: Math.ceil(rounds / 3) }, (_, i) => makeTitle(`e${i}`, 'easy')),
      medium: Array.from({ length: Math.ceil(rounds / 3) }, (_, i) => makeTitle(`m${i}`, 'medium')),
      hard: Array.from({ length: Math.ceil(rounds / 3) }, (_, i) => makeTitle(`h${i}`, 'hard')),
    },
  };
}

describe('draftModifiedCharades', () => {
  it('starts locked, with empty stacks, zero rounds and no assists used', () => {
    const state = draftModifiedCharades('Falcons', 'Hawks');
    expect(state.mode).toBe('modified');
    expect(state.lock).toBe('locked');
    expect(state.rounds).toBe(0);
    expect(state.current).toBeNull();
    expect(state.assistsUsed).toEqual([[], []]);
  });
});

describe('unlockModifiedCharades', () => {
  it('deals the three stacks and flips the lock', () => {
    const deal = dealOf(6);
    const unlocked = unlockModifiedCharades(draftModifiedCharades('A', 'B'), deal, 'player-1');
    expect(unlocked.lock).toBe('unlocked');
    expect(unlocked.rounds).toBe(6);
    expect(unlocked.stacks).toEqual(deal.stacks);
    expect(unlocked.playerId).toBe('player-1');
  });
});

describe('currentTeamIndex', () => {
  it('alternates strictly, team A first', () => {
    let state = unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(6), 'player-1');
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(currentTeamIndex(state));
      state = pickDifficulty(state, 'easy');
      state = skipRound(state);
    }
    expect(seen).toEqual([0, 1, 0, 1]);
  });
});

describe('canPickDifficulty / pickDifficulty', () => {
  it('only allows picking a level that still has titles, with nothing already in play', () => {
    const state = unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(3), 'player-1');
    expect(canPickDifficulty(state, 'easy')).toBe(true);

    const picked = pickDifficulty(state, 'easy');
    expect(picked.current?.difficulty).toBe('easy');
    expect(picked.stacks.easy).toHaveLength(0);
    // A title is already in play — no further pick allowed until it resolves.
    expect(canPickDifficulty(picked, 'medium')).toBe(false);
  });

  it('is a no-op when the chosen stack is empty', () => {
    const state = unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(1), 'player-1');
    // Drain the easy stack (dealOf(1) deals exactly one easy title).
    const afterPick = pickDifficulty(state, 'easy');
    expect(canPickDifficulty(afterPick, 'easy')).toBe(false);
    expect(pickDifficulty(afterPick, 'easy')).toBe(afterPick);
  });
});

describe('stackSizes', () => {
  it('reflects each level independently', () => {
    const state = unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(6), 'player-1');
    expect(stackSizes(state)).toEqual({ easy: 2, medium: 2, hard: 2 });
  });
});

describe('pointsForGuess', () => {
  it('awards easy 2, medium 3 and hard 5 points', () => {
    expect(pointsForGuess('easy')).toBe(2);
    expect(pointsForGuess('medium')).toBe(3);
    expect(pointsForGuess('hard')).toBe(5);
  });

});

describe('awardRound / skipRound', () => {
  it('awarding increments the given team score, advances the round and clears the title in play', () => {
    const state = pickDifficulty(unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(6), 'player-1'), 'easy');
    const next = awardRound(state, 0, 5);
    expect(next.scores).toEqual([5, 0]);
    expect(next.index).toBe(1);
    expect(next.current).toBeNull();
  });

  it('skipping advances the round without changing any score', () => {
    const state = pickDifficulty(unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(6), 'player-1'), 'easy');
    const next = skipRound(state);
    expect(next.scores).toEqual([0, 0]);
    expect(next.current).toBeNull();
  });
});

describe('stealRound', () => {
  it('gives the other team STEAL_POINTS, never the acting team', () => {
    const state = pickDifficulty(unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(6), 'player-1'), 'easy');
    expect(currentTeamIndex(state)).toBe(0);
    const stolen = stealRound(state);
    expect(stolen.scores).toEqual([0, STEAL_POINTS]);
  });

  it('allows at most MAX_STEALS_PER_GAME steals in the whole game, both teams together', () => {
    let state = unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(20), 'player-1');
    for (let i = 0; i < MAX_STEALS_PER_GAME; i++) {
      state = pickDifficulty(state, 'easy');
      expect(canSteal(state)).toBe(true);
      state = stealRound(state);
    }
    expect(state.stealsUsed).toBe(MAX_STEALS_PER_GAME);
    expect(stealsLeft(state)).toBe(0);
    // Round 1 (team A acting) went to B, round 2 (team B acting) to A.
    expect(state.scores).toEqual([STEAL_POINTS, STEAL_POINTS]);

    const third = pickDifficulty(state, 'easy');
    expect(canSteal(third)).toBe(false);
    // A stale button can't sneak a third one in: nothing changes.
    expect(stealRound(third)).toBe(third);
  });

  it('treats a game saved before the cap existed as having used none', () => {
    const { stealsUsed: _omit, ...legacy } = pickDifficulty(
      unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(6), 'player-1'),
      'easy'
    );
    expect(stealsLeft(legacy)).toBe(MAX_STEALS_PER_GAME);
    expect(stealRound(legacy).stealsUsed).toBe(1);
  });
});

describe('ending early', () => {
  it('is complete once ended for inactivity, even with a title in play', () => {
    const state = pickDifficulty(unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(6), 'player-1'), 'easy');
    expect(isModifiedCharadesComplete(state)).toBe(false);
    expect(isModifiedCharadesComplete({ ...state, endedReason: 'inactivity' })).toBe(true);
  });
});

describe('assists', () => {
  it('each team gets one of each kind per game', () => {
    const state = unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(6), 'player-1');
    expect(assistAvailable(state, 0, 'firstLetters')).toBe(true);
    const used = consumeAssist(state, 0, 'firstLetters');
    expect(assistAvailable(used, 0, 'firstLetters')).toBe(false);
    // Team B's own assist is untouched.
    expect(assistAvailable(used, 1, 'firstLetters')).toBe(true);
    // Using it again is a no-op.
    expect(consumeAssist(used, 0, 'firstLetters')).toBe(used);
  });

  it('ASSIST_EXTRA_SECONDS is a fixed, positive bonus', () => {
    expect(ASSIST_EXTRA_SECONDS).toBeGreaterThan(0);
  });
});

describe('revealLetters', () => {
  it('keeps the first letter of each word and masks the rest, word lengths unchanged', () => {
    const revealed = revealLetters('one two three', 'first');
    expect(revealed).toBe('o__  t__  t____');
  });

  it('keeps the last letter of each word and masks the rest, word lengths unchanged', () => {
    const revealed = revealLetters('one two three', 'last');
    expect(revealed).toBe('__e  __o  ____e');
  });

  it('leaves single-letter words alone', () => {
    expect(revealLetters('a bb', 'first')).toBe('a  b_');
  });
});

describe('adjustScore', () => {
  it('never lets a score go negative', () => {
    const state = unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(6), 'player-1');
    expect(adjustScore(state, 0, -1).scores).toEqual([0, 0]);
  });
});

describe('isModifiedCharadesComplete', () => {
  it('is false while locked', () => {
    expect(isModifiedCharadesComplete(draftModifiedCharades('A', 'B'))).toBe(false);
  });

  it('is true once every round has been played', () => {
    let state = unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(2), 'player-1');
    state = skipRound(pickDifficulty(state, 'easy'));
    state = skipRound(pickDifficulty(state, 'medium'));
    expect(isModifiedCharadesComplete(state)).toBe(true);
  });

  it('is true early if every stack runs dry before the round count is reached', () => {
    // One title total, but 4 rounds advertised — the game ends once the
    // single stack is drained, never waiting for a round count it can't reach.
    const deal: CharadesDeal = { rounds: 4, stacks: { easy: [makeTitle('e0', 'easy')], medium: [], hard: [] } };
    let state = unlockModifiedCharades(draftModifiedCharades('A', 'B'), deal, 'player-1');
    state = skipRound(pickDifficulty(state, 'easy'));
    expect(isModifiedCharadesComplete(state)).toBe(true);
  });

  it('is false while a title is still in play', () => {
    const state = pickDifficulty(unlockModifiedCharades(draftModifiedCharades('A', 'B'), dealOf(1), 'player-1'), 'easy');
    expect(isModifiedCharadesComplete(state)).toBe(false);
  });
});
