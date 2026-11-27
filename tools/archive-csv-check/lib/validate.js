'use strict';

/**
 * Validation rules for a Reddit Archive CSV export.
 *
 * The checker accepts extra columns and either the canonical or website names
 * for the comment count and creation time. Row validation is deliberately
 * strict so that a bad export is caught before it is handed to a customer.
 */

/**
 * Each required logical field may be represented by one of several column
 * names. The canonical names are kept first; the website's current export uses
 * `comments` and `created_at` instead.
 */
const COMMENT_COLUMNS = Object.freeze(['num_comments', 'comments']);
const CREATED_COLUMNS = Object.freeze(['created_utc', 'created_at']);

const REQUIRED_COLUMN_GROUPS = Object.freeze([
  Object.freeze(['subreddit']),
  Object.freeze(['title']),
  Object.freeze(['score']),
  Object.freeze(['upvote_ratio']),
  COMMENT_COLUMNS,
  CREATED_COLUMNS,
]);

const REQUIRED_COLUMNS = Object.freeze(
  REQUIRED_COLUMN_GROUPS.map(([primary]) => primary),
);

const REQUIRED_COLUMNS_DESCRIPTION = REQUIRED_COLUMN_GROUPS.map((group) =>
  group.length === 1 ? group[0] : `${group[0]} (or ${group.slice(1).join(' or ')})`,
).join(', ');

const INTEGER_RE = /^-?\d+$/;
const NON_NEGATIVE_INTEGER_RE = /^\d+$/;
const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const ISO_UTC_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/;

/**
 * Strip the optional `r/` prefix used by the website and trim surrounding
 * whitespace. The result is not lowercased because display messages keep the
 * original casing.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeSubredditName(value) {
  return value.trim().replace(/^r\//i, '');
}

/**
 * Check for an ISO 8601 UTC timestamp such as `2026-08-14T09:30:00.000Z`.
 *
 * Date.parse() accepts some strings and normalizes impossible dates, so the
 * parsed components are compared back against the input. A `Z` suffix is
 * required because the website exports UTC timestamps in that form.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isIsoUtcTimestamp(value) {
  const match = ISO_UTC_RE.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const milliseconds = Number(`${match[7] ?? ''}000`.slice(0, 3));

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, milliseconds);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second &&
    date.getUTCMilliseconds() === milliseconds
  );
}

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

  const missing = REQUIRED_COLUMN_GROUPS.filter(
    (group) => !group.some((name) => indexByName.has(name)),
  ).map((group) =>
    group.length === 1 ? group[0] : `${group[0]} (or ${group.slice(1).join(' or ')})`,
  );
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
 * @param {string[]} expectedSubreddits normalized, lowercase names without r/
 * @returns {string[]} one message per problem; empty when the row is valid
 */
function checkRow(fields, headerLength, indexByName, expectedSubreddits) {
  if (fields.length !== headerLength) {
    return [`expected ${headerLength} fields, got ${fields.length}`];
  }

  const reasons = [];
  const valueOf = (name) => fields[indexByName.get(name)];

  const subreddit = valueOf('subreddit');
  const subredditName = normalizeSubredditName(subreddit);
  if (subredditName === '') {
    reasons.push('subreddit is empty');
  } else if (
    expectedSubreddits.length > 0 &&
    !expectedSubreddits.includes(subredditName.toLowerCase())
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

  for (const fieldName of COMMENT_COLUMNS) {
    if (!indexByName.has(fieldName)) {
      continue;
    }
    const numComments = valueOf(fieldName);
    if (!NON_NEGATIVE_INTEGER_RE.test(numComments)) {
      reasons.push(`${fieldName} ${preview(numComments)} is not a non-negative integer`);
    }
  }

  if (indexByName.has('created_utc')) {
    const createdUtc = valueOf('created_utc');
    const parsedCreatedUtc = parseDecimal(createdUtc);
    if (parsedCreatedUtc === null) {
      reasons.push(`created_utc ${preview(createdUtc)} is not a number`);
    } else if (parsedCreatedUtc < 0) {
      reasons.push(`created_utc ${preview(createdUtc)} must not be negative`);
    }
  }

  if (indexByName.has('created_at')) {
    const createdAt = valueOf('created_at');
    if (!isIsoUtcTimestamp(createdAt)) {
      reasons.push(
        `created_at ${preview(createdAt)} is not a valid ISO 8601 UTC timestamp (expected e.g. 2026-08-14T09:30:00.000Z)`,
      );
    }
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
        .map((name) => normalizeSubredditName(name).toLowerCase())
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
  REQUIRED_COLUMN_GROUPS,
  REQUIRED_COLUMNS,
  REQUIRED_COLUMNS_DESCRIPTION,
  checkHeader,
  checkRow,
  isIsoUtcTimestamp,
  normalizeSubredditName,
  parseDecimal,
  validateRecords,
};
