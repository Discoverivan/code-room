import type { Theme } from "./App";

export function Logo() {
  return (
    <span className="logo" aria-label="Code Room logo">
      <span />
      <span />
    </span>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <Logo />
      <strong>Code Room</strong>
    </span>
  );
}

export function ThemeToggle({ theme, onClick }: { theme: Theme; onClick: () => void }) {
  return (
    <button className="icon-button" onClick={onClick} aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}>
      {theme === "light" ? "◐" : "◑"}
    </button>
  );
}
