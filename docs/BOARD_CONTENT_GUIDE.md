# Board content authoring guide

Companion to `CONTENT_GUIDE.md`, for the SeenJeem-style board mode. Everything
players read there comes from `src/content/board/categories/`.

## Where categories live

One file per category in `src/content/board/categories/`, each exporting a
single `CategoryDeck`. Add the export to `BOARD_CATALOGUE` in
`src/content/board/index.ts`. That is the only wiring step.

## The shape of a category

```ts
export const HISTORY: CategoryDeck = {
  id: 'history',           // never reuse an id for a different category
  nameAr: 'تاريخ',
  nameEn: 'History',
  tier: 'free',             // free | paid, feeds the entitlement layer
  level: 'family',          // the LOWEST audience this suits
  region: 'gulf',           // kw | gulf | egypt | global
  tiles: [
    {
      id: 'history-1',      // `${categoryId}-${1..6}`, never reused
      index: 0,             // 0-5, ordered by point value
      points: 100,
      mediaType: 'text',
      promptAr: '...',
      promptEn: '...',
      answerAr: '...',
      answerEn: '...',
    },
    // ...exactly six tiles, points 100/200/300/400/500/600
  ],
};
```

`level` and `region` use the exact same convention as `Prompt` in
`CONTENT_GUIDE.md`: `level` is not "who this is for", it is "the youngest
room this is safe in", and `region` says where the reference is targeted —
`kw` for something a Kuwaiti-only crowd would get, `gulf` for GCC-wide,
`global` for anyone.

Every tile needs a stable `id`, for the same reasons `Prompt.id` exists:
reporting a bad question, avoiding accidental duplicates, and letting content
be versioned without breaking a saved-in-progress board.

## Writing a tile

A tile is a fact-and-answer pair, not a mini-game prompt — the discipline is
different:

- **One unambiguous answer.** If a reasonable player could argue for two
  different answers, rewrite the question until only one holds. Trivia lives
  or dies on this.
- **Points encode difficulty.** 100 is something most of the table already
  knows; 600 should make people think. Do not put an easy fact on a 600 tile
  or a genuinely obscure one on a 100.
- **Write Arabic first**, same rule as the mini-games: Gulf phrasing that
  reads naturally out loud, understandable across the GCC. `شنو` and `منو`
  are fine; neighbourhood-specific slang is not.
- **English carries the idea, not a literal translation.** Localise the
  reference where it helps.
- **Verify the fact.** A wrong trivia answer is worse than a bland one — it
  breaks the table's trust in every other tile on the board. If a fact is
  genuinely contested (a record that keeps changing, a disputed date), do not
  use it.
- **Short question, short answer.** Read aloud at a glance, same as a
  mini-game card.

## What never ships

Same bar as `CONTENT_GUIDE.md`: no bullying, racism, sectarianism, mockery of
any nationality, body shaming, disability jokes, explicit sexual content, or
sensitive political or religious material — at any level. Trivia adds two of
its own:

- No living private individual as an answer.
- No question whose only correct answer is currently disputed or likely to
  change (an ongoing record, an active controversy). Facts that were once
  true and now are not (a former record holder, an old capital) are fine —
  write the question so the "when" is part of it.

## Checking your work

```bash
npm test
```

`validateBoardCatalogue()` fails the build on: a category without exactly six
tiles, a tile id that is not `${categoryId}-${index+1}`, duplicate tile ids
across the whole catalogue, points that are not exactly `[100,200,300,400,500,600]`
in order, an empty Arabic or English field on any prompt or answer, and a
duplicate category id.

## A future dashboard

Same shape as the mini-game content: `BOARD_CATALOGUE` is a plain array with
a stable shape. An admin tool would export exactly this structure, drop it
into `categories/`, and add one import. Nothing downstream reads catalogue
content any other way.
