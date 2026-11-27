import test from 'node:test';
import assert from 'node:assert/strict';

import { CSV_HEADER, csvFilename, toCsv } from '../../src/csv.js';
import { parseCsv } from './helpers.js';

const samplePost = {
  id: 'test-1',
  subreddit: 'mossy_circuits',
  title: '教程：逗号, 引号"和中文',
  createdAt: '2026-10-19T13:45:00.000Z',
  score: 341,
  upvoteRatio: 0.96,
  commentCount: 64,
};

test('CSV starts with a UTF-8 BOM and the expected header', () => {
  const csv = toCsv([samplePost]);
  assert.ok(csv.startsWith('\uFEFF'));
  const firstLine = csv.slice(1).split('\r\n')[0];
  assert.equal(firstLine, CSV_HEADER.join(','));
  assert.deepEqual(CSV_HEADER, [
    'subreddit',
    'title',
    'created_at',
    'score',
    'upvote_ratio',
    'comments',
  ]);
});

test('CSV preserves Chinese text and escapes commas and quotes', () => {
  const csv = toCsv([samplePost]);
  assert.ok(
    csv.includes(
      '"教程：逗号, 引号""和中文"',
    ),
    'Chinese, comma, and quote field should be round-trip quoted',
  );
  const parsed = parseCsv(csv);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], CSV_HEADER);
  assert.equal(parsed[1][0], 'r/mossy_circuits');
  assert.equal(parsed[1][1], samplePost.title);
  assert.equal(parsed[1][2], samplePost.createdAt);
  assert.equal(parsed[1][3], '341');
  assert.equal(parsed[1][4], '0.96');
  assert.equal(parsed[1][5], '64');
});

test('CSV quotes embedded newlines and doubles quote characters', () => {
  const post = {
    ...samplePost,
    title: '第一行\r\n第二行，"引号"',
  };
  const csv = toCsv([post]);
  const parsed = parseCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1][1], post.title);
  assert.ok(csv.includes('""引号""'));
  assert.ok(csv.includes('第一行\r\n第二行'));
});

test('CSV contains only the rows it is given, in order', () => {
  const posts = [
    { ...samplePost, id: 'b', title: '第二条' },
    { ...samplePost, id: 'a', title: '第一条' },
  ];
  const parsed = parseCsv(toCsv(posts, { bom: false }));
  assert.deepEqual(
    parsed.slice(1).map((row) => row[1]),
    ['第二条', '第一条'],
  );
});

test('an empty selection still produces the header row', () => {
  const parsed = parseCsv(toCsv([]));
  assert.deepEqual(parsed, [CSV_HEADER]);
});

test('BOM can be disabled for programmatic consumers', () => {
  assert.ok(!toCsv([samplePost], { bom: false }).startsWith('\uFEFF'));
});

test('the export filename is a deterministic UTC timestamp', () => {
  assert.equal(
    csvFilename(new Date('2026-11-23T09:05:07.123Z')),
    'reddit-archive-20261123-090507.csv',
  );
});
