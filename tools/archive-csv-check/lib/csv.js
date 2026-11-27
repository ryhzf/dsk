'use strict';

/**
 * Small, dependency-free CSV reader for the acceptance checker.
 *
 * Supported syntax (RFC 4180 plus common export behaviour):
 *   - optional UTF-8 BOM at the start of the input
 *   - LF, CRLF and lone CR record separators
 *   - comma-separated fields
 *   - double-quoted fields containing commas, quotes and line breaks
 *   - doubled double quotes ("") as an escaped quote
 *
 * The parser is intentionally strict: stray quotes and characters after a
 * closing quote are reported as errors instead of being silently repaired.
 */

const BOM = '\uFEFF';

class CsvParseError extends Error {
  /**
   * @param {string} message human-readable problem
   * @param {number} line 1-based line where the problem was detected
   */
  constructor(message, line) {
    super(message);
    this.name = 'CsvParseError';
    this.line = line;
  }
}

/**
 * @typedef {{ fields: string[], line: number }} CsvRecord
 */

/**
 * Parse CSV text into records.
 *
 * `line` is the 1-based line on which the record starts. Records that contain
 * embedded newlines still report their first line, which is the line number a
 * reader needs in order to find the offending row in an editor.
 *
 * @param {string} text
 * @returns {CsvRecord[]}
 * @throws {CsvParseError}
 */
function parseCsv(text) {
  if (typeof text !== 'string') {
    throw new TypeError('CSV input must be a string');
  }

  if (text.startsWith(BOM)) {
    text = text.slice(1);
  }

  /** @type {CsvRecord[]} */
  const records = [];
  /** @type {string[]} */
  let fields = [];
  let field = '';
  let inQuotes = false;
  let afterClosingQuote = false;
  let line = 1;
  let recordLine = 1;
  let index = 0;

  function endField() {
    fields.push(field);
    field = '';
  }

  function endRecord() {
    endField();
    records.push({ fields, line: recordLine });
    fields = [];
    recordLine = line + 1;
  }

  while (index < text.length) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        afterClosingQuote = true;
        index += 1;
        continue;
      }

      if (char === '\r') {
        if (text[index + 1] === '\n') {
          field += '\r\n';
          index += 2;
        } else {
          field += char;
          index += 1;
        }
        line += 1;
        continue;
      }

      if (char === '\n') {
        field += char;
        index += 1;
        line += 1;
        continue;
      }

      field += char;
      index += 1;
      continue;
    }

    if (afterClosingQuote) {
      if (char === ',') {
        endField();
        afterClosingQuote = false;
        index += 1;
        continue;
      }

      if (char === '\r' || char === '\n') {
        endRecord();
        if (char === '\r' && text[index + 1] === '\n') {
          index += 1;
        }
        index += 1;
        line += 1;
        continue;
      }

      throw new CsvParseError(
        `unexpected character ${JSON.stringify(char)} after a closing quote`,
        line,
      );
    }

    if (char === ',') {
      endField();
      index += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      endRecord();
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      index += 1;
      line += 1;
      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        throw new CsvParseError('unexpected double quote inside an unquoted field', line);
      }
      inQuotes = true;
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (inQuotes) {
    throw new CsvParseError('unterminated quoted field', recordLine);
  }

  if (afterClosingQuote) {
    endRecord();
  } else if (field.length > 0 || fields.length > 0) {
    endRecord();
  }

  return records;
}

module.exports = { CsvParseError, parseCsv };
