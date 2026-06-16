import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Theme } from "./App";
import { Brand, Logo, ThemeToggle } from "./components";
import { normalizeRoomName, roomNameStorageKey } from "./roomIdentity";
import githubInvertocat from "./assets/github-invertocat.svg";
import noSignupIcon from "./assets/no-signup-icon.svg";
import privateIcon from "./assets/private-icon.svg";
import realTimeIcon from "./assets/real-time-icon.svg";

export function Home({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const navigate = useNavigate();
  const [setupOpen, setSetupOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    const name = normalizeRoomName(nameInput);
    if (!name) return;
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", { method: "POST" });
      if (!response.ok) throw new Error();
      const room = (await response.json()) as { id: string };
      localStorage.setItem(roomNameStorageKey(room.id), name);
      navigate(`/room/${room.id}`);
    } catch {
      setError("Could not create a room. Try again.");
      setCreating(false);
    }
  }

  if (setupOpen) {
    return (
      <main className="name-screen">
        <form className="name-card" onSubmit={createRoom}>
          <button className="brand-link brand-button" type="button" onClick={() => {
          setSetupOpen(false);
          setError("");
          setCreating(false);
        }} aria-label="Back to home">
            <Brand />
          </button>
          <h1>What should we call you?</h1>
          <p>Your name will be shown to people in this room.</p>
          <input
            autoFocus
            maxLength={32}
            value={nameInput}
            onChange={(event) => {
              setNameInput(event.target.value);
              setError("");
            }}
            placeholder="Your name"
            aria-label="Your name"
          />
          <button className="primary-button" type="submit" disabled={!nameInput.trim() || creating}>
            {creating ? "Creating..." : "Create room"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="home">
      <header className="home-header">
        <Brand />
        <div className="home-actions">
          <a className="github-button" href="https://github.com/Discoverivan/code-room" target="_blank" rel="noreferrer">
            <img src={githubInvertocat} alt="" /> GitHub
          </a>
          <ThemeToggle theme={theme} onClick={toggleTheme} />
        </div>
      </header>
      <section className="hero">
        <Logo hero />
        <h1>code room</h1>
        <p>A simple space to code together.</p>
        <button className="primary-button" onClick={() => {
          setSetupOpen(true);
          setError("");
        }}>
          <svg className="cta-sparkle" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2Z" />
            <path d="M19 3v4M17 5h4M5 17v3M3.5 18.5h3" />
          </svg>
          <span>Create New Room</span>
          <svg className="cta-arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        {error && <p className="error">{error}</p>}
      </section>
      <footer className="home-footer">
        <div><img src={noSignupIcon} alt="" /><strong>Open and start coding</strong><span>No signup</span></div>
        <div><img src={realTimeIcon} alt="" /><strong>See changes instantly</strong><span>Real-time</span></div>
        <div><img src={privateIcon} alt="" /><strong>Your room, your link</strong><span>Private</span></div>
      </footer>
    </main>
  );
}
