import { useCallback, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme"));

  const toggle = useCallback(() => {
    const isDark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme-pref", next); } catch (e) {}
    setTheme(next);
  }, [theme]);

  return toggle;
}
