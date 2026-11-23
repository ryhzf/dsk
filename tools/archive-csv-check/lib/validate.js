'use strict';

/**
 * Validation rules for a Reddit Archive CSV export.
 *
 * The checker accepts extra columns, but requires every column below to be
 * present exactly once. Row validation is deliberately strict so that a bad
 * export is caught before it is handed to a customer.
 */

const REQUIRED_COLUMNS = Object.freeze([
  'subreddit',
  'title',
  'score',
  'upvote_ratio',
  'num_comments',
  'created_utc',
]);

const INTEGER_RE = /^-?\d+$/;
const NON_NEGATIVE_INTEGER_RE = /^\d+$/;
const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Parse a plain decimal string. Number() is too permissive here because it
 * accepts values such as "0x10", "Infinity" and an empty string.
 *
 * @param {string} value
 * @returns {number|null}
 */
function parseDecimal(value) {
  if (!DECIMAL_RE.test(value)) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Keep error messages readable for long or control-character-heavy values.
 *
 * @param {string} value
 * @returns {string}
 */
function preview(value) {
  const clipped = value.length > 60 ? `${value.slice(0, 57)}...` : value;
  return JSON.stringify(clipped);
}

/**
 * Check the header row.
 *
 * @param {string[]|undefined} headerFields
 * @returns {{ errors: string[], indexByName: Map<string, number> }}
 */
function checkHeader(headerFields) {
  /** @type {string[]} */
  const errors = [];
  /** @type {Map<string, number>} */
  const indexByName = new Map();

  if (!headerFields) {
    return {
      errors: ['the file is empty (missing header row)'],
      indexByName,
    };
  }

  /** @type {Set<string>} */
  const duplicates = new Set();

  headerFields.forEach((rawName, columnIndex) => {
    if (rawName === '') {
      errors.push(`header column ${columnIndex + 1} has an empty name`);
    }

    if (indexByName.has(rawName)) {
      if (!duplicates.has(rawName)) {
        duplicates.add(rawName);
        errors.push(`duplicate header column ${JSON.stringify(rawName)}`);
      }
    } else {
      indexByName.set(rawName, columnIndex);
    }
  });

  const missing = REQUIRED_COLUMNS.filter((name) => !indexByName.has(name));
  if (missing.length > 0) {
    errors.push(`missing required column(s): ${missing.join(', ')}`);
  }

  return { errors, indexByName };
}

/**
 * Validate one data row.
 *
 * @param {string[]} fields
 * @param {number} headerLength
 * @param {Map<string, number>} indexByName
 * @param {string[]} expectedSubreddits normalized, lowercase names
 * @returns {string[]} one message per problem; empty when the row is valid
 */
function checkRow(fields, headerLength, indexByName, expectedSubreddits) {
  if (fields.length !== headerLength) {
    return [`expected ${headerLength} fields, got ${fields.length}`];
  }

  const reasons = [];
  const valueOf = (name) => fields[indexByName.get(name)];

  const subreddit = valueOf('subreddit');
  if (subreddit.trim() === '') {
    reasons.push('subreddit is empty');
  } else if (
    expectedSubreddits.length > 0 &&
    !expectedSubreddits.includes(subreddit.trim().toLowerCase())
  ) {
    reasons.push(
      `subreddit ${preview(subreddit)} is outside the expected scope (${expectedSubreddits.join(', ')})`,
    );
  }

  const title = valueOf('title');
  if (title.trim() === '') {
    reasons.push('title is empty');
  }

  const score = valueOf('score');
  if (!INTEGER_RE.test(score)) {
    reasons.push(`score ${preview(score)} is not an integer`);
  }

  const upvoteRatio = valueOf('upvote_ratio');
  const parsedRatio = parseDecimal(upvoteRatio);
  if (parsedRatio === null) {
    reasons.push(`upvote_ratio ${preview(upvoteRatio)} is not a number`);
  } else if (parsedRatio < 0 || parsedRatio > 1) {
    reasons.push(`upvote_ratio ${preview(upvoteRatio)} is outside the range [0, 1]`);
  }

  const numComments = valueOf('num_comments');
  if (!NON_NEGATIVE_INTEGER_RE.test(numComments)) {
    reasons.push(`num_comments ${preview(numComments)} is not a non-negative integer`);
  }

  const createdUtc = valueOf('created_utc');
  const parsedCreatedUtc = parseDecimal(createdUtc);
  if (parsedCreatedUtc === null) {
    reasons.push(`created_utc ${preview(createdUtc)} is not a number`);
  } else if (parsedCreatedUtc < 0) {
    reasons.push(`created_utc ${preview(createdUtc)} must not be negative`);
  }

  return reasons;
}

/**
 * Validate a parsed CSV file.
 *
 * @param {import('./csv').CsvRecord[]} records
 * @param {string[]} expectedSubreddits case-insensitive scope; may be empty
 * @returns {{
 *   valid: boolean,
 *   header: { line: number, errors: string[], valid: boolean },
 *   rows: {
 *     checked: boolean,
 *     total: number,
 *     passed: number,
 *     failed: number,
 *     failures: Array<{ line: number, reasons: string[] }>
 *   }
 * }}
 */
function validateRecords(records, expectedSubreddits) {
  const normalizedScope = [
    ...new Set(
      expectedSubreddits
        .map((name) => name.trim().toLowerCase())
        .filter((name) => name !== ''),
    ),
  ];

  if (records.length === 0) {
    return {
      valid: false,
      header: {
        line: 1,
        errors: ['the file is empty (missing header row)'],
        valid: false,
      },
      rows: { checked: false, total: 0, passed: 0, failed: 0, failures: [] },
    };
  }

  const headerRecord = records[0];
  const headerCheck = checkHeader(headerRecord.fields);
  const header = {
    line: headerRecord.line,
    errors: headerCheck.errors,
    valid: headerCheck.errors.length === 0,
  };

  const dataRecords = records.slice(1);
  const rows = {
    checked: header.valid,
    total: dataRecords.length,
    passed: 0,
    failed: 0,
    /** @type {Array<{ line: number, reasons: string[] }>} */
    failures: [],
  };

  if (!header.valid) {
    return { valid: false, header, rows };
  }

  const headerLength = headerRecord.fields.length;
  for (const record of dataRecords) {
    const reasons = checkRow(
      record.fields,
      headerLength,
      headerCheck.indexByName,
      normalizedScope,
    );
    if (reasons.length === 0) {
      rows.passed += 1;
    } else {
      rows.failed += 1;
      rows.failures.push({ line: record.line, reasons });
    }
  }

  return { valid: rows.failed === 0, header, rows };
}

module.exports = {
  REQUIRED_COLUMNS,
  checkHeader,
  checkRow,
  parseDecimal,
  validateRecords,
};
