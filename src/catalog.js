/**
 * Synthetic archive data and pure filtering/sorting helpers.
 *
 * Everything here is imagined for the demo. No Reddit API is used and no real
 * subreddit or post is represented.
 */

export const SUBREDDITS = Object.freeze([
  Object.freeze({
    slug: 'mossy_circuits',
    label: '苔藓电路',
    blurb: '旧零件、低功耗与手作电子',
  }),
  Object.freeze({
    slug: 'paper_tides',
    label: '纸潮',
    blurb: '原创短篇与写作练习',
  }),
  Object.freeze({
    slug: 'quiet_orbit',
    label: '静默轨道',
    blurb: '阳台天文与夜空记录',
  }),
]);

export const POSTS = Object.freeze([
  Object.freeze({
    id: 'mc-001',
    subreddit: 'mossy_circuits',
    title: '用废键盘做的苔藓灯，附电路草图',
    createdAt: '2026-08-14T09:30:00.000Z',
    score: 412,
    upvoteRatio: 0.94,
    commentCount: 37,
  }),
  Object.freeze({
    id: 'mc-002',
    subreddit: 'mossy_circuits',
    title: '"低功耗"电台，真的能撑过一周吗？',
    createdAt: '2026-09-02T18:05:00.000Z',
    score: 208,
    upvoteRatio: 0.89,
    commentCount: 51,
  }),
  Object.freeze({
    id: 'mc-003',
    subreddit: 'mossy_circuits',
    title: 'Field notes: moss, copper, and a rainy weekend',
    createdAt: '2026-09-28T07:15:00.000Z',
    score: 156,
    upvoteRatio: 0.91,
    commentCount: 18,
  }),
  Object.freeze({
    id: 'mc-004',
    subreddit: 'mossy_circuits',
    title: '教程：把旧路由器改成温湿度记录仪（含逗号与引号测试："A/B, C"）',
    createdAt: '2026-10-19T13:45:00.000Z',
    score: 341,
    upvoteRatio: 0.96,
    commentCount: 64,
  }),
  Object.freeze({
    id: 'mc-005',
    subreddit: 'mossy_circuits',
    title: '一条关于走线的笔记，标题里有中文、逗号和"引号"',
    createdAt: '2026-11-05T21:20:00.000Z',
    score: 97,
    upvoteRatio: 0.83,
    commentCount: 12,
  }),
  Object.freeze({
    id: 'pt-001',
    subreddit: 'paper_tides',
    title: '短篇：潮汐图书馆的第七层',
    createdAt: '2026-08-21T11:00:00.000Z',
    score: 689,
    upvoteRatio: 0.97,
    commentCount: 92,
  }),
  Object.freeze({
    id: 'pt-002',
    subreddit: 'paper_tides',
    title: '写作练习："一艘不靠岸的船"',
    createdAt: '2026-09-11T16:40:00.000Z',
    score: 264,
    upvoteRatio: 0.93,
    commentCount: 45,
  }),
  Object.freeze({
    id: 'pt-003',
    subreddit: 'paper_tides',
    title: '编辑笔记：逗号、分号，以及那些没说出口的句子',
    createdAt: '2026-10-03T08:25:00.000Z',
    score: 188,
    upvoteRatio: 0.9,
    commentCount: 27,
  }),
  Object.freeze({
    id: 'pt-004',
    subreddit: 'paper_tides',
    title: '讨论：你心中的安静结局是什么样的？',
    createdAt: '2026-10-27T20:10:00.000Z',
    score: 152,
    upvoteRatio: 0.88,
    commentCount: 73,
  }),
  Object.freeze({
    id: 'pt-005',
    subreddit: 'paper_tides',
    title: '十一月合刊征稿：海风、旧地图与普通话',
    createdAt: '2026-11-12T06:55:00.000Z',
    score: 433,
    upvoteRatio: 0.95,
    commentCount: 58,
  }),
  Object.freeze({
    id: 'qo-001',
    subreddit: 'quiet_orbit',
    title: '第一次拍到猎户座星云，附参数和叠图流程',
    createdAt: '2026-08-30T22:15:00.000Z',
    score: 512,
    upvoteRatio: 0.96,
    commentCount: 41,
  }),
  Object.freeze({
    id: 'qo-002',
    subreddit: 'quiet_orbit',
    title: '"月光太亮" 时怎么拍银河？',
    createdAt: '2026-09-19T23:50:00.000Z',
    score: 305,
    upvoteRatio: 0.92,
    commentCount: 66,
  }),
  Object.freeze({
    id: 'qo-003',
    subreddit: 'quiet_orbit',
    title: '城市阳台观测记录：三个月，二十七次晴天',
    createdAt: '2026-10-12T19:30:00.000Z',
    score: 227,
    upvoteRatio: 0.94,
    commentCount: 29,
  }),
  Object.freeze({
    id: 'qo-004',
    subreddit: 'quiet_orbit',
    title: '整理了一份新手清单，含脚架、遮光罩和一杯热茶',
    createdAt: '2026-11-01T05:45:00.000Z',
    score: 401,
    upvoteRatio: 0.95,
    commentCount: 54,
  }),
  Object.freeze({
    id: 'qo-005',
    subreddit: 'quiet_orbit',
    title: '求助：相机电池在低温下掉电很快，有什么办法？',
    createdAt: '2026-11-18T14:10:00.000Z',
    score: 76,
    upvoteRatio: 0.81,
    commentCount: 22,
  }),
]);

export const DEFAULT_FILTERS = Object.freeze({
  query: '',
  from: '',
  to: '',
  sort: 'newest',
});

export const SORT_OPTIONS = Object.freeze([
  Object.freeze({ value: 'newest', label: '发布时间：最新优先' }),
  Object.freeze({ value: 'oldest', label: '发布时间：最早优先' }),
  Object.freeze({ value: 'score-desc', label: '净赞分：从高到低' }),
  Object.freeze({ value: 'score-asc', label: '净赞分：从低到高' }),
]);

export function getSubreddit(slug) {
  return SUBREDDITS.find((subreddit) => subreddit.slug === slug);
}

function normalizeQuery(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^r\//, '');
}

function matchesQuery(post, query) {
  if (!query) return true;
  const subreddit = getSubreddit(post.subreddit);
  const haystack = [
    post.subreddit,
    post.subreddit.replaceAll('_', ' '),
    subreddit?.label ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function sortPosts(posts, sort) {
  const sorted = [...posts];
  switch (sort) {
    case 'oldest':
      return sorted.sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      );
    case 'score-desc':
      return sorted.sort(
        (a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt),
      );
    case 'score-asc':
      return sorted.sort(
        (a, b) => a.score - b.score || b.createdAt.localeCompare(a.createdAt),
      );
    case 'newest':
    default:
      return sorted.sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      );
  }
}

/**
 * Filter by subreddit search and an inclusive UTC date range, then sort.
 * `from` and `to` are `YYYY-MM-DD` strings.
 */
export function filterPosts(posts, filters = {}) {
  const { query = '', from = '', to = '', sort = DEFAULT_FILTERS.sort } = filters;
  const normalizedQuery = normalizeQuery(query);
  const matched = posts.filter((post) => {
    if (!matchesQuery(post, normalizedQuery)) return false;
    const day = post.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
  return sortPosts(matched, sort);
}

export function countPostsBySubreddit(posts = POSTS) {
  return SUBREDDITS.map((subreddit) => ({
    ...subreddit,
    count: posts.filter((post) => post.subreddit === subreddit.slug).length,
  }));
}
