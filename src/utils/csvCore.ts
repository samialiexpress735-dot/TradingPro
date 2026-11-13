/**
 * Low-level CSV helpers shared by every importer.
 */

/** Thrown for files we can positively identify as unsupported (e.g. .xlsx). The message is user-facing. */
export class CsvFileError extends Error {}

/** Decode raw file bytes to text: handles UTF-8 / UTF-16 BOMs (Excel "Unicode Text") and rejects Excel workbooks. */
export function decodeCsvBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    throw new CsvFileError(
      'This looks like an Excel workbook (.xlsx), not a CSV. Open it in Excel or Google Sheets and use "Save as / Download as CSV", then upload that file.'
    );
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  return stripBom(new TextDecoder('utf-8').decode(bytes));
}

/** Read an uploaded File as CSV text (encoding aware). */
export async function readCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return decodeCsvBytes(buf);
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Pick the delimiter that splits the header area into the most columns (comma, semicolon, tab). */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const sample = text.split(/\r?\n/).slice(0, 8).join('\n');
  const count = (d: string) => {
    let n = 0;
    let inQ = false;
    for (const ch of sample) {
      if (ch === '"') inQ = !inQ;
      else if (!inQ && ch === d) n++;
    }
    return n;
  };
  const c = count(','), s = count(';'), t = count('\t');
  if (t > c && t > s) return '\t';
  if (s > c) return ';';
  return ',';
}

/**
 * RFC-4180 style parser: quoted fields may contain delimiters, escaped quotes ("") and line breaks.
 * Fully blank lines are dropped.
 */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const src = stripBom(text);
  const delim = delimiter ?? detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0].trim() === '')) rows.push(row.map((c) => c.trim()));
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      endField();
    } else if (ch === '\n') {
      endRow();
    } else if (ch === '\r') {
      if (src[i + 1] === '\n') i++;
      endRow();
    } else field += ch;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

export interface LooseNumber {
  value: number;
  /** Trailing asset/currency code, e.g. "BTC" in "0.0015BTC" (uppercased); '' when none. */
  unit: string;
}

/**
 * Parse numbers as exchanges print them: "1,234.50", "$12", "(15.2)", "-3", "1.5E-7",
 * and Binance's unit-suffixed "0.00150000BTC" / "12.5 USDT". Returns null when there is no number.
 */
export function parseLooseNumber(raw: string | number | undefined | null): LooseNumber | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? { value: raw, unit: '' } : null;
  let s = String(raw).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1).trim(); }
  s = s.replace(/^([+-]?)\s*[$€£¥]\s*/, '$1').replace(/^\+/, '');
  const m = s.match(/^(-?)\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:[eE]([+-]?\d+)(?![A-Za-z]))?\s*([A-Za-z][A-Za-z0-9._-]*)?$/);
  if (!m) return null;
  let value = parseFloat(m[2].replace(/,/g, '') + (m[3] ? `e${m[3]}` : ''));
  if (!Number.isFinite(value)) return null;
  if (m[1] === '-' || negative) value = -value;
  return { value, unit: (m[4] || '').toUpperCase() };
}
