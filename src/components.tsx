import type { Theme } from "./App";
import logo from "./assets/logo.svg";

export function Logo({ hero = false }: { hero?: boolean }) {
  return <img className={hero ? "hero-mark" : "logo"} src={logo} alt="Code Room logo" />;
}

export function Brand() {
  return (
    <span className="brand">
      <Logo />
      <strong>code room</strong>
    </span>
  );
}

export function ThemeToggle({ theme, onClick }: { theme: Theme; onClick: () => void }) {
  return (
    <button className="icon-button" onClick={onClick} aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}>
      {theme === "light" ? (
        <svg className="theme-icon sun-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg className="theme-icon moon-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.4 15.3A9 9 0 0 1 8.7 3.6 9 9 0 1 0 20.4 15.3Z" />
        </svg>
      )}
    </button>
  );
}
