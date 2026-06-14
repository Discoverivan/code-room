import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import type { Theme } from "./App";
import { Brand, ThemeToggle } from "./components";
import { Editor } from "./Editor";
import { participantColor } from "./participantColor";
import { normalizeRoomName, roomNameStorageKey } from "./roomIdentity";
import { ROOM_ID_PATTERN } from "./roomInput";

type Participant = { name: string; color: string };

export function Room({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const savedName = normalizeRoomName(localStorage.getItem(roomNameStorageKey(id)));
  const [exists, setExists] = useState<boolean | null>(null);
  const [connection, setConnection] = useState("Connecting");
  const [online, setOnline] = useState(1);
  const [chars, setChars] = useState(0);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(savedName);
  const [nameInput, setNameInput] = useState(savedName);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const session = useMemo(() => {
    if (!ROOM_ID_PATTERN.test(id)) return null;
    const document = new Y.Doc();
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const provider = new WebsocketProvider(`${protocol}://${location.host}/ws`, id, document, {
      connect: false
    });
    return { document, provider };
  }, [id]);

  const connect = useCallback((currentSession: NonNullable<typeof session>, userName: string) => {
    const user = {
      color: participantColor(userName),
      colorLight: "#ffffff",
      name: userName
    };
    currentSession.provider.connect();
    currentSession.provider.awareness.setLocalStateField("user", user);
    setParticipants([user]);
    setOnline(1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rooms/${id}`).then((response) => {
      if (cancelled) return;
      setExists(response.ok);
    }).catch(() => setExists(false));
    return () => {
      cancelled = true;
      session?.provider.destroy();
      session?.document.destroy();
    };
  }, [id, session]);

  useEffect(() => {
    if (exists && session && name) connect(session, name);
  }, [connect, exists, session, name]);

  useEffect(() => {
    if (!session) return;
    const updateConnection = ({ status }: { status: string }) =>
      setConnection(status === "connected" ? "Connected" : status === "connecting" ? "Connecting" : "Disconnected");
    const updateOnline = () => {
      const users = [...session.provider.awareness.getStates().values()]
        .map((state) => state.user as Participant | undefined)
        .filter((user): user is Participant => Boolean(user?.name));
      setParticipants(users);
      setOnline(users.length);
    };
    const updateChars = () => setChars(session.document.getText("content").length);
    session.provider.on("status", updateConnection);
    session.provider.awareness.on("change", updateOnline);
    session.document.getText("content").observe(updateChars);
    updateOnline();
    updateChars();
    return () => {
      session.provider.off("status", updateConnection);
      session.provider.awareness.off("change", updateOnline);
      session.document.getText("content").unobserve(updateChars);
    };
  }, [session]);

  useEffect(() => {
    if (!shareOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShareOpen(false);
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target as Element).closest(".share-control")) setShareOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [shareOpen]);

  const updateCursor = useCallback((value: { line: number; column: number }) => setCursor(value), []);

  async function copyShareLink() {
    await navigator.clipboard.writeText(location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function submitName(event: FormEvent) {
    event.preventDefault();
    const value = normalizeRoomName(nameInput);
    if (!value || !session) return;
    localStorage.setItem(roomNameStorageKey(id), value);
    setName(value);
  }

  if (exists === null) return <main className="center-state">Opening room...</main>;
  if (!exists || !session) {
    return (
      <main className="center-state">
        <Brand />
        <h1>Room not found</h1>
        <p>This room does not exist or has expired.</p>
        <button className="primary-button" onClick={() => navigate("/")}>Create a new room</button>
      </main>
    );
  }
  if (!name) {
    return (
      <main className="name-screen">
        <form className="name-card" onSubmit={submitName}>
          <Link className="brand-link" to="/" aria-label="Go to home">
            <Brand />
          </Link>
          <h1>What should we call you?</h1>
          <p>Your name is visible only to people in this room.</p>
          <input autoFocus maxLength={32} value={nameInput} onChange={(event) => setNameInput(event.target.value)} placeholder="Your name" aria-label="Your name" />
          <button className="primary-button" type="submit" disabled={!nameInput.trim()}>Enter room</button>
        </form>
      </main>
    );
  }

  return (
    <main className="room">
      <header className="room-header">
        <Link className="brand-link" to="/" aria-label="Go to home">
          <Brand />
        </Link>
        <span className="room-id">{id}</span>
        <div className="room-actions">
          <div className="participants" aria-label={`${online} online`}>
            {participants.slice(0, 5).map((participant, index) => (
              <span key={`${participant.name}-${index}`} title={participant.name} style={{ background: participant.color }}>{participant.name[0].toUpperCase()}</span>
            ))}
          </div>
          <div className="share-control">
            <button className="copy-button" onClick={() => setShareOpen((open) => !open)} aria-expanded={shareOpen}>Share</button>
            {shareOpen && (
              <section className="share-popover" role="dialog" aria-labelledby="share-title">
                <h2 id="share-title">Share this room</h2>
                <p>Send this link to another participant.</p>
                <span className="share-value">
                  <input readOnly value={location.href} onFocus={(event) => event.currentTarget.select()} aria-label="Room link" />
                  <button onClick={copyShareLink}>{copied ? "Copied" : "Copy"}</button>
                </span>
                <small>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
                  </svg>
                  Anyone with the link can join.
                </small>
              </section>
            )}
          </div>
          <ThemeToggle theme={theme} onClick={toggleTheme} />
        </div>
      </header>
      <Editor document={session.document} provider={session.provider} theme={theme} onCursor={updateCursor} />
      <footer className="statusbar">
        <span className={`connection ${connection.toLowerCase()}`}>{connection}</span>
        <span>Line {cursor.line}, Column {cursor.column}</span>
        <span>{chars} chars</span>
      </footer>
    </main>
  );
}
