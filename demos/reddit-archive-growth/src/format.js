/** Locale-stable display helpers. Dates and windows are always UTC. */

const INTEGER_FORMATTER = new Intl.NumberFormat('zh-CN');

export function formatInteger(value) {
  return INTEGER_FORMATTER.format(value);
}

export function formatPercent(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatUtcMinute(ms) {
  return `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function formatUtcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function formatUtcRange(startMs, endMs) {
  return `${formatUtcMinute(startMs)} – ${formatUtcMinute(endMs)}`;
}
