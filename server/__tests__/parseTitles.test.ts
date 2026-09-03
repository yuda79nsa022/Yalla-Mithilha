import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import { cleanTitles, parseDocxTitles, parseXlsxTitles } from '../src/import/parseTitles';

describe('cleanTitles', () => {
  it('drops pure-number lines (row numbers, years)', () => {
    expect(cleanTitles(['1', '2026', 'Real Title'])).toEqual(['Real Title']);
  });

  it('drops a value repeated more than three times as a label, not a title', () => {
    const input = ['تلفزيوني', 'تلفزيوني', 'تلفزيوني', 'تلفزيوني', 'Unique One', 'Unique Two'];
    expect(cleanTitles(input)).toEqual(['Unique One', 'Unique Two']);
  });

  it('keeps a value repeated three times or fewer', () => {
    const input = ['Common', 'Common', 'Common', 'Unique'];
    expect(cleanTitles(input)).toEqual(['Common', 'Unique']);
  });

  it('drops entries shorter than two characters and dedupes', () => {
    expect(cleanTitles(['a', 'Real Title', 'Real Title', ' '])).toEqual(['Real Title']);
  });

  it('preserves first-seen order', () => {
    expect(cleanTitles(['Zebra', 'Apple', 'Mango'])).toEqual(['Zebra', 'Apple', 'Mango']);
  });
});

/** Builds a minimal .docx-shaped zip: only word/document.xml, which is all the parser reads. */
function buildDocxFixture(bodyXml: string): Buffer {
  const zip = new AdmZip();
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`;
  zip.addFile('word/document.xml', Buffer.from(xml, 'utf-8'));
  return zip.toBuffer();
}

function cell(text: string): string {
  return `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
}

describe('parseDocxTitles', () => {
  it('takes the longest non-numeric cell per table row as the title', () => {
    const table = `<w:tbl>
      <w:tr>${cell('الرقم')}${cell('اسم المسرحية')}${cell('السنة')}</w:tr>
      <w:tr>${cell('1')}${cell('مدرسة المشاغبين')}${cell('1973')}</w:tr>
      <w:tr>${cell('2')}${cell('هاملت')}${cell('2010')}</w:tr>
    </w:tbl>`;
    const buffer = buildDocxFixture(table);
    expect(parseDocxTitles(buffer)).toEqual(['اسم المسرحية', 'مدرسة المشاغبين', 'هاملت']);
  });

  it('falls back to a flat paragraph stream when there is no table', () => {
    const body = `<w:p><w:r><w:t>Some Title</w:t></w:r></w:p><w:p><w:r><w:t>2026</w:t></w:r></w:p>`;
    const buffer = buildDocxFixture(body);
    expect(parseDocxTitles(buffer)).toEqual(['Some Title']);
  });

  it('returns an empty list for a docx with no word/document.xml entry', () => {
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('not a docx'));
    expect(parseDocxTitles(zip.toBuffer())).toEqual([]);
  });
});

describe('parseXlsxTitles', () => {
  it('takes the longest non-numeric cell per row as the title', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.addRow(['الرقم', 'اسم المسلسل', 'السنة']);
    sheet.addRow([1, 'رأفت الهجان', 1988]);
    sheet.addRow([2, 'ليالي الحلمية', 1987]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const titles = await parseXlsxTitles(buffer);
    expect(titles).toEqual(['اسم المسلسل', 'رأفت الهجان', 'ليالي الحلمية']);
  });

  it('returns an empty list for an empty workbook', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Empty');
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    expect(await parseXlsxTitles(buffer)).toEqual([]);
  });
});
