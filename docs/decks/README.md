# Streaming-era decks

Four import-ready title lists built from what players in Kuwait are actually
watching now: the last five Ramadan seasons (2022–2026), Shahid, Netflix,
Yango Play, OSN+ and the 51 Kuwait app, plus recent cinema box-office hits.
They answer the feedback that the original decks felt hard and old.

| File | Suggested deck name | Language | Titles |
| --- | --- | --- | --- |
| `01-gulf-series-recent.xlsx` | مسلسلات خليجية – الموسم الجديد | ar | 103 |
| `02-egyptian-series-recent.xlsx` | مسلسلات مصرية – الموسم الجديد | ar | 146 |
| `03-arabic-films-recent.xlsx` | أفلام عربية – السينما والمنصات | ar | 105 |
| `04-global-streaming-hits.xlsx` | Streaming Hits | en | 233 |

`REVIEW-all-decks.xlsx` holds the same titles with three extra columns
(type, origin, where people saw it) for a human pass before import. It is
for reading, not importing.

## Importing

In the admin panel, Decks tab: create the deck with the name and language
above, then upload the matching `.xlsx`. Each import file is a single
column with no header row, so every row becomes a title. Titles are
deliberately kept to six words or fewer and franchise titles carry no part
number (الكبير أوي, المداح, شباب البومب) so they stay actable.

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
