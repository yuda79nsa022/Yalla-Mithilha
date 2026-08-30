import type {
  ContentLevel,
  MiniGameConfig,
  MiniGameId,
  RoomId,
  SessionLength,
} from './types';

/**
 * The whole session is driven by this table. Adding a mini-game means adding a
 * row here plus a renderer — the engine itself needs no changes.
 */
export const MINI_GAMES: Record<MiniGameId, MiniGameConfig> = {
  act: {
    id: 'act',
    roundSeconds: 60,
    cardsPerRound: 6,
    pointsPerCorrect: 1,
    skipLimit: 2,
    eligibleRooms: 'all',
    eligibleLevels: 'all',
    mode: 'any',
    finalMultiplier: 2,
    secret: true,
    weight: 3,
    supportsTilt: true,
    color: 'act',
  },
  taboo: {
    id: 'taboo',
    roundSeconds: 60,
    cardsPerRound: 6,
    pointsPerCorrect: 1,
    skipLimit: 2,
    eligibleRooms: 'all',
    eligibleLevels: 'all',
    mode: 'any',
    finalMultiplier: 2,
    secret: true,
    weight: 3,
    supportsTilt: false,
    color: 'taboo',
  },
  who: {
    id: 'who',
    roundSeconds: 30,
    cardsPerRound: 1,
    pointsPerCorrect: 1,
    skipLimit: 1,
    eligibleRooms: ['friends', 'family', 'diwaniya', 'kuwait', 'couples', 'kids', 'mixed'],
    eligibleLevels: 'all',
    mode: 'any',
    finalMultiplier: 1,
    // Everyone reads it together — no pass-the-phone screen.
    secret: false,
    weight: 2,
    supportsTilt: false,
    color: 'who',
  },
  imitate: {
    id: 'imitate',
    roundSeconds: 45,
    cardsPerRound: 3,
    pointsPerCorrect: 1,
    skipLimit: 1,
    eligibleRooms: 'all',
    eligibleLevels: 'all',
    mode: 'any',
    finalMultiplier: 2,
    secret: true,
    weight: 2,
    supportsTilt: false,
    color: 'imitate',
  },
  lips: {
    id: 'lips',
    roundSeconds: 45,
    cardsPerRound: 3,
    pointsPerCorrect: 1,
    skipLimit: 1,
    eligibleRooms: 'all',
    eligibleLevels: 'all',
    mode: 'any',
    finalMultiplier: 2,
    secret: true,
    weight: 1,
    supportsTilt: false,
    color: 'lips',
  },
  sound: {
    id: 'sound',
    roundSeconds: 45,
    cardsPerRound: 4,
    pointsPerCorrect: 1,
    skipLimit: 1,
    eligibleRooms: 'all',
    eligibleLevels: 'all',
    mode: 'any',
    finalMultiplier: 2,
    secret: true,
    weight: 2,
    supportsTilt: false,
    color: 'sound',
  },
  final: {
    id: 'final',
    roundSeconds: 45,
    cardsPerRound: 1,
    pointsPerCorrect: 1,
    skipLimit: 0,
    eligibleRooms: 'all',
    eligibleLevels: 'all',
    mode: 'any',
    finalMultiplier: 2,
    secret: true,
    weight: 0, // never scheduled by weight — always appended at the end
    supportsTilt: false,
    color: 'final',
  },
};

export const ALL_MINI_GAMES: MiniGameId[] = Object.keys(MINI_GAMES) as MiniGameId[];

/** Mini-games the scheduler may pick from for the body of a session. */
export const ROTATABLE_MINI_GAMES: MiniGameId[] = ALL_MINI_GAMES.filter(
  (id) => MINI_GAMES[id].weight > 0
);

export const ROOMS: RoomId[] = [
  'friends',
  'family',
  'diwaniya',
  'kuwait',
  'ramadan',
  'couples',
  'kids',
  'mixed',
];

export const CONTENT_LEVELS: ContentLevel[] = ['kids', 'family', 'friends', 'adults'];

/** Target minutes per session length. */
export const LENGTH_TARGET_MINUTES: Record<SessionLength, number> = {
  quick: 10,
  standard: 20,
  long: 30,
};

/** Seconds of pass-the-phone + briefing + results between rounds. */
export const ROUND_OVERHEAD_SECONDS = 25;

/** How many prompt ids are remembered across sessions, per mini-game. */
export const RECENT_MEMORY_PER_GAME = 40;

/**
 * A tie can survive sudden death. After this many extra turns per team the
 * game is declared a shared win rather than keeping a tired room hostage.
 */
export const MAX_SUDDEN_DEATH_TURNS = 3;

export const STATE_VERSION = 1;
