const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function format_relative_date(raw_date, now = new Date()) {
  const date = new Date(raw_date || '');

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const elapsed_ms = Math.max(now.getTime() - date.getTime(), 0);

  if (elapsed_ms < MINUTE_MS) {
    return 'now';
  } else if (elapsed_ms < HOUR_MS) {
    return `${Math.floor(elapsed_ms / MINUTE_MS)}m`;
  } else if (elapsed_ms < DAY_MS) {
    return `${Math.floor(elapsed_ms / HOUR_MS)}h`;
  } else if (elapsed_ms < 7 * DAY_MS) {
    return `${Math.floor(elapsed_ms / DAY_MS)}d`;
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  } else {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
}

export function format_short_date(raw_date) {
  const date = new Date(raw_date || '');

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
