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

/** Seconds → "15m 14s" or "1j 05m 14s" (jam = hour). */
export function formatDurationLong(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0m 00s";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = String(Math.floor(totalSeconds % 60)).padStart(2, "0");
  if (h > 0) return `${h}j ${String(m).padStart(2, "0")}m ${s}s`;
  return `${m}m ${s}s`;
}

/** Bytes → "140 MB", "1.5 GB", "1.95 TB". */
export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "0 MB";
  const mb = bytes / 1024 ** 2;
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  const gb = mb / 1024;
  if (gb < 1000) return `${gb.toFixed(1)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
}

/** "29 Sep 2026" (Malay short month) from an API timestamp. */
export function formatShortDate(value) {
  const ms = parseApiDate(value);
  if (!ms) return "-";
  return new Date(ms).toLocaleDateString("ms-MY", { day: "2-digit", month: "short", year: "numeric" });
}

/** Two-letter initials for an Avatar fallback. */
export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
