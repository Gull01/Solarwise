"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY, type Theme } from "@/lib/theme";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked (private mode etc.): the theme still applies for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const OPTIONS: { id: Theme; label: string; icon: React.ReactNode }[] = [
  {
    id: "system",
    label: "System",
    icon: (
      <path d="M4 5h16v11H4zM8 20h8M12 16v4" />
    ),
  },
  {
    id: "light",
    label: "Light",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </>
    ),
  },
  {
    id: "dark",
    label: "Dark",
    icon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  },
];

export default function ThemeToggle() {
  // Server render always shows "system"; the real choice appears right after hydration.
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  return (
    <div className="border-line bg-surface inline-flex rounded-full border p-1 shadow-sm" role="radiogroup" aria-label="Color theme">
      {OPTIONS.map((o) => {
        const active = theme === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${o.label} theme`}
            onClick={() => applyTheme(o.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              active ? "bg-accent-soft text-accent-strong" : "text-muted hover:text-foreground"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {o.icon}
            </svg>
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
