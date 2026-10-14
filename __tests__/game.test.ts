import { draftCharades, unlockCharades, type CharadesTitle as ClassicTitle } from '../src/engine/charades';
import { charadesForPlayer, isCharadesComplete } from '../src/engine/game';
import {
  draftModifiedCharades,
  pickDifficulty,
  skipRound as skipModifiedRound,
  unlockModifiedCharades,
  type CharadesDeal,
} from '../src/engine/modifiedCharades';

const classicTitles: ClassicTitle[] = Array.from({ length: 3 }, (_, i) => ({
  id: `t${i}`,
  text: `Title ${i}`,
  deckNameAr: 'مجموعة',
  deckNameEn: 'Deck',
}));

const modifiedDeal: CharadesDeal = {
  rounds: 1,
  stacks: {
    easy: [{ id: 'e0', text: 'Easy one', deckNameAr: 'م', deckNameEn: 'D', difficulty: 'easy' }],
    medium: [],
    hard: [],
  },
};

describe('isCharadesComplete', () => {
  it('dispatches to the classic engine for a classic-mode game', () => {
    const unlocked = unlockCharades(draftCharades('A', 'B'), classicTitles, 'player-1');
    expect(isCharadesComplete(unlocked)).toBe(false);
  });

  it('dispatches to the modified engine for a modified-mode game', () => {
    const unlocked = unlockModifiedCharades(draftModifiedCharades('A', 'B'), modifiedDeal, 'player-1');
    expect(isCharadesComplete(unlocked)).toBe(false);
    const played = skipModifiedRound(pickDifficulty(unlocked, 'easy'));
    expect(isCharadesComplete(played)).toBe(true);
  });
});

describe('charadesForPlayer', () => {
  it('works the same regardless of which mode the saved game is', () => {
    const classicUnlocked = unlockCharades(draftCharades('A', 'B'), classicTitles, 'player-1');
    expect(charadesForPlayer(classicUnlocked, 'player-1')).toBe(classicUnlocked);
    expect(charadesForPlayer(classicUnlocked, 'player-2')).toBeNull();

    const modifiedUnlocked = unlockModifiedCharades(draftModifiedCharades('A', 'B'), modifiedDeal, 'player-1');
    expect(charadesForPlayer(modifiedUnlocked, 'player-1')).toBe(modifiedUnlocked);
    expect(charadesForPlayer(modifiedUnlocked, 'player-2')).toBeNull();
  });

  it('lets anyone resume an unclaimed guest draft of either mode', () => {
    expect(charadesForPlayer(draftCharades('A', 'B'), 'player-1')).not.toBeNull();
    expect(charadesForPlayer(draftModifiedCharades('A', 'B'), 'player-1')).not.toBeNull();
  });

  it('returns null for no saved game', () => {
    expect(charadesForPlayer(null, 'player-1')).toBeNull();
  });
});
