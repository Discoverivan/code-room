import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRoomStore, ROOM_ID_PATTERN } from "./rooms.js";

const directories: string[] = [];
function databasePath() {
  const directory = mkdtempSync(path.join(tmpdir(), "code-room-"));
  directories.push(directory);
  return path.join(directory, "test.db");
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("room store", () => {
  it("creates a valid empty room and persists text", () => {
    const store = createRoomStore(databasePath());
    const id = store.create();
    expect(id).toMatch(ROOM_ID_PATTERN);
    const document = store.load(id)!;
    document.getText("content").insert(0, "hello");
    store.save(id, document);
    expect(store.load(id)?.getText("content").toString()).toBe("hello");
    store.close();
  });

  it("removes expired rooms but preserves active rooms", () => {
    const store = createRoomStore(databasePath());
    const removed = store.create();
    const active = store.create();
    expect(store.cleanup(-1, new Set([active]))).toBe(1);
    expect(store.exists(removed)).toBe(false);
    expect(store.exists(active)).toBe(true);
    store.close();
  });
});
