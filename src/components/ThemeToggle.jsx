import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "fractoscan_theme";

function getStoredTheme() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() => getStoredTheme() || "dark");

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures (private mode, etc.)
    }
  }, [theme]);

  const nextTheme = useMemo(() => (theme === "light" ? "dark" : "light"), [theme]);

  return (
    <div className="theme-toggle">
      <button
        type="button"
        className="btn secondary small theme-toggle-btn"
        onClick={() => setTheme(nextTheme)}
        aria-label={`Switch to ${nextTheme} mode`}
        title={`Switch to ${nextTheme} mode`}
      >
        <span className="theme-toggle-icon" aria-hidden="true">
          {theme === "light" ? "🌙" : "☀️"}
        </span>
        <span className="theme-toggle-label">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
      </button>
    </div>
  );
}

export default ThemeToggle;
