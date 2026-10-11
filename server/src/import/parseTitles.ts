import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import type { Difficulty } from '../types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

/**
 * Matches a `<w:t>` text run and nothing else. The naive `<w:t[^>]*>` also
 * matches `<w:tc>` and `<w:tr>` — "w:t" is a literal prefix of both — which
 * silently swallows everything up to the next real `</w:t>` as bogus
 * "content". Requiring whitespace or `>` immediately after "w:t" rules that
 * out.
 */
const TEXT_RUN = /<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/g;

const REPEAT_THRESHOLD = 3;

/** One parsed row: the title, plus a per-title level override when the row carried a recognised difficulty cell. */
export interface ParsedTitle {
  text: string;
  difficulty?: Difficulty;
}

/**
 * The words an admin may put in a difficulty column, in either language,
 * any case. A cell that is exactly one of these is never a title — it's the
 * row's level — so `pickTitleRows` pulls it out before guessing which cell
 * is the title.
 */
const DIFFICULTY_WORDS: Record<string, Difficulty> = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
  'سهل': 'easy',
  'سهلة': 'easy',
  'متوسط': 'medium',
  'متوسطة': 'medium',
  'صعب': 'hard',
  'صعبة': 'hard',
};

export function parseDifficultyCell(cell: string): Difficulty | undefined {
  return DIFFICULTY_WORDS[cell.trim().toLowerCase()];
}

/**
 * Cleans a flat list with no row/column structure to lean on (a paragraph
 * stream, PDF text lines): drops pure numbers and anything shorter than two
 * characters, drops a value repeated more than `REPEAT_THRESHOLD` times (a
 * recurring label or header/footer, not a unique title), then dedupes.
 * `pickTitlesFromRows` below does its own, order-sensitive version of this
 * for actual tables — see the comment there for why the order matters.
 */
export function cleanTitles(raw: string[]): string[] {
  const trimmed = raw.map((s) => s.trim()).filter((s) => s.length >= 2 && !/^\d+$/.test(s));

  const counts = new Map<string, number>();
  for (const s of trimmed) counts.set(s, (counts.get(s) ?? 0) + 1);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of trimmed) {
    if ((counts.get(s) ?? 0) > REPEAT_THRESHOLD) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Every list seen in practice is a "number / title / [country] / year / [type]"
 * table where the title is the only field that's genuinely free text and
 * unique per row — numbers and years are pure digits, and category/type/
 * country labels repeat constantly. The frequency filter has to run BEFORE
 * picking a title per row, not after: a long, oft-repeated label like
 * "عام / غير محدد*" can be longer than a short real title like "لو", so
 * picking "the longest cell" first and filtering repeats after would pick
 * the label and then correctly discard it — silently losing that row's
 * real title. This is deliberately generic rather than tuned to one file's
 * exact columns, since content ships from wherever an admin's source
 * happens to be. It only needs to be good enough to save typing: a stray
 * label that slips through sits in a `needsContent` slot until an admin
 * notices, and can never reach a real game. One known artifact: a header
 * row's own labels (e.g. "اسم المسرحية") usually appear exactly once and
 * survive as a stray "title" — harmless, an admin recognizes and discards
 * it immediately, not worth a fragile heuristic to detect header rows.
 */
function pickTitleRows(rows: string[][]): ParsedTitle[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const cell of row) {
      const c = cell.trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }

  const picked: ParsedTitle[] = [];
  for (const row of rows) {
    const cells = row.map((c) => c.trim());
    // A difficulty word is this row's level, never its title — and it's
    // taken out before the frequency filter rather than after, since a
    // column of "easy"/"hard" repeats far past REPEAT_THRESHOLD anyway.
    const difficulty = cells.map(parseDifficultyCell).find((d) => d !== undefined);
    const candidates = cells
      .filter((c) => parseDifficultyCell(c) === undefined)
      .filter((c) => c.length >= 2 && !/^\d+$/.test(c) && (counts.get(c) ?? 0) <= REPEAT_THRESHOLD)
      .sort((a, b) => b.length - a.length);
    if (candidates[0]) picked.push(difficulty ? { text: candidates[0], difficulty } : { text: candidates[0] });
  }
  // Same dedupe/cleanup as a flat list, keeping each surviving title's own override.
  const byText = new Map(picked.map((p) => [p.text, p]));
  return cleanTitles(picked.map((p) => p.text)).map((text) => byText.get(text)!);
}

function pickTitlesFromRows(rows: string[][]): string[] {
  return pickTitleRows(rows).map((p) => p.text);
}

/** Reads `word/document.xml` out of a .docx and pulls text grouped by table row when present. */
export function parseDocxTitles(buffer: Buffer): ParsedTitle[] {
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return [];
  const xml = entry.getData().toString('utf-8');

  const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g);
  if (tables && tables.length) {
    const rows: string[][] = [];
    for (const table of tables) {
      const rowMatches = table.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? [];
      for (const row of rowMatches) {
        const cells = row.match(/<w:tc[ >][\s\S]*?<\/w:tc>/g) ?? [];
        rows.push(cells.map((cell) => [...cell.matchAll(TEXT_RUN)].map((m) => m[1]).join('')));
      }
    }
    return pickTitleRows(rows);
  }

  // No table markup found — fall back to a flat paragraph stream, one cell per line.
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  const lines = paragraphs.map((p) => [...p.matchAll(TEXT_RUN)].map((m) => m[1]).join(''));
  return cleanTitles(lines).map((text) => ({ text }));
}

export async function parseXlsxTitles(buffer: Buffer): Promise<ParsedTitle[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cellTexts: string[] = [];
    row.eachCell((cell) => {
      const text = String(cell.value ?? '').trim();
      if (text) cellTexts.push(text);
    });
    rows.push(cellTexts);
  });
  return pickTitleRows(rows);
}

export async function parsePdfTitles(buffer: Buffer): Promise<ParsedTitle[]> {
  const { text } = await pdfParse(buffer);
  const lines = text.split('\n');
  return cleanTitles(lines).map((t) => ({ text: t }));
}

export interface TitleImageManifestRow {
  text: string;
  imageFilename: string;
  /** From an optional third column — see `parseDifficultyCell`. */
  difficulty?: Difficulty;
}

/**
 * The manifest for "import with images": an .xlsx with exactly two columns
 * — title text, then the filename (inside the accompanying zip) of that
 * title's picture. Deliberately a fixed two-column contract rather than
 * `pickTitlesFromRows`' column-guessing heuristic: pairing a title with the
 * wrong image is a much worse mistake than losing one row to a bad guess,
 * so this format doesn't guess at all. Row 1 is always treated as a header
 * and skipped; a row missing either cell is dropped rather than guessed at.
 */
export async function parseTitleImageManifestXlsx(buffer: Buffer): Promise<TitleImageManifestRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: TitleImageManifestRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const text = String(row.getCell(1).value ?? '').trim();
    const imageFilename = String(row.getCell(2).value ?? '').trim();
    const difficulty = parseDifficultyCell(String(row.getCell(3).value ?? ''));
    if (text && imageFilename) rows.push(difficulty ? { text, imageFilename, difficulty } : { text, imageFilename });
  });
  return rows;
}
