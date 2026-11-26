/**
 * Local credit wallet.
 *
 * The wallet is intentionally framework-free so it can be reused or swapped
 * for a real payment integration later. All mutations are synchronous and
 * persisted after every change.
 */

export const EXPORT_PRICE = 3;
export const TOP_UP_AMOUNTS = Object.freeze([10, 25]);
export const WALLET_STORAGE_KEY = 'reddit-archive-demo.wallet.v1';
export const WALLET_VERSION = 1;
const MAX_PROCESSED_REQUESTS = 250;

function defaultCreateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyState() {
  return {
    version: WALLET_VERSION,
    balance: 0,
    transactions: [],
    processedRequests: [],
  };
}

function isTransaction(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.requestId === 'string' &&
    (value.type === 'topup' || value.type === 'export') &&
    Number.isInteger(value.amount) &&
    Number.isInteger(value.balanceAfter) &&
    value.balanceAfter >= 0 &&
    typeof value.at === 'string' &&
    typeof value.description === 'string'
  );
}

function parseState(raw) {
  if (!raw) return emptyState();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyState();
  }
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    parsed.version !== WALLET_VERSION ||
    !Number.isInteger(parsed.balance) ||
    parsed.balance < 0 ||
    !Array.isArray(parsed.transactions) ||
    !parsed.transactions.every(isTransaction) ||
    !Array.isArray(parsed.processedRequests) ||
    !parsed.processedRequests.every((id) => typeof id === 'string')
  ) {
    return emptyState();
  }
  const last = parsed.transactions.at(-1);
  if (last && last.balanceAfter !== parsed.balance) {
    return emptyState();
  }
  if (!last && parsed.balance !== 0) {
    return emptyState();
  }
  return {
    version: WALLET_VERSION,
    balance: parsed.balance,
    transactions: parsed.transactions,
    processedRequests: parsed.processedRequests,
  };
}

function cloneTransaction(transaction) {
  return { ...transaction };
}

function requireRequestId(requestId) {
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw new TypeError('A non-empty requestId is required.');
  }
}

/**
 * Create a wallet bound to a Web Storage-like adapter (`getItem`/`setItem`).
 * Passing `storage: null` keeps the wallet in memory, which keeps the demo
 * usable when localStorage is blocked.
 */
export function createWallet({
  storage = null,
  storageKey = WALLET_STORAGE_KEY,
  now = () => new Date(),
  createId = defaultCreateId,
} = {}) {
  let persistenceError = null;
  let state = emptyState();

  if (storage) {
    try {
      state = parseState(storage.getItem(storageKey));
    } catch (error) {
      persistenceError = error;
    }
  }

  const listeners = new Set();

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(storageKey, JSON.stringify(state));
      persistenceError = null;
    } catch (error) {
      persistenceError = error;
    }
  }

  function notify() {
    const snapshot = getState();
    for (const listener of listeners) listener(snapshot);
  }

  function commit(nextState, requestId) {
    state = {
      ...nextState,
      processedRequests: [...state.processedRequests, requestId].slice(
        -MAX_PROCESSED_REQUESTS,
      ),
    };
    persist();
    notify();
  }

  function getState() {
    return {
      balance: state.balance,
      transactions: state.transactions.map(cloneTransaction),
    };
  }

  function hasProcessed(requestId) {
    return state.processedRequests.includes(requestId);
  }

  function topUp(amount, requestId = createId()) {
    if (!Number.isInteger(amount) || !TOP_UP_AMOUNTS.includes(amount)) {
      throw new RangeError(`Top-up amount must be one of ${TOP_UP_AMOUNTS.join(', ')}.`);
    }
    requireRequestId(requestId);

    if (hasProcessed(requestId)) {
      return { ok: true, duplicate: true, balance: state.balance, transaction: null };
    }

    const transaction = {
      id: createId(),
      requestId,
      type: 'topup',
      amount,
      balanceAfter: state.balance + amount,
      at: now().toISOString(),
      description: `模拟充值 ${amount} 积分`,
    };
    commit(
      {
        version: WALLET_VERSION,
        balance: transaction.balanceAfter,
        transactions: [...state.transactions, transaction],
      },
      requestId,
    );
    return {
      ok: true,
      duplicate: false,
      balance: transaction.balanceAfter,
      transaction: cloneTransaction(transaction),
    };
  }

  function spendForExport(requestId = createId(), { rowCount = 0 } = {}) {
    requireRequestId(requestId);

    if (hasProcessed(requestId)) {
      return { ok: true, duplicate: true, balance: state.balance, transaction: null };
    }

    if (state.balance < EXPORT_PRICE) {
      return {
        ok: false,
        reason: 'insufficient_balance',
        balance: state.balance,
        required: EXPORT_PRICE,
      };
    }

    const transaction = {
      id: createId(),
      requestId,
      type: 'export',
      amount: -EXPORT_PRICE,
      balanceAfter: state.balance - EXPORT_PRICE,
      at: now().toISOString(),
      description: `导出 ${rowCount} 行 CSV`,
    };
    commit(
      {
        version: WALLET_VERSION,
        balance: transaction.balanceAfter,
        transactions: [...state.transactions, transaction],
      },
      requestId,
    );
    return {
      ok: true,
      duplicate: false,
      balance: transaction.balanceAfter,
      transaction: cloneTransaction(transaction),
    };
  }

  return {
    getState,
    getPersistenceError: () => persistenceError,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    topUp,
    spendForExport,
  };
}
