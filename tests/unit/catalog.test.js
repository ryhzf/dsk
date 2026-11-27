import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POSTS,
  SUBREDDITS,
  countPostsBySubreddit,
  filterPosts,
  getSubreddit,
} from '../../src/catalog.js';

test('the synthetic catalog has three subreddits with at least four posts each', () => {
  assert.equal(SUBREDDITS.length, 3);
  const counts = countPostsBySubreddit(POSTS);
  for (const subreddit of counts) {
    assert.ok(
      subreddit.count >= 4,
      `${subreddit.slug} should have at least four posts`,
    );
  }
  assert.equal(POSTS.length, 15);
  assert.deepEqual(
    [...new Set(POSTS.map((post) => post.subreddit))].sort(),
    SUBREDDITS.map((subreddit) => subreddit.slug).sort(),
  );
});

test('posts expose every field the UI and CSV need', () => {
  const ids = new Set();
  for (const post of POSTS) {
    assert.match(post.id, /^[a-z]{2}-\d{3}$/);
    assert.ok(!ids.has(post.id), `duplicate id ${post.id}`);
    ids.add(post.id);
    assert.ok(getSubreddit(post.subreddit), `unknown subreddit ${post.subreddit}`);
    assert.equal(typeof post.title, 'string');
    assert.ok(post.title.length > 0);
    assert.match(post.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(Number.isInteger(post.score));
    assert.ok(post.upvoteRatio > 0 && post.upvoteRatio <= 1);
    assert.ok(Number.isInteger(post.commentCount) && post.commentCount >= 0);
  }
});

test('the dataset includes Chinese, ASCII commas, and quotes for CSV coverage', () => {
  const titles = POSTS.map((post) => post.title);
  assert.ok(titles.some((title) => /[\u4e00-\u9fff]/.test(title)));
  assert.ok(titles.some((title) => title.includes(',')));
  assert.ok(titles.some((title) => title.includes('"')));
});

test('subreddit search matches slug, spaced slug, label, and r/ prefix', () => {
  const bySlug = filterPosts(POSTS, { query: 'mossy_circuits' });
  const bySpacedSlug = filterPosts(POSTS, { query: 'mossy circuits' });
  const byLabel = filterPosts(POSTS, { query: '苔藓电路' });
  const byPrefix = filterPosts(POSTS, { query: 'r/Paper_Tides' });
  const byCase = filterPosts(POSTS, { query: 'QUIET' });

  assert.equal(bySlug.length, 5);
  assert.equal(bySpacedSlug.length, 5);
  assert.equal(byLabel.length, 5);
  assert.equal(byPrefix.length, 5);
  assert.equal(byCase.length, 5);
  assert.ok(bySlug.every((post) => post.subreddit === 'mossy_circuits'));
  assert.ok(byLabel.every((post) => post.subreddit === 'mossy_circuits'));
});

test('no match produces an empty result', () => {
  assert.deepEqual(filterPosts(POSTS, { query: 'does-not-exist' }), []);
});

test('date filtering is inclusive and uses UTC calendar days', () => {
  const oneDay = filterPosts(POSTS, {
    from: '2026-09-28',
    to: '2026-09-28',
  });
  assert.deepEqual(
    oneDay.map((post) => post.id),
    ['mc-003'],
  );

  const august = filterPosts(POSTS, {
    from: '2026-08-01',
    to: '2026-08-31',
  });
  assert.deepEqual(
    august.map((post) => post.id).sort(),
    ['mc-001', 'pt-001', 'qo-001'].sort(),
  );

  const openEnded = filterPosts(POSTS, { from: '2026-11-01' });
  assert.ok(openEnded.length > 0);
  assert.ok(openEnded.every((post) => post.createdAt >= '2026-11-01'));

  const inverted = filterPosts(POSTS, {
    from: '2026-11-01',
    to: '2026-10-01',
  });
  assert.deepEqual(inverted, []);
});

test('sorting supports newest, oldest, and net score directions', () => {
  const newest = filterPosts(POSTS, { sort: 'newest' });
  assert.equal(newest[0].id, 'qo-005');
  assert.equal(newest.at(-1).id, 'mc-001');
  assert.ok(
    newest.every(
      (post, index) =>
        index === 0 || newest[index - 1].createdAt >= post.createdAt,
    ),
  );

  const oldest = filterPosts(POSTS, { sort: 'oldest' });
  assert.equal(oldest[0].id, 'mc-001');
  assert.equal(oldest.at(-1).id, 'qo-005');

  const highScore = filterPosts(POSTS, { sort: 'score-desc' });
  assert.deepEqual(
    highScore.slice(0, 3).map((post) => post.score),
    [689, 512, 433],
  );

  const lowScore = filterPosts(POSTS, { sort: 'score-asc' });
  assert.deepEqual(
    lowScore.slice(0, 3).map((post) => post.score),
    [76, 97, 152],
  );
});

test('filters combine with sorting and do not mutate the source array', () => {
  const before = POSTS.map((post) => post.id);
  const rows = filterPosts(POSTS, {
    query: 'mossy',
    from: '2026-09-01',
    to: '2026-10-31',
    sort: 'score-desc',
  });

  assert.deepEqual(
    rows.map((post) => post.id),
    ['mc-004', 'mc-002', 'mc-003'],
  );
  assert.deepEqual(
    POSTS.map((post) => post.id),
    before,
  );
});
