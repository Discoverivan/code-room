import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Theme } from "./App";
import { Brand, Logo, ThemeToggle } from "./components";
import { parseRoomId } from "./roomInput";
import githubInvertocat from "./assets/github-invertocat.svg";
import noSignupIcon from "./assets/no-signup-icon.svg";
import privateIcon from "./assets/private-icon.svg";
import realTimeIcon from "./assets/real-time-icon.svg";

export function Home({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  async function createRoom() {
    setCreating(true);
    try {
      const response = await fetch("/api/rooms", { method: "POST" });
      if (!response.ok) throw new Error();
      const room = (await response.json()) as { id: string };
      navigate(`/room/${room.id}`);
    } catch {
      setError("Could not create a room. Try again.");
      setCreating(false);
    }
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    const id = parseRoomId(input);
    if (!id) {
      setError("Enter a valid room ID or link.");
      return;
    }
    navigate(`/room/${id}`);
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
        <p>A simple space to write together.</p>
        <button className="primary-button" onClick={createRoom} disabled={creating}>
          <span>{creating ? "Creating..." : "Create New Room"}</span><strong>+</strong>
        </button>
        {!joining ? (
          <button className="join-toggle" onClick={() => setJoining(true)}>
            <span>Join Existing Room</span>
            <svg className="join-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 8l4 4-4 4M18 12H8" />
              <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
            </svg>
          </button>
        ) : (
          <form className="join-form" onSubmit={joinRoom}>
            <input autoFocus value={input} onChange={(event) => { setInput(event.target.value); setError(""); }} placeholder="Room ID or link" aria-label="Room ID or link" />
            <button type="submit">Join</button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
      </section>
      <footer className="home-footer">
        <div><strong><img src={noSignupIcon} alt="" />No signup</strong><span>Open and start writing</span></div>
        <div><strong><img src={realTimeIcon} alt="" />Real-time</strong><span>See changes instantly</span></div>
        <div><strong><img src={privateIcon} alt="" />Private</strong><span>Your room, your link</span></div>
      </footer>
    </main>
  );
}
