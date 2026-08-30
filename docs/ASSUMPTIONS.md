# Assumptions and decisions

Where the brief left room, here is what was decided and why.

## Game design

**Free-for-all is modelled as one-person teams.** The brief asks for both team
mode and free-for-all. Rather than two scoring systems, FFA creates one team per
player. Turn order, the final challenge, the scoreboard and sudden death all
work unchanged. The visible consequence: in FFA every player gets their own
final challenge, so a six-player FFA session ends with six bonus rounds.

**Content level is a floor, not a category.** A card declares the youngest
audience it suits. A kids card appears in an adults session; an adults card
never appears in a kids one. The alternative — cards belonging to exactly one
level — would have meant writing the same joke four times.

**Cards per round are conservative.** Six for the sixty-second games, three to
four for the forty-five-second ones. A team rarely clears more, and reserving
more than that drains a small room's deck for no benefit.

**Sudden death is capped at three extra turns per team.** Two evenly matched
teams can tie repeatedly. After three tie-breaks the game is declared a shared
win rather than holding a tired room hostage.

**A timeout is not a skip.** When the clock runs out on a card, it is recorded
as `timeout`. It scores zero like a skip but does not consume the skip
allowance, because the performer did not choose it.

**Recycling before failing.** In a narrow room at the long session length the
deck can run dry. Rather than deal an empty round, the engine reuses the
oldest cards from earlier in the same session, never one from the previous two
rounds. Tested directly.

**Who Among Us has no pass-the-phone screen.** It is the one mini-game everyone
reads together, so the privacy gate would be noise.

## Technical

**Arabic RTL needs a relaunch.** React Native fixes layout direction before the
JS bundle draws. Switching language therefore takes effect on the next launch.
The language screen says so in plain words rather than leaving a half-mirrored
interface. Every layout uses logical properties (`textAlign: auto`, `gap`,
`borderStartWidth`) so both directions come out of the same styles.

**No i18n library.** The catalogues are typed objects with `{{name}}`
interpolation. A library would add plural rules and date formatting the app does
not use, plus a dependency that has to behave inside Hermes. Key parity between
Arabic and English is enforced by the type system and by a test.

**Storage sits behind an interface.** The engine talks to `KeyValueStore`, not
to AsyncStorage. Tests run against `MemoryStore` with the same code paths, which
is how "progress survives an app restart" is actually verified rather than
assumed.

**Session state is throttled to disk.** A round produces many state updates a
minute; writes are debounced by 400 ms.

**Seeded RNG.** Every session stores the seed that generated it, so a reported
bug can be reproduced exactly.

**Deferred: tests that mount the screens.** The interaction tests exercise the
same functions the screens call — `startRound`, `markCorrect`, `completeRound`,
`advance` — rather than rendering components. Adding
`@testing-library/react-native` and mounting the round screen is the natural
next step; the logic under test is already isolated for it.

## Content and assets

**Audio ships silent.** All five sound effects need original or licensed
assets. Placeholder beeps in a room full of people would be worse than nothing.
`src/platform/audio.ts` is the seam and `assets/sounds/README.md` is the brief
for a sound designer. Haptics *are* wired and working.

**No custom font is bundled.** Platform Arabic faces (Geeza Pro on iOS, the
Android default) render Kuwaiti text cleanly. A licensed Arabic display face
would sharpen the identity and is listed as a production task.

**No app icon or splash image.** The splash screen is drawn in code. Icons are a
design task.

**146 cards, not 120.** The brief asked for at least 120. The extra headroom
matters because the recency window is per mini-game: a thin deck means the
second session of the evening starts recycling.

## Business model

**No payment code.** `src/services/entitlements.ts` decides which pack ids the
engine may deal from, and every card currently carries `pack: 'core'`. Three
future pack ids are declared but have no content, so they are invisible. Adding
a store SDK means changing that one file.

**No account, anywhere.** Nothing in the MVP asks who the player is.

## Known limitations

- Tilt control is offered for Act It Out only. It is off by default in the sense
  that the on-screen buttons are always present and always work; the setting
  disables the sensor entirely.
- Reduce-motion is stored as a preference and respected by the current
  transitions, which are minimal. It becomes meaningful when celebratory
  animation is added.
- Prompt reports are stored locally with no export UI. Settings shows the count;
  reading them means inspecting AsyncStorage under `ym:reports:v1`.
- Sudden death always uses Act It Out. A tie-break that varied by room would be
  a nice touch and is not implemented.
