/**
 * Export orchestration: validates the current selection, charges the wallet
 * exactly once per request, and returns the CSV payload for the UI to
 * download. Keeping this out of the DOM layer makes the money rules testable.
 */

import { EXPORT_PRICE } from './wallet.js';
import { csvFilename, toCsv } from './csv.js';

export { EXPORT_PRICE };

export function exportSelection({ rows, wallet, requestId, now = new Date() }) {
  const balance = wallet.getState().balance;

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, reason: 'empty', balance };
  }

  if (balance < EXPORT_PRICE) {
    return {
      ok: false,
      reason: 'insufficient_balance',
      balance,
      required: EXPORT_PRICE,
    };
  }

  const charge = wallet.spendForExport(requestId, { rowCount: rows.length });
  if (!charge.ok) {
    return {
      ok: false,
      reason: charge.reason ?? 'charge_failed',
      balance: charge.balance,
      required: charge.required ?? EXPORT_PRICE,
    };
  }

  return {
    ok: true,
    duplicate: charge.duplicate,
    csv: toCsv(rows),
    filename: csvFilename(now),
    rowCount: rows.length,
    spent: charge.duplicate ? 0 : EXPORT_PRICE,
    balance: charge.balance,
  };
}
