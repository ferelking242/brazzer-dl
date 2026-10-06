const STORAGE_KEY = "brazzer-dl.backend.v1";

const ENV_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";

function normalize(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getBackendBaseUrl(): string {
  if (typeof window === "undefined") return normalize(ENV_BASE);
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return normalize(stored);
  } catch {
    // Storage unavailable; fall back to the build-time value.
  }
  return normalize(ENV_BASE);
}

export function setBackendBaseUrl(base: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, normalize(base));
  } catch {
    // Storage unavailable; the value will not persist across reloads.
  }
}

export function clearBackendBaseUrl(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

export function apiUrl(path: string): string {
  const base = getBackendBaseUrl();
  return base ? `${base}${path}` : path;
}

export function isBackendConfigured(): boolean {
  return getBackendBaseUrl().length > 0;
}
