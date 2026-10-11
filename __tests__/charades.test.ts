import {
  ASSIST_EXTRA_SECONDS,
  DIFFICULTY_POINTS,
  STEAL_POINTS,
  adjustScore,
  assistAvailable,
  awardRound,
  canPickDifficulty,
  charadesForPlayer,
  currentTeamIndex,
  draftCharades,
  isCharadesComplete,
  isDoubleRound,
  makeCharadesId,
  migrateCharades,
  pickDifficulty,
  pointsForGuess,
  revealLetters,
  skipRound,
  stackSizes,
  stealRound,
  unlockCharades,
  consumeAssist,
  type CharadesDeal,
  type CharadesTitle,
  type Difficulty,
} from '../src/engine/charades';

function title(i: number, difficulty: Difficulty): CharadesTitle {
  return { id: `${difficulty}-${i}`, text: `${difficulty} title ${i}`, deckNameAr: 'مجموعة', deckNameEn: 'Deck', difficulty };
}

function deal(easy: number, medium: number, hard: number, rounds = 10): CharadesDeal {
  return {
    rounds,
    stacks: {
      easy: Array.from({ length: easy }, (_, i) => title(i, 'easy')),
      medium: Array.from({ length: medium }, (_, i) => title(i, 'medium')),
      hard: Array.from({ length: hard }, (_, i) => title(i, 'hard')),
    },
  };
}

const fullDeal = deal(10, 10, 10);

function unlocked(d: CharadesDeal = fullDeal) {
  return unlockCharades(draftCharades('A', 'B'), d, 'player-1');
}

/** Plays one round end to end: pick a level, resolve it. */
function playRound(state: ReturnType<typeof unlocked>, difficulty: Difficulty = 'medium') {
  return skipRound(pickDifficulty(state, difficulty));
}

describe('draftCharades', () => {
  it('starts locked, with empty stacks, no title in play and zero scores', () => {
    const state = draftCharades('Falcons', 'Hawks');
    expect(state.lock).toBe('locked');
    expect(state.stacks).toEqual({ easy: [], medium: [], hard: [] });
    expect(state.rounds).toBe(0);
    expect(state.current).toBeNull();
    expect(state.scores).toEqual([0, 0]);
    expect(state.index).toBe(0);
    expect(state.assistsUsed).toEqual([[], []]);
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
  it('deals the stacks and round count and flips the lock', () => {
    const state = unlocked();
    expect(state.lock).toBe('unlocked');
    expect(state.rounds).toBe(10);
    expect(stackSizes(state)).toEqual({ easy: 10, medium: 10, hard: 10 });
  });

  it('stamps the paying player onto the game, even over an unclaimed guest draft', () => {
    const guestDraft = draftCharades('A', 'B');
    expect(guestDraft.playerId).toBeNull();
    expect(unlockCharades(guestDraft, fullDeal, 'player-1').playerId).toBe('player-1');
  });

  it('copies the stacks so later picks never mutate the deal it was given', () => {
    const d = deal(2, 2, 2);
    const state = pickDifficulty(unlocked(d), 'easy');
    expect(d.stacks.easy).toHaveLength(2);
    expect(state.stacks.easy).toHaveLength(1);
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
    const state = unlocked();
    expect(charadesForPlayer(state, 'player-1')).toBe(state);
    expect(charadesForPlayer(state, 'player-2')).toBeNull();
    expect(charadesForPlayer(state, null)).toBeNull();
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
    let state = unlocked();
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(currentTeamIndex(state));
      state = playRound(state);
    }
    expect(seen).toEqual([0, 1, 0, 1]);
  });
});

describe('pickDifficulty', () => {
  it('takes the top title of the chosen stack into play', () => {
    const state = pickDifficulty(unlocked(), 'hard');
    expect(state.current).toEqual(title(0, 'hard'));
    expect(stackSizes(state)).toEqual({ easy: 10, medium: 10, hard: 9 });
    expect(state.index).toBe(0);
  });

  it('refuses an empty level, and a second pick while a title is in play', () => {
    const noHard = unlocked(deal(3, 3, 0));
    expect(canPickDifficulty(noHard, 'hard')).toBe(false);
    expect(pickDifficulty(noHard, 'hard')).toBe(noHard);

    const picked = pickDifficulty(noHard, 'easy');
    expect(canPickDifficulty(picked, 'medium')).toBe(false);
    expect(pickDifficulty(picked, 'medium')).toBe(picked);
  });

  it('is not allowed before the game is paid for', () => {
    expect(canPickDifficulty(draftCharades('A', 'B'), 'easy')).toBe(false);
  });

  it('never mutates the input state', () => {
    const state = unlocked();
    const frozen = JSON.stringify(state);
    pickDifficulty(state, 'easy');
    expect(JSON.stringify(state)).toBe(frozen);
  });
});

describe('points', () => {
  it('pays each level its own base, plus the speed bonus inside the first minute', () => {
    const state = unlocked();
    expect(pointsForGuess(state, 'easy', 90)).toBe(DIFFICULTY_POINTS.easy);
    expect(pointsForGuess(state, 'medium', 90)).toBe(DIFFICULTY_POINTS.medium);
    expect(pointsForGuess(state, 'hard', 90)).toBe(DIFFICULTY_POINTS.hard);
    expect(pointsForGuess(state, 'hard', 60)).toBe(DIFFICULTY_POINTS.hard + 1);
    expect(pointsForGuess(state, 'easy', 0)).toBe(2);
  });

  it('doubles everything on each team’s final round, and only then', () => {
    let state = unlocked(deal(10, 10, 10, 4));
    expect(isDoubleRound(state)).toBe(false);
    state = playRound(state);
    expect(isDoubleRound(state)).toBe(false);
    state = playRound(state);
    expect(isDoubleRound(state)).toBe(true); // round 3 of 4: team A's last
    expect(pointsForGuess(state, 'hard', 30)).toBe((DIFFICULTY_POINTS.hard + 1) * 2);
    state = playRound(state);
    expect(isDoubleRound(state)).toBe(true); // round 4 of 4: team B's last
    expect(currentTeamIndex(state)).toBe(1);
  });

  it('never marks a one-round game as double', () => {
    expect(isDoubleRound(unlocked(deal(1, 0, 0, 1)))).toBe(false);
  });
});

describe('awardRound / skipRound / stealRound', () => {
  it('awarding adds the points to the given team, clears the title in play and advances the round', () => {
    const state = pickDifficulty(unlocked(), 'medium');
    const next = awardRound(state, 0, 3);
    expect(next.scores).toEqual([3, 0]);
    expect(next.index).toBe(1);
    expect(next.current).toBeNull();
  });

  it('skipping advances the round without changing any score', () => {
    const next = skipRound(pickDifficulty(unlocked(), 'easy'));
    expect(next.scores).toEqual([0, 0]);
    expect(next.index).toBe(1);
    expect(next.current).toBeNull();
  });

  it('a steal pays the other team the steal points, never the acting team', () => {
    const state = pickDifficulty(unlocked(), 'hard');
    expect(currentTeamIndex(state)).toBe(0);
    const next = stealRound(state);
    expect(next.scores).toEqual([0, STEAL_POINTS]);
    expect(next.index).toBe(1);

    const theirTurn = pickDifficulty(next, 'hard');
    expect(currentTeamIndex(theirTurn)).toBe(1);
    expect(stealRound(theirTurn).scores).toEqual([STEAL_POINTS, STEAL_POINTS]);
  });

  it('never mutates the input state', () => {
    const state = pickDifficulty(unlocked(), 'easy');
    const frozen = JSON.stringify(state);
    awardRound(state, 1);
    skipRound(state);
    stealRound(state);
    expect(JSON.stringify(state)).toBe(frozen);
  });
});

describe('assists', () => {
  it('each team has one of each, independently', () => {
    let state = unlocked();
    expect(assistAvailable(state, 0, 'firstLetters')).toBe(true);
    state = consumeAssist(state, 0, 'firstLetters');
    expect(assistAvailable(state, 0, 'firstLetters')).toBe(false);
    expect(assistAvailable(state, 1, 'firstLetters')).toBe(true);
    expect(assistAvailable(state, 0, 'lastLetters')).toBe(true);
    expect(assistAvailable(state, 0, 'extraTime')).toBe(true);
  });

  it('refuses to spend an assist twice', () => {
    const once = consumeAssist(unlocked(), 1, 'extraTime');
    expect(consumeAssist(once, 1, 'extraTime')).toBe(once);
    expect(once.assistsUsed).toEqual([[], ['extraTime']]);
  });

  it('adds a sensible amount of time', () => {
    expect(ASSIST_EXTRA_SECONDS).toBe(30);
  });
});

describe('revealLetters', () => {
  it('keeps one letter per word and hides the rest', () => {
    expect(revealLetters('بيت الحمولة', 'first')).toBe('ب__  ا______');
    expect(revealLetters('بيت الحمولة', 'last')).toBe('__ت  ______ة');
    expect(revealLetters('Squid Game', 'first')).toBe('S____  G___');
    expect(revealLetters('Squid Game', 'last')).toBe('____d  ___e');
  });

  it('leaves a one-letter word alone and ignores extra spacing', () => {
    expect(revealLetters('  a  big   one ', 'first')).toBe('a  b__  o__');
  });
});

describe('adjustScore', () => {
  it('adds or removes points without advancing the round', () => {
    const state = unlocked();
    const up = adjustScore(state, 0, 1);
    expect(up.scores).toEqual([1, 0]);
    expect(up.index).toBe(0);

    const down = adjustScore(up, 0, -1);
    expect(down.scores).toEqual([0, 0]);
  });

  it('never lets a score go negative', () => {
    expect(adjustScore(unlocked(), 0, -1).scores).toEqual([0, 0]);
  });

  it('never mutates the input state', () => {
    const state = unlocked();
    const frozen = JSON.stringify(state);
    adjustScore(state, 0, 1);
    expect(JSON.stringify(state)).toBe(frozen);
  });
});

describe('isCharadesComplete', () => {
  it('is false while locked, even with no titles', () => {
    expect(isCharadesComplete(draftCharades('A', 'B'))).toBe(false);
  });

  it('is false while rounds remain, and while a title is in play', () => {
    const state = unlocked();
    expect(isCharadesComplete(state)).toBe(false);
    expect(isCharadesComplete(pickDifficulty(state, 'easy'))).toBe(false);
  });

  it('is true once every round has been played', () => {
    let state = unlocked();
    for (let i = 0; i < state.rounds; i++) state = playRound(state);
    expect(isCharadesComplete(state)).toBe(true);
  });

  it('ends early once every stack has run dry', () => {
    let state = unlocked(deal(1, 1, 1, 10));
    state = playRound(state, 'easy');
    state = playRound(state, 'medium');
    expect(isCharadesComplete(state)).toBe(false);
    state = playRound(state, 'hard');
    expect(isCharadesComplete(state)).toBe(true);
    expect(state.index).toBe(3);
  });
});

describe('migrateCharades', () => {
  it('returns a game already in the stacked shape untouched', () => {
    const state = unlocked();
    expect(migrateCharades(state)).toBe(state);
  });

  it('turns a pre-levels save into one medium stack of the unplayed titles', () => {
    const old = {
      id: 'old',
      teamAName: 'A',
      teamBName: 'B',
      titles: [
        { id: 't1', text: 'One', deckNameAr: 'م', deckNameEn: 'D' },
        { id: 't2', text: 'Two', deckNameAr: 'م', deckNameEn: 'D' },
        { id: 't3', text: 'Three', deckNameAr: 'م', deckNameEn: 'D' },
      ],
      index: 1,
      scores: [2, 0],
      lock: 'unlocked',
      playerId: 'player-1',
      deckIds: ['d'],
    };
    const migrated = migrateCharades(old)!;
    expect(migrated.rounds).toBe(3);
    expect(migrated.index).toBe(1);
    expect(migrated.scores).toEqual([2, 0]);
    expect(migrated.current).toBeNull();
    expect(migrated.assistsUsed).toEqual([[], []]);
    expect(migrated.stacks.easy).toEqual([]);
    expect(migrated.stacks.hard).toEqual([]);
    expect(migrated.stacks.medium.map((t) => t.text)).toEqual(['Two', 'Three']);
    expect(migrated.stacks.medium[0].difficulty).toBe('medium');
    expect('titles' in migrated).toBe(false);
    expect(isCharadesComplete(migrated)).toBe(false);
  });

  it('rejects anything without an id', () => {
    expect(migrateCharades(null)).toBeNull();
    expect(migrateCharades({ titles: [] })).toBeNull();
    expect(migrateCharades('nope')).toBeNull();
  });
});
