'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const INDEX = path.join(__dirname, '..', 'index.js');
const FIXTURES = path.join(__dirname, 'fixtures');

function fixture(name) {
  return path.join(FIXTURES, name);
}

function run(args) {
  return spawnSync(process.execPath, [INDEX, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
}

function withCrlfCopy(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-csv-check-'));
  const file = path.join(directory, 'export.csv');
  const lf = fs.readFileSync(fixture('valid-unicode.csv'), 'utf8');
  fs.writeFileSync(file, lf.replace(/\n/g, '\r\n'), 'utf8');

  try {
    return callback(file);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('passes a valid BOM/CRLF export with Chinese punctuation and quoted newlines', () => {
  const result = withCrlfCopy((file) =>
    run([file, '--subreddit', 'programming,learnprogramming']),
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Header: OK/);
  assert.match(result.stdout, /Rows: 4 total, 4 passed, 0 failed/);
  assert.match(result.stdout, /Result: PASS/);
});

test('accepts repeatable and equals-form --subreddit options', () => {
  const result = run([
    fixture('valid-unicode.csv'),
    '-s',
    'programming',
    '--subreddit=learnprogramming',
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Expected subreddit scope: programming, learnprogramming/);
});

test('fails invalid numeric values and reports their line numbers', () => {
  const result = run([fixture('invalid-numbers.csv'), '--subreddit', 'programming']);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Header: OK/);
  assert.match(result.stdout, /Rows: 11 total, 1 passed, 10 failed/);
  assert.match(result.stdout, /line 3: score "not-a-number" is not an integer/);
  assert.match(result.stdout, /line 4: upvote_ratio "1.2" is outside the range \[0, 1\]/);
  assert.match(result.stdout, /line 5: upvote_ratio "-0.1" is outside the range \[0, 1\]/);
  assert.match(result.stdout, /line 6: upvote_ratio "NaN" is not a number/);
  assert.match(result.stdout, /line 7: num_comments "-2" is not a non-negative integer/);
  assert.match(result.stdout, /line 8: created_utc "yesterday" is not a number/);
  assert.match(result.stdout, /line 9: expected 6 fields, got 4/);
  assert.match(result.stdout, /line 10: expected 6 fields, got 7/);
  assert.match(result.stdout, /line 11: title is empty/);
  assert.match(result.stdout, /line 12: score "\+5" is not an integer/);
  assert.match(result.stdout, /Result: INVALID/);
});

test('fails rows mixed in from another subreddit', () => {
  const result = run([
    fixture('mixed-subreddits.csv'),
    '--subreddit',
    'programming,learnprogramming',
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Rows: 5 total, 3 passed, 2 failed/);
  assert.match(result.stdout, /line 3: subreddit "news" is outside the expected scope/);
  assert.match(result.stdout, /line 5: subreddit "r\/programming" is outside the expected scope/);
  assert.match(result.stdout, /Result: INVALID/);
});

test('fails an invalid header on line 1 without validating rows', () => {
  const result = run([fixture('missing-header.csv'), '--subreddit', 'programming']);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Header: INVALID/);
  assert.match(result.stdout, /line 1: missing required column\(s\): upvote_ratio/);
  assert.match(result.stdout, /Rows: 1 total \(not validated because the header is invalid\)/);
  assert.match(result.stdout, /Result: INVALID/);
});

test('fails malformed CSV with the offending line on stderr', () => {
  const result = run([fixture('malformed-quote.csv'), '--subreddit', 'programming']);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /line 2: unterminated quoted field/);
});

test('rejects a missing file path, missing scope and unknown options with exit code 2', () => {
  const missingBoth = run([]);
  assert.equal(missingBoth.status, 2);
  assert.match(missingBoth.stderr, /missing <csv-file> argument/);
  assert.match(missingBoth.stderr, /at least one --subreddit is required/);
  assert.match(missingBoth.stderr, /Usage:/);

  const missingScope = run([fixture('valid-unicode.csv')]);
  assert.equal(missingScope.status, 2);
  assert.match(missingScope.stderr, /at least one --subreddit is required/);

  const unknown = run([fixture('valid-unicode.csv'), '--subreddit', 'programming', '--wat']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown option: --wat/);

  const missingFile = run([fixture('does-not-exist.csv'), '--subreddit', 'programming']);
  assert.equal(missingFile.status, 2);
  assert.match(missingFile.stderr, /cannot read/);
});

test('prints usage for --help', () => {
  const result = run(['--help']);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Usage: node tools\/archive-csv-check\/index\.js/);
  assert.match(result.stdout, /subreddit, title, score, upvote_ratio, num_comments, created_utc/);
});
