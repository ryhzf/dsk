'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseCsv } = require('../lib/csv');
const { REQUIRED_COLUMNS, validateRecords } = require('../lib/validate');

const HEADER = 'subreddit,title,score,upvote_ratio,num_comments,created_utc';

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

test('requires every required column exactly once', () => {
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
      'r/programming,"prefixed",4,0.8,4,1700000003\n',
    ['programming', 'learnprogramming'],
  );

  assert.equal(result.rows.total, 4);
  assert.equal(result.rows.passed, 2);
  assert.equal(result.rows.failed, 2);
  assert.equal(result.rows.failures[0].line, 3);
  assert.match(result.rows.failures[0].reasons[0], /subreddit "news" is outside/);
  assert.equal(result.rows.failures[1].line, 5);
  assert.match(result.rows.failures[1].reasons[0], /subreddit "r\/programming" is outside/);
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
});
