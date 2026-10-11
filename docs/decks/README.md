# New decks

Seven import-ready title lists. Decks 01–04 are built from what players in
Kuwait are actually watching now: the last five Ramadan seasons
(2022–2026), Shahid, Netflix, Yango Play, OSN+ and the 51 Kuwait app, plus
recent cinema box-office hits. They answer the feedback that the original
decks felt hard and old. Decks 05–07 are everyday words anyone can act out
(a window, stairs, a pilot, a clock), in Arabic, in English, and a bonus
Kuwaiti-dialect set.

| File | Suggested deck name | Language | Titles |
| --- | --- | --- | --- |
| `01-gulf-series-recent.xlsx` | مسلسلات خليجية – الموسم الجديد | ar | 103 |
| `02-egyptian-series-recent.xlsx` | مسلسلات مصرية – الموسم الجديد | ar | 146 |
| `03-arabic-films-recent.xlsx` | أفلام عربية – السينما والمنصات | ar | 105 |
| `04-global-streaming-hits.xlsx` | Streaming Hits | en | 233 |
| `05-arabic-everyday-words.xlsx` | كلمات من حياتنا | ar | 502 |
| `06-english-everyday-words.xlsx` | Everyday Words | en | 613 |
| `07-kuwaiti-words.xlsx` | كلمات كويتية | ar | 119 |

`REVIEW-all-decks.xlsx` holds the same titles with three extra columns
(type, origin, where people saw it) for a human pass before import. It is
for reading, not importing.

## Importing

In the admin panel, Decks tab: create the deck with the name and language
above, then upload the matching `.xlsx`. Each import file is a single
column with no header row, so every row becomes a title. Titles are
deliberately kept to six words or fewer and franchise titles carry no part
number (الكبير أوي, المداح, شباب البومب) so they stay actable.

## Difficulty

Set the deck's default level when creating it: 05–07 (everyday words) are
**easy**, 01–04 (recent streaming titles) are **medium**, and the four
original 500-title decks are **hard**. Any title over four words is bumped
one level up automatically. To override a single title, add a column with
`easy`, `medium` or `hard` (or `سهل`/`متوسط`/`صعب`) next to it in the import
file, or as a third column in a picture manifest.

## Naming

Do not name a deck after a platform (Netflix, Shahid, Yango Play) or use a
platform logo as its cover. Apple rejects apps that use third-party
trademarks in names or artwork, and the streaming companies enforce it.
The titles themselves are fine to use.

## Regenerating

The lists live in `build_decks.py`. Edit the tuples there and run:

```bash
pip install openpyxl
python3 docs/decks/build_decks.py
```
