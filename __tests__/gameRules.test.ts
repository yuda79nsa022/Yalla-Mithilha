import { awardRound, draftCharades, pointsForElapsed, unlockCharades, type CharadesTitle } from '../src/engine/charades';
import { endForInactivity, isCharadesComplete, isIdleTooLong, markActivity } from '../src/engine/game';
import { INACTIVITY_LIMIT_SECONDS, ROUND_SECONDS } from '../src/engine/rules';

const titles: CharadesTitle[] = Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, text: `Title ${i}`, deckNameAr: 'م', deckNameEn: 'D' }));
const live = () => unlockCharades(draftCharades('A', 'B', 'g1', null, ['d'], 'hard'), titles, 'p1');

describe('classic difficulty', () => {
  it('is stored on the draft, mixed by default', () => {
    expect(draftCharades('A', 'B').difficulty).toBe('mixed');
    expect(live().difficulty).toBe('hard');
  });
});

describe('pointsForElapsed', () => {
  it('is 2 in the first minute, 1 in the second, and nothing once the 2 minutes are up', () => {
    expect(pointsForElapsed(0)).toBe(2);
    expect(pointsForElapsed(59)).toBe(2);
    expect(pointsForElapsed(60)).toBe(1);
    expect(pointsForElapsed(ROUND_SECONDS - 1)).toBe(1);
    expect(pointsForElapsed(ROUND_SECONDS)).toBe(0);
  });
});

describe('ending a game for inactivity', () => {
  it('completes a live game and keeps its scores', () => {
    const state = awardRound(live(), 0, 2);
    const ended = endForInactivity(state);
    expect(ended.endedReason).toBe('inactivity');
    expect(isCharadesComplete(ended)).toBe(true);
    expect(ended.scores).toEqual([2, 0]);
  });

  it('leaves an unpaid draft or a finished game alone', () => {
    const draft = draftCharades('A', 'B');
    expect(endForInactivity(draft)).toBe(draft);
    let done = live();
    for (let i = 0; i < titles.length; i++) done = awardRound(done, 0);
    expect(endForInactivity(done)).toBe(done);
  });
});

describe('isIdleTooLong', () => {
  const limitMs = INACTIVITY_LIMIT_SECONDS * 1000;
  it('is false with no recorded activity, or within the limit', () => {
    expect(isIdleTooLong(live(), Date.now())).toBe(false);
    expect(isIdleTooLong(markActivity(live(), 1_000), 1_000 + limitMs - 1)).toBe(false);
  });

  it('is true once the limit has passed since the last activity', () => {
    expect(isIdleTooLong(markActivity(live(), 1_000), 1_000 + limitMs)).toBe(true);
  });

  it('never applies to a game that is already over', () => {
    expect(isIdleTooLong(endForInactivity(markActivity(live(), 0)), limitMs * 10)).toBe(false);
  });
});
