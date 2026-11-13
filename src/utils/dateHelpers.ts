/**
 * Date helpers that use the user's LOCAL calendar day.
 *
 * `new Date().toISOString().split('T')[0]` is the UTC day, which is "yesterday" for anyone east of UTC
 * in the early hours (e.g. 01:30 in Addis Ababa) and "tomorrow" for the Americas in the evening.
 */
const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD for the local calendar day of `d`. */
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** HH:MM (24h) for the local time of `d`. */
export function localTimeString(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** YYYY-MM-DD in UTC, for when UTC is what is wanted (e.g. Binance exports). */
export function utcDateString(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function utcTimeString(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
