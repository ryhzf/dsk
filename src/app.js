import {
  DEFAULT_FILTERS,
  POSTS,
  SORT_OPTIONS,
  SUBREDDITS,
  countPostsBySubreddit,
  filterPosts,
  getSubreddit,
} from './catalog.js';
import { createWallet, EXPORT_PRICE } from './wallet.js';
import { createBrowserStorage } from './storage.js';
import { exportSelection } from './export.js';
import { loadSavedFilters, saveFilters } from './filter-store.js';
import {
  formatRatio,
  formatScore,
  formatUtcTimestamp,
} from './format.js';

const { storage, persistent } = createBrowserStorage();
const wallet = createWallet({ storage });

const elements = {
  balanceValue: document.querySelector('#balance-value'),
  lowBalance: document.querySelector('#low-balance'),
  walletStatus: document.querySelector('#wallet-status'),
  storageBadge: document.querySelector('#storage-badge'),
  transactionList: document.querySelector('#transaction-list'),
  transactionCount: document.querySelector('#transaction-count'),
  historyEmpty: document.querySelector('#history-empty'),
  topupButtons: [...document.querySelectorAll('[data-topup]')],
  topupDialog: document.querySelector('#topup-dialog'),
  topupTitle: document.querySelector('#topup-title'),
  topupDesc: document.querySelector('#topup-desc'),
  topupConfirm: document.querySelector('#topup-confirm'),
  chips: document.querySelector('#subreddit-chips'),
  search: document.querySelector('#search'),
  fromDate: document.querySelector('#from-date'),
  toDate: document.querySelector('#to-date'),
  sort: document.querySelector('#sort'),
  clearFilters: document.querySelector('#clear-filters'),
  matchCount: document.querySelector('#match-count'),
  exportBalance: document.querySelector('#export-balance'),
  exportButton: document.querySelector('#export-button'),
  exportStatus: document.querySelector('#export-status'),
  postsBody: document.querySelector('#posts-body'),
  tableWrap: document.querySelector('.table-wrap'),
  emptyState: document.querySelector('#empty-state'),
  emptyClear: document.querySelector('#empty-clear'),
};

let filters = { ...DEFAULT_FILTERS };
let pendingTopUpAmount = null;
let exportLocked = false;

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clearStatus(statusElement) {
  statusElement.hidden = true;
  statusElement.textContent = '';
}

function setStatus(statusElement, kind, message) {
  statusElement.className = `status status--${kind}`;
  statusElement.textContent = message;
  statusElement.hidden = false;
}

function visiblePosts() {
  return filterPosts(POSTS, filters);
}

function syncFiltersFromControls() {
  filters = {
    query: elements.search.value,
    from: elements.fromDate.value,
    to: elements.toDate.value,
    sort: elements.sort.value,
  };
}

function currentSubredditSlug() {
  const query = filters.query.trim().toLowerCase().replace(/^r\//, '');
  if (!query) return '';
  const matches = SUBREDDITS.filter((subreddit) =>
    [subreddit.slug, subreddit.slug.replaceAll('_', ' '), subreddit.label].some(
      (text) => text.toLowerCase().includes(query),
    ),
  );
  // Highlight a chip only when the query unambiguously points at one
  // subreddit; a broad/partial query leaves every specific chip unpressed.
  return matches.length === 1 ? matches[0].slug : null;
}

function updateExportMeta(rowCount) {
  elements.matchCount.textContent = String(rowCount);
  elements.exportBalance.textContent = String(wallet.getState().balance);
}

function makeTransactionItem(transaction) {
  const item = document.createElement('li');
  item.className = `transaction transaction--${transaction.type}`;

  const main = document.createElement('span');
  main.className = 'transaction-main';
  main.textContent = transaction.type === 'topup' ? '模拟充值' : '导出扣费';

  const amount = document.createElement('span');
  amount.className = 'transaction-amount';
  amount.textContent = `${transaction.amount > 0 ? '+' : ''}${transaction.amount}`;

  const meta = document.createElement('span');
  meta.className = 'transaction-meta';
  meta.textContent = formatUtcTimestamp(transaction.at);

  const balance = document.createElement('span');
  balance.className = 'transaction-balance';
  balance.textContent = `余额 ${transaction.balanceAfter} 积分 · ${transaction.description}`;

  item.append(main, amount, meta, balance);
  return item;
}

function renderWallet() {
  const { balance, transactions } = wallet.getState();
  elements.balanceValue.textContent = String(balance);
  elements.exportBalance.textContent = String(balance);
  elements.lowBalance.hidden = balance >= EXPORT_PRICE;

  if (!persistent) {
    elements.storageBadge.textContent = '仅本次会话';
    elements.storageBadge.title = '浏览器禁用了 localStorage，刷新后不会保留。';
  } else if (wallet.getPersistenceError()) {
    elements.storageBadge.textContent = '保存失败';
    elements.storageBadge.title = '无法写入 localStorage，刷新后可能不会保留。';
  } else {
    elements.storageBadge.textContent = '本地保存';
    elements.storageBadge.title = '余额与交易记录保存在此浏览器的 localStorage 中。';
  }

  elements.transactionCount.textContent = `${transactions.length} 笔`;
  elements.transactionList.replaceChildren(
    ...transactions.slice().reverse().map(makeTransactionItem),
  );
  elements.transactionList.hidden = transactions.length === 0;
  elements.historyEmpty.hidden = transactions.length > 0;
}

function buildRow(post) {
  const subreddit = getSubreddit(post.subreddit);
  const row = document.createElement('tr');
  row.dataset.postId = post.id;

  const subredditCell = document.createElement('td');
  subredditCell.className = 'cell-subreddit';
  subredditCell.dataset.label = 'Subreddit';
  const slug = document.createElement('span');
  slug.className = 'subreddit-slug';
  slug.textContent = `r/${post.subreddit}`;
  const label = document.createElement('span');
  label.className = 'subreddit-label';
  label.textContent = subreddit?.label ?? '';
  subredditCell.append(slug, label);

  const titleCell = document.createElement('td');
  titleCell.className = 'cell-title';
  titleCell.dataset.label = '标题';
  const title = document.createElement('span');
  title.className = 'post-title';
  title.textContent = post.title;
  titleCell.append(title);

  const timeCell = document.createElement('td');
  timeCell.className = 'cell-time';
  timeCell.dataset.label = '发布时间';
  const time = document.createElement('time');
  time.dateTime = post.createdAt;
  time.textContent = formatUtcTimestamp(post.createdAt);
  timeCell.append(time);

  const scoreCell = document.createElement('td');
  scoreCell.className = 'cell-number cell-score align-right';
  scoreCell.dataset.label = '净赞分';
  scoreCell.textContent = formatScore(post.score);

  const ratioCell = document.createElement('td');
  ratioCell.className = 'cell-number align-right';
  ratioCell.dataset.label = '赞成比例';
  ratioCell.textContent = formatRatio(post.upvoteRatio);
  ratioCell.title = `upvote_ratio ${post.upvoteRatio}`;

  const commentCell = document.createElement('td');
  commentCell.className = 'cell-number align-right';
  commentCell.dataset.label = '评论数';
  commentCell.textContent = formatScore(post.commentCount);

  row.append(subredditCell, titleCell, timeCell, scoreCell, ratioCell, commentCell);
  return row;
}

function renderCatalog() {
  const rows = visiblePosts();
  elements.postsBody.replaceChildren(...rows.map(buildRow));
  elements.matchCount.textContent = String(rows.length);
  elements.tableWrap.hidden = rows.length === 0;
  elements.emptyState.hidden = rows.length > 0;
  elements.exportBalance.textContent = String(wallet.getState().balance);
}

function renderChips() {
  const activeSlug = currentSubredditSlug();
  const counts = countPostsBySubreddit(POSTS);
  const chips = [
    {
      slug: '',
      label: '全部',
      count: POSTS.length,
    },
    ...counts.map((subreddit) => ({
      slug: subreddit.slug,
      label: subreddit.label,
      count: subreddit.count,
    })),
  ];

  elements.chips.replaceChildren(
    ...chips.map((chip) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.dataset.subreddit = chip.slug;
      button.setAttribute('aria-pressed', String(activeSlug === chip.slug));
      if (chip.slug) button.title = `r/${chip.slug}`;

      const label = document.createElement('span');
      label.textContent = chip.label;
      const count = document.createElement('span');
      count.className = 'chip-count';
      count.textContent = String(chip.count);
      button.append(label, count);
      return button;
    }),
  );
}

function render() {
  renderWallet();
  renderCatalog();
  renderChips();
}

function applyFilterChange() {
  syncFiltersFromControls();
  saveFilters(storage, filters);
  renderCatalog();
  renderChips();
  clearStatus(elements.exportStatus);
}

function resetFilters() {
  elements.search.value = '';
  elements.fromDate.value = '';
  elements.toDate.value = '';
  elements.sort.value = DEFAULT_FILTERS.sort;
  filters = { ...DEFAULT_FILTERS };
  saveFilters(storage, filters);
  renderCatalog();
  renderChips();
  clearStatus(elements.exportStatus);
  elements.search.focus();
}

/**
 * Restore only the persisted community search and date range. Sort order
 * remains a per-page preference, matching the Studio acceptance criteria.
 */
function restoreSavedFilters() {
  const saved = loadSavedFilters(storage);
  filters = {
    ...DEFAULT_FILTERS,
    query: saved.query,
    from: saved.from,
    to: saved.to,
  };
  elements.search.value = saved.query;
  elements.fromDate.value = saved.from;
  elements.toDate.value = saved.to;
  elements.sort.value = DEFAULT_FILTERS.sort;
}

for (const button of elements.topupButtons) {
  button.addEventListener('click', () => {
    const amount = Number(button.dataset.topup);
    pendingTopUpAmount = amount;
    elements.topupTitle.textContent = `确认充值 ${amount} 积分？`;
    elements.topupDesc.textContent = `确认后，${amount} 积分会立即入账且只入账一次。余额与交易记录会保存在当前浏览器中。`;
    elements.topupConfirm.textContent = `确认充值 ${amount} 积分`;
    elements.topupDialog.returnValue = '';
    clearStatus(elements.exportStatus);
    elements.topupDialog.showModal();
  });
}

elements.topupDialog.addEventListener('close', () => {
  const amount = pendingTopUpAmount;
  pendingTopUpAmount = null;
  if (amount === null) return;

  if (elements.topupDialog.returnValue === 'confirm') {
    const result = wallet.topUp(amount, createId());
    if (result.duplicate) {
      setStatus(elements.walletStatus, 'info', '这次充值已经入账，未重复扣加。');
    } else {
      setStatus(
        elements.walletStatus,
        'success',
        `充值成功：+${amount} 积分，当前余额 ${result.balance} 积分。`,
      );
    }
    renderWallet();
  } else {
    setStatus(elements.walletStatus, 'info', `已取消充值 ${amount} 积分，余额未变化。`);
    renderWallet();
  }
});

// Clicking outside the dialog content dismisses it as a cancel.
elements.topupDialog.addEventListener('click', (event) => {
  if (event.target === elements.topupDialog) {
    elements.topupDialog.close('cancel');
  }
});

elements.search.addEventListener('input', applyFilterChange);
elements.fromDate.addEventListener('change', applyFilterChange);
elements.toDate.addEventListener('change', applyFilterChange);
elements.sort.addEventListener('change', applyFilterChange);
elements.clearFilters.addEventListener('click', resetFilters);
elements.emptyClear.addEventListener('click', resetFilters);

elements.chips.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-subreddit]');
  if (!chip) return;
  elements.search.value = chip.dataset.subreddit;
  applyFilterChange();
  elements.search.focus();
});

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

elements.exportButton.addEventListener('click', () => {
  if (exportLocked) return;
  clearStatus(elements.walletStatus);

  const rows = visiblePosts();
  const result = exportSelection({
    rows,
    wallet,
    requestId: createId(),
    now: new Date(),
  });

  if (!result.ok) {
    if (result.reason === 'empty') {
      setStatus(
        elements.exportStatus,
        'warning',
        '没有可导出的匹配行，未扣除积分。调整筛选后再试。',
      );
    } else if (result.reason === 'insufficient_balance') {
      setStatus(
        elements.exportStatus,
        'warning',
        `余额不足：导出需要 ${EXPORT_PRICE} 积分，当前余额 ${result.balance} 积分。请先在钱包充值。`,
      );
    } else {
      setStatus(elements.exportStatus, 'warning', '导出未完成，未扣除积分，请重试。');
    }
    return;
  }

  downloadCsv(result.csv, result.filename);
  setStatus(
    elements.exportStatus,
    'success',
    `导出成功：已下载 ${result.rowCount} 行 CSV，扣除 ${EXPORT_PRICE} 积分，余额 ${result.balance} 积分。`,
  );
  renderWallet();
  updateExportMeta(result.rowCount);

  exportLocked = true;
  elements.exportButton.disabled = true;
  window.setTimeout(() => {
    exportLocked = false;
    elements.exportButton.disabled = false;
  }, 500);
});

// Make the filter form's Enter key apply the current controls instead of
// reloading the page. Changes already apply live, so this is just a safety net.
document.querySelector('#filters').addEventListener('submit', (event) => {
  event.preventDefault();
  applyFilterChange();
});

// Keep the sort select options in sync with the data module's list.
elements.sort.replaceChildren(
  ...SORT_OPTIONS.map((option) => {
    const element = document.createElement('option');
    element.value = option.value;
    element.textContent = option.label;
    return element;
  }),
);

restoreSavedFilters();
render();
