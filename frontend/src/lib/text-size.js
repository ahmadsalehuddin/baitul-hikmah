// Saiz Teks (spec §8.3.9): four steps applied as the root font-size, so every rem-based
// shadcn size scales together. Values match the backend's `TextSize` enum.
export const TEXT_SIZES = [
  { value: "kecil", label: "Kecil", percent: 87.5 },
  { value: "biasa", label: "Biasa", percent: 100 },
  { value: "besar", label: "Besar", percent: 112.5 },
  { value: "sangat_besar", label: "Sangat Besar", percent: 125 },
];

export const DEFAULT_TEXT_SIZE = "biasa";

// Per-device mirror of the saved preference, only so the page paints at the right size
// before `GET /auth/me` answers. The database value (per user) always wins once loaded.
const STORAGE_KEY = "baitul_hikmah_text_size";

const isValid = (value) => TEXT_SIZES.some((s) => s.value === value);

export function applyTextSize(value) {
  const size = TEXT_SIZES.find((s) => s.value === value) ?? TEXT_SIZES[1];
  document.documentElement.style.fontSize = `${size.percent}%`;
}

export function loadStoredTextSize() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValid(stored) ? stored : DEFAULT_TEXT_SIZE;
  } catch {
    return DEFAULT_TEXT_SIZE;
  }
}

export function storeTextSize(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // localStorage unavailable (private browsing, etc.) - ignore
  }
}

export { isValid as isValidTextSize };
