import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import type { Theme } from "./App";
import { Brand } from "./components";
import { Editor } from "./Editor";
import { assignedParticipantColors, participantColor, participantSelectionColor } from "./participantColor";
import { normalizeRoomName, roomNameStorageKey } from "./roomIdentity";
import { ROOM_ID_PATTERN } from "./roomInput";

type Participant = { id: number; name: string; color: string };
type RemoteCursorDisplay = "dot" | "name";

const REMOTE_CURSOR_DISPLAY_KEY = "code-room-remote-cursor-display";

function savedRemoteCursorDisplay(): RemoteCursorDisplay {
  return localStorage.getItem(REMOTE_CURSOR_DISPLAY_KEY) === "dot" ? "dot" : "name";
}

export function Room({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const savedName = normalizeRoomName(localStorage.getItem(roomNameStorageKey(id)));
  const [exists, setExists] = useState<boolean | null>(null);
  const [roomFull, setRoomFull] = useState(false);
  const [connection, setConnection] = useState("Connecting");
  const [online, setOnline] = useState(1);
  const [chars, setChars] = useState(0);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(savedName);
  const [nameInput, setNameInput] = useState(savedName);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteCursorDisplay, setRemoteCursorDisplay] = useState<RemoteCursorDisplay>(savedRemoteCursorDisplay);

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
    const color = participantColor(0);
    const user = {
      color,
      colorLight: participantSelectionColor(color),
      name: userName
    };
    currentSession.provider.awareness.setLocalState({ user });
    const setInitialCursor = (synced = true) => {
      if (!synced || currentSession.provider.awareness.getLocalState()?.cursor != null) return;
      const cursor = Y.createRelativePositionFromTypeIndex(currentSession.document.getText("content"), 0);
      currentSession.provider.awareness.setLocalStateField("cursor", {
        anchor: cursor,
        head: cursor
      });
      currentSession.provider.off("sync", setInitialCursor);
    };
    currentSession.provider.on("sync", setInitialCursor);
    currentSession.provider.connect();
    setInitialCursor(currentSession.provider.synced);
    return { id: currentSession.document.clientID, ...user };
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
    if (!exists || !session || !name) return;
    const user = connect(session, name);
    const updateLocalParticipant = window.setTimeout(() => {
      setParticipants([user]);
      setOnline(1);
    }, 0);
    return () => window.clearTimeout(updateLocalParticipant);
  }, [connect, exists, session, name]);

  useEffect(() => {
    if (!session || !name) return;
    const refreshAwareness = () => {
      const localState = session.provider.awareness.getLocalState();
      if (localState) session.provider.awareness.setLocalState(localState);
    };
    const interval = window.setInterval(refreshAwareness, 10_000);
    document.addEventListener("visibilitychange", refreshAwareness);
    window.addEventListener("focus", refreshAwareness);
    window.addEventListener("pageshow", refreshAwareness);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshAwareness);
      window.removeEventListener("focus", refreshAwareness);
      window.removeEventListener("pageshow", refreshAwareness);
    };
  }, [name, session]);

  useEffect(() => {
    if (!session) return;
    const updateConnection = ({ status }: { status: string }) =>
      setConnection(status === "connected" ? "Connected" : status === "connecting" ? "Connecting" : "Disconnected");
    const updateClose = (event: CloseEvent | null) => {
      if (event?.code === 1013 && event.reason === "Room is full") {
        session.provider.disconnect();
        setRoomFull(true);
      }
    };
    const updateOnline = () => {
      const states = [...session.provider.awareness.getStates().entries()]
        .filter((entry): entry is [number, { user: { name: string; color?: string } }] => Boolean(entry[1].user?.name));
      const colors = assignedParticipantColors(states.map(([clientId, state]) => ({
        id: clientId,
        color: state.user.color
      })));
      const users = states.map(([clientId, state]) => ({
        id: clientId,
        name: state.user.name,
        color: colors.get(clientId)!
      }));
      const local = users.find((user) => user.id === session.document.clientID);
      const localState = session.provider.awareness.getLocalState();
      if (local && localState?.user?.color !== local.color) {
        session.provider.awareness.setLocalStateField("user", {
          ...localState?.user,
          color: local.color,
          colorLight: participantSelectionColor(local.color)
        });
      }
      setParticipants(users);
      setOnline(users.length);
    };
    const updateChars = () => setChars(session.document.getText("content").length);
    session.provider.on("status", updateConnection);
    session.provider.on("connection-close", updateClose);
    session.provider.awareness.on("change", updateOnline);
    session.document.getText("content").observe(updateChars);
    updateOnline();
    updateChars();
    return () => {
      session.provider.off("status", updateConnection);
      session.provider.off("connection-close", updateClose);
      session.provider.awareness.off("change", updateOnline);
      session.document.getText("content").unobserve(updateChars);
    };
  }, [session]);

  useEffect(() => {
    if (!shareOpen && !settingsOpen && !leaveOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShareOpen(false);
        setSettingsOpen(false);
        setLeaveOpen(false);
      }
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target as Element).closest(".popover-control")) {
        setShareOpen(false);
        setSettingsOpen(false);
        setLeaveOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [leaveOpen, settingsOpen, shareOpen]);

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

  function updateRemoteCursorDisplay(value: RemoteCursorDisplay) {
    localStorage.setItem(REMOTE_CURSOR_DISPLAY_KEY, value);
    setRemoteCursorDisplay(value);
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
  if (roomFull) {
    return (
      <main className="center-state">
        <Brand />
        <h1>Room is full</h1>
        <p>This room already has the maximum of 10 participants.</p>
        <button className="primary-button" onClick={() => navigate("/")}>Back to home</button>
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
        <div className="room-brand" aria-label="Code Room">
          <Brand />
        </div>
        <div className="room-actions">
          <div className="participants" aria-label={`${online} online`}>
            {participants.slice(0, 5).map((participant) => (
              <span
                key={participant.id}
                aria-label={participant.name}
                data-name={participant.name}
                style={{ background: participant.color }}
              >
                {participant.name[0].toUpperCase()}
              </span>
            ))}
          </div>
          <div className="room-control-group">
            <div className="share-control popover-control">
              <button className="copy-button" onClick={() => {
                setSettingsOpen(false);
                setLeaveOpen(false);
                setShareOpen((open) => !open);
              }} aria-expanded={shareOpen}>Share</button>
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
            <div className="settings-control popover-control">
              <button className="icon-button" onClick={() => {
                setShareOpen(false);
                setLeaveOpen(false);
                setSettingsOpen((open) => !open);
              }} aria-label="Settings" aria-expanded={settingsOpen}>
                <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7.6Z" />
                </svg>
              </button>
              {settingsOpen && (
                <section className="settings-popover" role="dialog" aria-labelledby="settings-title">
                  <h2 id="settings-title">Settings</h2>
                  <p>Customize remote cursors and room appearance.</p>
                  <label>
                    <input type="radio" name="remote-cursor-display" checked={remoteCursorDisplay === "dot"} onChange={() => updateRemoteCursorDisplay("dot")} />
                    <span><strong>Dot</strong><small>Show the name on hover</small></span>
                  </label>
                  <label>
                    <input type="radio" name="remote-cursor-display" checked={remoteCursorDisplay === "name"} onChange={() => updateRemoteCursorDisplay("name")} />
                    <span><strong>Full name</strong><small>Always show the name</small></span>
                  </label>
                  <div className="settings-divider" />
                  <button className="theme-setting" onClick={toggleTheme}>
                    <span><strong>Theme</strong><small>Use {theme === "light" ? "dark" : "light"} theme</small></span>
                    <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
                      {theme === "light" ? (
                        <path d="M20.4 15.3A9 9 0 0 1 8.7 3.6 9 9 0 1 0 20.4 15.3Z" />
                      ) : (
                        <>
                          <circle cx="12" cy="12" r="4" />
                          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41" />
                        </>
                      )}
                    </svg>
                  </button>
                </section>
              )}
            </div>
          </div>
          <span className="room-action-divider" aria-hidden="true" />
          <div className="leave-room-control popover-control">
            <button className="leave-room-button" onClick={() => {
              setShareOpen(false);
              setSettingsOpen(false);
              setLeaveOpen((open) => !open);
            }} aria-expanded={leaveOpen}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 5 3 12l7 7M3 12h14M17 5h4v14h-4" />
              </svg>
              Leave room
            </button>
            {leaveOpen && (
              <section className="leave-popover" role="dialog" aria-labelledby="leave-title">
                <h2 id="leave-title">Leave this room?</h2>
                <p>You can return later using the same room link.</p>
                <div>
                  <button onClick={() => setLeaveOpen(false)}>Stay</button>
                  <Link to="/">Leave room</Link>
                </div>
              </section>
            )}
          </div>
        </div>
      </header>
      <Editor
        document={session.document}
        provider={session.provider}
        theme={theme}
        localCursorColor={participants.find((participant) => participant.id === session.document.clientID)?.color ?? participantColor(0)}
        showRemoteNames={remoteCursorDisplay === "name"}
        onCursor={updateCursor}
      />
      <footer className="statusbar">
        <span className={`connection ${connection.toLowerCase()}`}>{connection}</span>
        <span>Line {cursor.line}, Column {cursor.column}</span>
        <span>{chars} chars</span>
      </footer>
    </main>
  );
}
