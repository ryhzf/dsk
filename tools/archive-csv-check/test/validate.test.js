'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseCsv } = require('../lib/csv');
const {
  REQUIRED_COLUMNS,
  REQUIRED_COLUMNS_DESCRIPTION,
  isIsoUtcTimestamp,
  validateRecords,
} = require('../lib/validate');

const HEADER = 'subreddit,title,score,upvote_ratio,num_comments,created_utc';
const WEBSITE_HEADER = 'subreddit,title,created_at,score,upvote_ratio,comments';

function validate(text, scope = []) {
  return validateRecords(parseCsv(text), scope);
}

test('accepts a correct export, including negative scores and ratio boundaries', () => {
  const result = validate(
    `${HEADER},permalink\n` +
      'programming,"好, 标题 ""引号""",-12,0.0,0,1700000000.0,/r/programming/1\n' +
      'Programming,"second row",0,1,3,1700000001,/r/programming/2\n',
    ['programming', 'learnprogramming'],
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.header.errors, []);
  assert.equal(result.header.valid, true);
  assert.equal(result.rows.total, 2);
  assert.equal(result.rows.passed, 2);
  assert.equal(result.rows.failed, 0);
  assert.deepEqual(result.rows.failures, []);
});

test('accepts extra columns and any required-column order', () => {
  const result = validate(
    'title,subreddit,score,upvote_ratio,num_comments,created_utc,note\n' +
      '"reordered",programming,1,0.5,2,1700000000,ok\n',
    ['programming'],
  );

  assert.equal(result.valid, true);
  assert.equal(result.rows.passed, 1);
});

test('rejects invalid website created_at values and negative comments', () => {
  const result = validate(
    `${WEBSITE_HEADER}\n` +
      'r/programming,"valid",2026-08-14T09:30:00.000Z,1,0.5,2\n' +
      'r/programming,"impossible date",2026-02-30T09:30:00.000Z,1,0.5,2\n' +
      'r/programming,"missing zone",2026-08-14T09:30:00.000,1,0.5,2\n' +
      'r/programming,"offset instead of Z",2026-08-14T09:30:00+00:00,1,0.5,2\n' +
      'r/programming,"negative comments",2026-08-14T09:30:00.000Z,1,0.5,-2\n' +
      'r/news,"outside scope",2026-08-14T09:30:00.000Z,1,0.5,2\n',
    ['programming'],
  );

  assert.equal(result.rows.total, 6);
  assert.equal(result.rows.passed, 1);
  assert.equal(result.rows.failed, 5);

  const reasonsByLine = new Map(
    result.rows.failures.map((failure) => [failure.line, failure.reasons.join(' | ')]),
  );
  assert.match(reasonsByLine.get(3), /created_at .* is not a valid ISO 8601 UTC timestamp/);
  assert.match(reasonsByLine.get(4), /created_at .* is not a valid ISO 8601 UTC timestamp/);
  assert.match(reasonsByLine.get(5), /created_at .* is not a valid ISO 8601 UTC timestamp/);
  assert.match(reasonsByLine.get(6), /comments "-2" is not a non-negative integer/);
  assert.match(reasonsByLine.get(7), /subreddit "r\/news" is outside/);
});

test('validates both aliases when both comment and time columns are present', () => {
  const result = validate(
    'subreddit,title,score,upvote_ratio,num_comments,comments,created_utc,created_at\n' +
      'r/programming,"both pairs",1,0.5,3,-1,1700000000,2026-08-14T09:30:00.000Z\n',
    ['programming'],
  );

  assert.equal(result.rows.failed, 1);
  assert.match(result.rows.failures[0].reasons.join(' '), /comments "-1"/);
});

test('recognizes only real ISO 8601 UTC timestamps', () => {
  for (const value of [
    '2026-08-14T09:30:00.000Z',
    '2024-02-29T23:59:59Z',
    '2026-08-14T09:30:00.123456Z',
  ]) {
    assert.equal(isIsoUtcTimestamp(value), true, value);
  }

  for (const value of [
    '2026-02-30T09:30:00.000Z',
    '2026-13-01T00:00:00Z',
    '2026-08-14T24:00:00Z',
    '2026-08-14T09:30:00+00:00',
    '2026-08-14T09:30:00.000',
    '2026-08-14 09:30:00Z',
    'not-a-date',
    '',
  ]) {
    assert.equal(isIsoUtcTimestamp(value), false, value);
  }
});

test('requires each logical header field and rejects duplicate names', () => {
  const missing = validate('subreddit,title,score,num_comments,created_utc\n');
  assert.equal(missing.valid, false);
  assert.equal(missing.rows.checked, false);
  assert.match(missing.header.errors.join(' '), /upvote_ratio/);
  assert.equal(missing.header.line, 1);

  const duplicate = validate(`${HEADER},title\n`);
  assert.equal(duplicate.valid, false);
  assert.match(duplicate.header.errors.join(' '), /duplicate header column "title"/);

  const emptyName = validate(`${HEADER},\n`);
  assert.equal(emptyName.valid, false);
  assert.match(emptyName.header.errors.join(' '), /header column 7 has an empty name/);

  const missingComments = validate('subreddit,title,score,upvote_ratio,created_utc\n');
  assert.equal(missingComments.valid, false);
  assert.match(
    missingComments.header.errors.join(' '),
    /missing required column\(s\): num_comments \(or comments\)/,
  );

  const missingTime = validate('subreddit,title,score,upvote_ratio,num_comments\n');
  assert.equal(missingTime.valid, false);
  assert.match(
    missingTime.header.errors.join(' '),
    /missing required column\(s\): created_utc \(or created_at\)/,
  );
});

test('accepts the website header with comments, created_at and r/ prefixes', () => {
  const result = validate(
    `${WEBSITE_HEADER}\n` +
      'r/mossy_circuits,"标题带,逗号和 ""引号""",2026-08-14T09:30:00.000Z,412,0.94,37\n' +
      'R/Paper_Tides,"no milliseconds",2026-08-21T11:00:00Z,689,0.97,92\n',
    ['mossy_circuits', 'r/paper_tides'],
  );

  assert.equal(result.valid, true);
  assert.equal(result.rows.total, 2);
  assert.equal(result.rows.passed, 2);
  assert.equal(result.rows.failed, 0);
});

test('accepts mixed canonical and website column pairs', () => {
  const result = validate(
    'subreddit,title,score,upvote_ratio,num_comments,created_at\n' +
      'r/programming,"mixed format",1,0.5,2,2026-08-14T09:30:00.000Z\n',
    ['programming'],
  );

  assert.equal(result.valid, true);
  assert.equal(result.rows.passed, 1);
});

test('reports each invalid numeric value with its row line', () => {
  const result = validate(
    `${HEADER}\n` +
      'programming,"good",1,0.5,2,1700000000\n' +
      'programming,"bad score",abc,0.5,2,1700000000\n' +
      'programming,"too high",1,1.2,2,1700000000\n' +
      'programming,"negative ratio",1,-0.1,2,1700000000\n' +
      'programming,"bad comments",1,0.5,-2,1700000000\n' +
      'programming,"bad timestamp",1,0.5,2,yesterday\n' +
      'programming,"not a number ratio",1,NaN,2,1700000000\n',
    ['programming'],
  );

  assert.equal(result.valid, false);
  assert.equal(result.rows.total, 7);
  assert.equal(result.rows.passed, 1);
  assert.equal(result.rows.failed, 6);

  const reasonsByLine = new Map(
    result.rows.failures.map((failure) => [failure.line, failure.reasons.join(' | ')]),
  );

  assert.match(reasonsByLine.get(3), /score "abc" is not an integer/);
  assert.match(reasonsByLine.get(4), /upvote_ratio "1.2" is outside the range \[0, 1\]/);
  assert.match(reasonsByLine.get(5), /upvote_ratio "-0.1" is outside the range \[0, 1\]/);
  assert.match(reasonsByLine.get(6), /num_comments "-2" is not a non-negative integer/);
  assert.match(reasonsByLine.get(7), /created_utc "yesterday" is not a number/);
  assert.match(reasonsByLine.get(8), /upvote_ratio "NaN" is not a number/);
});

test('rejects row width mismatches before checking individual fields', () => {
  const result = validate(
    `${HEADER}\n` +
      'programming,"too short",1,0.5\n' +
      'programming,"too long",1,0.5,2,1700000000,extra\n',
    ['programming'],
  );

  assert.equal(result.rows.total, 2);
  assert.equal(result.rows.failed, 2);
  assert.deepEqual(result.rows.failures, [
    { line: 2, reasons: ['expected 6 fields, got 4'] },
    { line: 3, reasons: ['expected 6 fields, got 7'] },
  ]);
});

test('reports every problem in a row together', () => {
  const result = validate(`${HEADER}\nprogramming,"",nope,2,-1,bad\n`, ['programming']);

  assert.equal(result.rows.failed, 1);
  assert.deepEqual(result.rows.failures[0].reasons, [
    'title is empty',
    'score "nope" is not an integer',
    'upvote_ratio "2" is outside the range [0, 1]',
    'num_comments "-1" is not a non-negative integer',
    'created_utc "bad" is not a number',
  ]);
});

test('rejects rows outside the expected subreddit scope', () => {
  const result = validate(
    `${HEADER}\n` +
      'programming,"inside",1,0.5,1,1700000000\n' +
      'news,"outside",2,0.6,2,1700000001\n' +
      'LearnProgramming,"case-insensitive",3,0.7,3,1700000002\n' +
      'r/programming,"prefixed inside",4,0.8,4,1700000003\n' +
      'r/news,"prefixed outside",5,0.9,5,1700000004\n',
    ['programming', 'learnprogramming'],
  );

  assert.equal(result.rows.total, 5);
  assert.equal(result.rows.passed, 3);
  assert.equal(result.rows.failed, 2);
  assert.equal(result.rows.failures[0].line, 3);
  assert.match(result.rows.failures[0].reasons[0], /subreddit "news" is outside/);
  assert.equal(result.rows.failures[1].line, 6);
  assert.match(result.rows.failures[1].reasons[0], /subreddit "r\/news" is outside/);
});

test('rejects an empty subreddit and an empty title', () => {
  const result = validate(`${HEADER}\n,"",1,0.5,1,1700000000\n`, ['programming']);

  assert.equal(result.rows.failed, 1);
  assert.deepEqual(result.rows.failures[0].reasons, [
    'subreddit is empty',
    'title is empty',
  ]);
});

test('keeps the record start line for rows with embedded newlines', () => {
  const result = validate(
    `${HEADER}\n` +
      'programming,"line one\nline two",bad,0.5,1,1700000000\n' +
      'programming,"next row",1,0.5,1,1700000001\n',
    ['programming'],
  );

  assert.equal(result.rows.total, 2);
  assert.equal(result.rows.failures[0].line, 2);
  assert.equal(result.rows.failures[0].reasons[0], 'score "bad" is not an integer');
});

test('handles an empty file and a header-only file', () => {
  const empty = validate('');
  assert.equal(empty.valid, false);
  assert.match(empty.header.errors[0], /file is empty/);
  assert.equal(empty.rows.checked, false);

  const headerOnly = validate(`${HEADER}\n`, ['programming']);
  assert.equal(headerOnly.valid, true);
  assert.equal(headerOnly.rows.checked, true);
  assert.equal(headerOnly.rows.total, 0);
  assert.equal(headerOnly.rows.passed, 0);
  assert.equal(headerOnly.rows.failed, 0);
});

test('exposes the documented required column list', () => {
  assert.deepEqual(REQUIRED_COLUMNS, [
    'subreddit',
    'title',
    'score',
    'upvote_ratio',
    'num_comments',
    'created_utc',
  ]);
  assert.equal(
    REQUIRED_COLUMNS_DESCRIPTION,
    'subreddit, title, score, upvote_ratio, num_comments (or comments), created_utc (or created_at)',
  );
});
