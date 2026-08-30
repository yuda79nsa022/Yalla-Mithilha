# Content authoring guide

Everything the players read comes from `src/content/prompts/`. This guide is
for whoever writes the next hundred cards.

## Where cards live

| File | Mini-game | Arabic name |
| --- | --- | --- |
| `act.ts` | Act It Out | مثّلها |
| `taboo.ts` | Do Not Say It | لا تقولها |
| `who.ts` | Who Among Us | منو فينا؟ |
| `imitate.ts` | Imitate It | قلّدها |
| `lips-sound.ts` | Read My Lips, Sound Only | اقرأ شفايفي، بس صوت |
| `final.ts` | Final Challenge | التحدي الأخير |

Add the file's export to `ALL_PROMPTS` in `src/content/index.ts`. That is the
only wiring step.

## The shape of a card

```ts
{
  id: 'act-036',        // never reuse an id for different text
  game: 'act',
  ar: 'واحد يدوّر موقف سيارة في الأفنيوز',
  en: 'Someone hunting for a parking spot at The Avenues',
  rooms: ['friends', 'kuwait'],
  difficulty: 'medium', // easy | medium | hard
  level: 'family',      // the LOWEST audience this suits
  region: 'kw',         // kw | gulf | global
  enabled: true,
  pack: 'core',
}
```

`level` trips people up. It is not "who this is for", it is "the youngest room
this is safe in". A card marked `kids` will also appear in family, friends and
adults sessions. A card marked `adults` appears only in adults sessions.

`rooms` never includes `mixed` — mixed means "any room", and the validator
rejects the tag.

## Writing Arabic

Write the Arabic first and write it as speech. The test is whether a Kuwaiti
reading it out loud would change a single word.

- Gulf phrasing, understandable across the GCC. `شنو` and `منو` are fine;
  neighbourhood-specific slang is not.
- No idiom translated from English. If the English version came first, rewrite
  the Arabic from the idea, not from the sentence.
- Keep it short. A card is read at a glance while somebody is already standing
  up.
- The validator fails the build if `ar` and `en` are identical, which almost
  always means a translation was forgotten.

## Writing English

The English version carries the same *idea*, not the same words. Localise the
reference where it helps: `يبت الدقوس لو لا؟` becomes "Did you bring the
daqoos?", not a literal gloss.

## Rules per mini-game

**Act It Out** — one recognisable situation, not a noun. If it cannot be mimed
in ten seconds it is too long. Situations beat objects every time.

**Do Not Say It** — `ar` and `en` hold the target word. Three to five forbidden
words per language, and the two lists do not need to match: each one should
contain the words a describer in *that* language reaches for first. Never list
the target word itself.

**Who Among Us** — the safety bar is highest here. A card must be something a
person would happily be voted for in front of their family. No looks, money,
relationships, health, origin, religion, politics, or intelligence. Positive
cards ("who gives the best advice") are as good as teasing ones — better,
because they keep the table warm.

**Imitate It** — character types and situations only. No living public figures,
no named individuals, no accents tied to a nationality.

**Read My Lips** — under six words in both languages. Long or unusual words are
unreadable on lips.

**Sound Only** — must be reproducible with the mouth alone. No props.

**Final Challenge** — these are instructions to the table, read out loud, not
things to guess.

## What never ships

Bullying, racism, sectarianism, mockery of any nationality, body shaming,
disability jokes, explicit sexual content, and sensitive political or religious
material. Not at any content level. If a card needs a caveat, cut it.

## Checking your work

```bash
npm test
```

`validateContent()` fails the build on duplicate ids, duplicate text within a
mini-game, empty translations, a `mixed` room tag, a taboo card without three
to five forbidden words per language, and forbidden words on a non-taboo card.
The suite also asserts every room keeps enough cards to fill rounds.

Room coverage is visible in the app: the room picker shows a card count on each
room. If a room drops below about fifteen cards, sessions there start recycling
sooner than they should.

## A future dashboard

`ALL_PROMPTS` is a plain array with a stable shape. An admin tool would export
exactly this structure as JSON or a `.ts` file, drop it into `prompts/`, and add
one import. Nothing in the engine reads content any other way.
