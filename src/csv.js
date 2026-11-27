/**
 * CSV serialization for the archive export.
 *
 * Fields are RFC 4180 quoted when they contain a comma, a quote, or a line
 * break. A UTF-8 BOM is included so spreadsheet applications open the Chinese
 * text without mojibake.
 */

export const CSV_COLUMNS = Object.freeze([
  ['subreddit', (post) => `r/${post.subreddit}`],
  ['title', (post) => post.title],
  ['created_at', (post) => post.createdAt],
  ['score', (post) => post.score],
  ['upvote_ratio', (post) => post.upvoteRatio],
  ['comments', (post) => post.commentCount],
]);

export const CSV_HEADER = CSV_COLUMNS.map(([key]) => key);

function escapeField(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toCsv(posts, { bom = true } = {}) {
  const lines = [
    CSV_HEADER.join(','),
    ...posts.map((post) =>
      CSV_COLUMNS.map(([, read]) => escapeField(read(post))).join(','),
    ),
  ];
  return `${bom ? '\uFEFF' : ''}${lines.join('\r\n')}\r\n`;
}

export function csvFilename(now = new Date()) {
  const stamp = now
    .toISOString()
    .slice(0, 19)
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace('T', '-');
  return `reddit-archive-${stamp}.csv`;
}
