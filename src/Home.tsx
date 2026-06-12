import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Theme } from "./App";
import { Brand, ThemeToggle } from "./components";
import { parseRoomId } from "./roomInput";

export function Home({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

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
        <ThemeToggle theme={theme} onClick={toggleTheme} />
      </header>
      <section className="hero">
        <div className="hero-logo"><Brand /></div>
        <h1>Create a room.<br />Share a link.<br />Start typing.</h1>
        <p>A minimal shared document for writing together in real time.</p>
        <button className="primary-button" onClick={createRoom} disabled={creating}>
          {creating ? "Creating..." : "Create room"}
        </button>
        <div className="divider"><span>or join a room</span></div>
        <form className="join-form" onSubmit={joinRoom}>
          <input
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError("");
            }}
            placeholder="Room ID or link"
            aria-label="Room ID or link"
          />
          <button type="submit">Join</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>
      <footer className="home-footer">No accounts. No setup. Just text.</footer>
    </main>
  );
}
