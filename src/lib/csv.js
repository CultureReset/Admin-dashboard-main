/**
 * CSV parsing.
 *
 * A correct quoted-field parser: values containing commas, newlines, or
 * escaped double-quotes round-trip properly. The legacy dashboard had three
 * separate import flows sharing one parser; this is that parser, with the
 * row-assembly logic alongside it.
 */

/** Split one CSV line into fields, honouring quotes and "" escapes. */
export function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1; // Skip the escaped quote.
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  out.push(current);
  return out.map((value) => value.trim());
}

/**
 * Parse a whole CSV document into { headers, rows }.
 *
 * Handles quoted fields that span multiple physical lines, which a naive
 * split('\n') would tear in half.
 */
export function parseCsv(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
  const lines = [];
  let buffer = '';
  let quoteCount = 0;

  for (const line of normalized.split('\n')) {
    buffer = buffer ? `${buffer}\n${line}` : line;
    quoteCount += (line.match(/"/g) || []).length;
    // An even number of quotes means the record is complete.
    if (quoteCount % 2 === 0) {
      if (buffer.trim()) lines.push(buffer);
      buffer = '';
      quoteCount = 0;
    }
  }
  if (buffer.trim()) lines.push(buffer);

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^﻿/, ''));
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });

  return { headers, rows };
}

/** Drop empty strings so blanks are not written over existing values. */
export function compactRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== '' && value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

/** Coerce the common CSV spellings of a boolean. */
export function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'x'].includes(text);
}

/** Read a File as text. */
export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read the file'));
    reader.readAsText(file);
  });
}
