'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { CsvParseError, parseCsv } = require('../lib/csv');

test('parses BOM, CRLF, quoted commas, doubled quotes and embedded newlines', () => {
  const text =
    '\uFEFFsubreddit,title,score\r\n' +
    'programming,"a, b",1\r\n' +
    'learnprogramming,"line1\r\nline2 ""quoted""",-2\r\n';

  const records = parseCsv(text);

  assert.equal(records.length, 3);
  assert.deepEqual(records[0], {
    fields: ['subreddit', 'title', 'score'],
    line: 1,
  });
  assert.deepEqual(records[1], {
    fields: ['programming', 'a, b', '1'],
    line: 2,
  });
  assert.deepEqual(records[2], {
    fields: ['learnprogramming', 'line1\r\nline2 "quoted"', '-2'],
    line: 3,
  });
});

test('handles LF, CRLF and lone CR record separators', () => {
  assert.deepEqual(
    parseCsv('a,b\nc,d\r\ne,f\rg,h\n').map((record) => record.fields),
    [
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
      ['g', 'h'],
    ],
  );
});

test('does not invent a record after a trailing line break', () => {
  assert.equal(parseCsv('a,b\n').length, 1);
  assert.equal(parseCsv('a,b\r\n').length, 1);
  assert.equal(parseCsv('').length, 0);
});

test('keeps empty and quoted empty fields', () => {
  assert.deepEqual(parseCsv('a,,c\n').at(0).fields, ['a', '', 'c']);
  assert.deepEqual(parseCsv('a,"",c\n').at(0).fields, ['a', '', 'c']);
  assert.deepEqual(parseCsv(',\n').at(0).fields, ['', '']);
});

test('parses the Chinese punctuation fixture without splitting quoted commas', () => {
  const text = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'valid-unicode.csv'),
    'utf8',
  );
  const records = parseCsv(text);

  assert.equal(records.length, 5);
  assert.equal(
    records[1].fields[1],
    '为什么 Rust 的“所有权”这么难？—— 其实, 是习惯问题',
  );
  assert.equal(
    records[2].fields[1],
    '第一行\n第二行有 "引号"、ASCII, 逗号 和，中文逗号',
  );
  assert.equal(records[2].line, 3);
  assert.equal(records[3].fields[1], 'A title with, a comma and "double quotes"');
  assert.equal(records[3].line, 5);
});

test('reports the record start line for an unterminated quoted field', () => {
  assert.throws(
    () => parseCsv('subreddit,title\nprogramming,"open\nstill open\n'),
    (error) => {
      assert.ok(error instanceof CsvParseError);
      assert.equal(error.line, 2);
      assert.match(error.message, /unterminated quoted field/);
      return true;
    },
  );
});

test('rejects characters after a closing quote', () => {
  assert.throws(
    () => parseCsv('a,b\nprogramming,"bad"x,1\n'),
    (error) => {
      assert.ok(error instanceof CsvParseError);
      assert.equal(error.line, 2);
      assert.match(error.message, /after a closing quote/);
      return true;
    },
  );
});

test('rejects a stray quote inside an unquoted field', () => {
  assert.throws(
    () => parseCsv('a,b\npro"gramming,1\n'),
    (error) => {
      assert.ok(error instanceof CsvParseError);
      assert.equal(error.line, 2);
      assert.match(error.message, /inside an unquoted field/);
      return true;
    },
  );
});
