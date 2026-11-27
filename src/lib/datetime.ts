const AR_OFFSET_MS = -3 * 60 * 60 * 1000;

function toArDate(iso: string): Date | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + AR_OFFSET_MS);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format: DD/MM/YY HH:mm (Argentina UTC-3, deterministic on SSR & client) */
export function formatArDateTimeShort(iso: string): string {
  const d = toArDate(iso);
  if (!d) return "—";
  const dd = pad2(d.getUTCDate());
  const mm = pad2(d.getUTCMonth() + 1);
  const yy = String(d.getUTCFullYear()).slice(-2);
  const hh = pad2(d.getUTCHours());
  const min = pad2(d.getUTCMinutes());
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

/** Format: DD/MM HH:mm:ss (Argentina UTC-3, deterministic on SSR & client) */
export function formatArClickTime(iso: string): string {
  const d = toArDate(iso);
  if (!d) return "—";
  const dd = pad2(d.getUTCDate());
  const mm = pad2(d.getUTCMonth() + 1);
  const hh = pad2(d.getUTCHours());
  const min = pad2(d.getUTCMinutes());
  const sec = pad2(d.getUTCSeconds());
  return `${dd}/${mm} ${hh}:${min}:${sec}`;
}

/** Format: DD/MM/YYYY HH:mm:ss (Argentina UTC-3, deterministic on SSR & client) */
export function formatArFullDateTime(iso: string): string {
  const d = toArDate(iso);
  if (!d) return "—";
  const dd = pad2(d.getUTCDate());
  const mm = pad2(d.getUTCMonth() + 1);
  const yyyy = d.getUTCFullYear();
  const hh = pad2(d.getUTCHours());
  const min = pad2(d.getUTCMinutes());
  const sec = pad2(d.getUTCSeconds());
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${sec}`;
}

/** Returns hour 0..23 in Argentina UTC-3 */
export function getArHour(iso: string): number {
  const d = toArDate(iso);
  if (!d) return -1;
  return d.getUTCHours();
}
