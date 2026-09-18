const THEME_KEY = 'tta-theme';

export type ThemeMode = 'light' | 'dark';

export function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Explicit preference if set; otherwise null (follow system). */
export function loadStoredTheme(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveTheme(stored: ThemeMode | null = loadStoredTheme()): ThemeMode {
  return stored ?? getSystemTheme();
}

export function saveTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}
