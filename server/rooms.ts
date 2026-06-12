import Database from "better-sqlite3";
import { customAlphabet } from "nanoid";
import * as Y from "yjs";

const createId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-", 16);
export const ROOM_ID_PATTERN = /^[\w-]{16}$/;

export type RoomStore = ReturnType<typeof createRoomStore>;

export function createRoomStore(databasePath: string) {
  const db = new Database(databasePath);
  let closed = false;
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      document BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      last_activity INTEGER NOT NULL
    )
  `);

  const insert = db.prepare(
    "INSERT INTO rooms (id, document, created_at, last_activity) VALUES (?, ?, ?, ?)"
  );
  const find = db.prepare("SELECT document FROM rooms WHERE id = ?");
  const save = db.prepare("UPDATE rooms SET document = ?, last_activity = ? WHERE id = ?");
  const findExpired = db.prepare("SELECT id FROM rooms WHERE last_activity < ?");
  const remove = db.prepare("DELETE FROM rooms WHERE id = ?");
  const touch = db.prepare("UPDATE rooms SET last_activity = ? WHERE id = ?");

  return {
    create() {
      let id = createId();
      while (find.get(id)) id = createId();
      const now = Date.now();
      insert.run(id, Buffer.from(Y.encodeStateAsUpdate(new Y.Doc())), now, now);
      return id;
    },
    exists(id: string) {
      return Boolean(find.get(id));
    },
    load(id: string) {
      const row = find.get(id) as { document: Buffer } | undefined;
      if (!row) return null;
      const document = new Y.Doc();
      Y.applyUpdate(document, new Uint8Array(row.document));
      return document;
    },
    save(id: string, document: Y.Doc) {
      if (closed) return;
      save.run(Buffer.from(Y.encodeStateAsUpdate(document)), Date.now(), id);
    },
    touch(id: string) {
      if (closed) return;
      touch.run(Date.now(), id);
    },
    cleanup(ttlDays: number, activeIds: Set<string> = new Set()) {
      const rows = findExpired.all(Date.now() - ttlDays * 24 * 60 * 60 * 1000) as { id: string }[];
      let changes = 0;
      for (const row of rows) {
        if (!activeIds.has(row.id)) changes += remove.run(row.id).changes;
      }
      return changes;
    },
    close() {
      closed = true;
      db.close();
    }
  };
}
