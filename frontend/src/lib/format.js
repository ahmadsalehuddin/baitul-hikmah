// Shared display formatters (Bahasa Melayu).

/** Seconds → "19:23" or "1:02:03". */
export function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * The API returns UTC timestamps without a zone suffix; treat them as UTC
 * (a bare `new Date("2026-09-28T02:00:00")` would be read as local time).
 */
export function parseApiDate(value) {
  if (!value) return 0;
  const hasZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(value);
  const ms = Date.parse(hasZone ? value : `${value}Z`);
  return Number.isNaN(ms) ? 0 : ms;
}

/** "Hari ini", "Semalam", "4 hari lalu", "1 minggu lalu", "3 bulan lalu", "2 tahun lalu". */
export function formatRelativeDate(value, now = Date.now()) {
  const ms = parseApiDate(value);
  if (!ms) return "";
  const days = Math.floor((now - ms) / 86_400_000);
  if (days <= 0) return "Hari ini";
  if (days === 1) return "Semalam";
  if (days < 7) return `${days} hari lalu`;
  if (days < 30) return `${Math.floor(days / 7)} minggu lalu`;
  if (days < 365) return `${Math.floor(days / 30)} bulan lalu`;
  return `${Math.floor(days / 365)} tahun lalu`;
}
