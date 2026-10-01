"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
export const THEME_KEY = "vendo-theme";

function readSaved(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  function apply(next: Theme, save: boolean) {
    document.documentElement.dataset.theme = next;
    setTheme(next);
    if (save) {
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* private mode: theme still applies for this visit */
      }
    }
  }

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    // Follow the OS setting live until the visitor makes an explicit choice.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!readSaved()) apply(e.matches ? "dark" : "light", false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="theme-toggle" onClick={() => apply(next, true)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}
