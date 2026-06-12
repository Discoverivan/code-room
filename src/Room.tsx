import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import type { Theme } from "./App";
import { Brand, ThemeToggle } from "./components";
import { Editor } from "./Editor";
import { ROOM_ID_PATTERN } from "./roomInput";

const colors = ["#7c5cff", "#36a269", "#2589ff", "#d97706", "#db4b74", "#00a5a8"];

export function Room({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [exists, setExists] = useState<boolean | null>(null);
  const [connection, setConnection] = useState("Connecting");
  const [online, setOnline] = useState(1);
  const [chars, setChars] = useState(0);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [copied, setCopied] = useState(false);

  const session = useMemo(() => {
    if (!ROOM_ID_PATTERN.test(id)) return null;
    const document = new Y.Doc();
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const provider = new WebsocketProvider(`${protocol}://${location.host}/ws`, id, document, {
      connect: false
    });
    return { document, provider };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rooms/${id}`).then((response) => {
      if (cancelled) return;
      setExists(response.ok);
      if (response.ok && session) {
        session.provider.connect();
        session.provider.awareness.setLocalStateField("user", {
          color: colors[Math.floor(Math.random() * colors.length)],
          name: ""
        });
      }
    }).catch(() => setExists(false));
    return () => {
      cancelled = true;
      session?.provider.destroy();
      session?.document.destroy();
    };
  }, [id, session]);

  useEffect(() => {
    if (!session) return;
    const updateConnection = ({ status }: { status: string }) =>
      setConnection(status === "connected" ? "Connected" : status === "connecting" ? "Connecting" : "Disconnected");
    const updateOnline = () => setOnline(session.provider.awareness.getStates().size);
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

  const updateCursor = useCallback((value: { line: number; column: number }) => setCursor(value), []);

  async function copyLink() {
    await navigator.clipboard.writeText(location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

  return (
    <main className="room">
      <header className="room-header">
        <Brand />
        <span className="room-id">Room: <strong>{id}</strong></span>
        <div className="room-actions">
          <span className="online"><i /> {online} online</span>
          <button className="copy-button" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
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
