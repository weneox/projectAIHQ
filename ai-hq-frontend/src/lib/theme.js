const KEY = "aihq.theme";

export function getInitialTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  localStorage.setItem(KEY, t);
  return t;
}