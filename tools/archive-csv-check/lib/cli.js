'use strict';

const fs = require('node:fs');

const { CsvParseError, parseCsv } = require('./csv');
const {
  REQUIRED_COLUMNS_DESCRIPTION,
  normalizeSubredditName,
  validateRecords,
} = require('./validate');

const USAGE = `Usage: node tools/archive-csv-check/index.js <csv-file> --subreddit <name[,name...]>

Validate a Reddit Archive CSV export.

Arguments:
  <csv-file>                 Path to a UTF-8 CSV file to check.

Options:
  -s, --subreddit <names>    Expected subreddit scope, comma-separated and/or
                             repeatable. Case-insensitive; r/ is optional.
  -h, --help                 Show this help.

Required columns:
  ${REQUIRED_COLUMNS_DESCRIPTION}

Exit codes:
  0  The file is valid.
  1  The file is invalid (header, row or CSV syntax).
  2  The command line is invalid or the file could not be read.
`;

/**
 * @param {string[]} argv
 * @returns {{
 *   file: string|null,
 *   subreddits: string[],
 *   help: boolean,
 *   errors: string[]
 * }}
 */
function parseArgs(argv) {
  /** @type {{ file: string|null, subreddits: string[], help: boolean, errors: string[] }} */
  const parsed = { file: null, subreddits: [], help: false, errors: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }

    if (argument === '--') {
      for (const rest of argv.slice(index + 1)) {
        if (parsed.file === null) {
          parsed.file = rest;
        } else {
          parsed.errors.push(`unexpected extra argument: ${rest}`);
        }
      }
      break;
    }

    if (argument === '--subreddit' || argument === '-s') {
      const value = argv[index + 1];
      if (value === undefined || value === '') {
        parsed.errors.push(`${argument} requires a value`);
      } else {
        parsed.subreddits.push(value);
        index += 1;
      }
      continue;
    }

    if (argument.startsWith('--subreddit=')) {
      const value = argument.slice('--subreddit='.length);
      if (value === '') {
        parsed.errors.push('--subreddit requires a value');
      } else {
        parsed.subreddits.push(value);
      }
      continue;
    }

    if (argument.startsWith('-') && argument !== '-') {
      parsed.errors.push(`unknown option: ${argument}`);
      continue;
    }

    if (parsed.file === null) {
      parsed.file = argument;
    } else {
      parsed.errors.push(`unexpected extra argument: ${argument}`);
    }
  }

  return parsed;
}

/**
 * @param {string[]} values
 * @returns {string[]} lowercase, de-duplicated, non-empty names
 */
function normalizeSubreddits(values) {
  /** @type {string[]} */
  const names = [];
  const seen = new Set();

  for (const value of values) {
    for (const part of value.split(',')) {
      const name = normalizeSubredditName(part).toLowerCase();
      if (name !== '' && !seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }

  return names;
}

/**
 * Run the acceptance check.
 *
 * @param {string[]} argv
 * @param {{ stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream }} [io]
 * @returns {number} process exit code
 */
function main(argv = process.argv.slice(2), io = { stdout: process.stdout, stderr: process.stderr }) {
  const { stdout, stderr } = io;
  const parsed = parseArgs(argv);

  if (parsed.help) {
    stdout.write(USAGE);
    return 0;
  }

  const argumentErrors = [...parsed.errors];
  if (parsed.file === null) {
    argumentErrors.push('missing <csv-file> argument');
  }

  const expectedSubreddits = normalizeSubreddits(parsed.subreddits);
  if (expectedSubreddits.length === 0) {
    argumentErrors.push('at least one --subreddit is required');
  }

  if (argumentErrors.length > 0) {
    stderr.write(`${argumentErrors.map((error) => `error: ${error}`).join('\n')}\n\n${USAGE}`);
    return 2;
  }

  const file = /** @type {string} */ (parsed.file);

  /** @type {string} */
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    stderr.write(`error: cannot read ${JSON.stringify(file)}: ${error.message}\n`);
    return 2;
  }

  /** @type {import('./csv').CsvRecord[]} */
  let records;
  try {
    records = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvParseError) {
      stderr.write(`error: ${JSON.stringify(file)}: line ${error.line}: ${error.message}\n`);
      return 1;
    }
    throw error;
  }

  const result = validateRecords(records, expectedSubreddits);

  const lines = [
    'Reddit Archive CSV acceptance check',
    `File: ${file}`,
    `Expected subreddit scope: ${expectedSubreddits.join(', ')}`,
    '',
  ];

  if (result.header.valid) {
    lines.push('Header: OK');
  } else {
    lines.push('Header: INVALID');
    for (const message of result.header.errors) {
      lines.push(`  line ${result.header.line}: ${message}`);
    }
  }

  if (!result.rows.checked) {
    lines.push(`Rows: ${result.rows.total} total (not validated because the header is invalid)`);
  } else {
    if (result.rows.total === 0) {
      lines.push('warning: the file contains a header but no data rows');
      lines.push('');
    }

    lines.push(
      `Rows: ${result.rows.total} total, ${result.rows.passed} passed, ${result.rows.failed} failed`,
    );

    for (const failure of result.rows.failures) {
      lines.push(`  line ${failure.line}: ${failure.reasons.join('; ')}`);
    }
  }

  lines.push('');
  lines.push(`Result: ${result.valid ? 'PASS' : 'INVALID'}`);

  stdout.write(`${lines.join('\n')}\n`);
  return result.valid ? 0 : 1;
}

module.exports = {
  USAGE,
  main,
  normalizeSubreddits,
  parseArgs,
};
