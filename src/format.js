/** Presentation-only helpers. All times are displayed in UTC for determinism. */

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN');

export function formatUtcTimestamp(isoString) {
  return `${DATE_FORMATTER.format(new Date(isoString))} UTC`;
}

export function formatScore(score) {
  return NUMBER_FORMATTER.format(score);
}

export function formatRatio(ratio) {
  return `${Math.round(ratio * 100)}%`;
}
