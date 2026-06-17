import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { buildApp } from "./app.js";
import { MAX_ROOM_PARTICIPANTS } from "./realtime.js";

const directories: string[] = [];
function dataDir() {
  const directory = mkdtempSync(path.join(tmpdir(), "code-room-ws-"));
  directories.push(directory);
  return directory;
}

function waitFor(predicate: () => boolean, timeout = 3000) {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeout) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for synchronization"));
      }
    }, 20);
  });
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("real-time collaboration", () => {
  it("synchronizes text between two clients", async () => {
    const app = await buildApp({ dataDir: dataDir() });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("Missing server address");
    const created = await app.inject({ method: "POST", url: "/api/rooms" });
    const { id } = created.json<{ id: string }>();

    const first = new Y.Doc();
    const second = new Y.Doc();
    const url = `ws://127.0.0.1:${address.port}/ws`;
    const firstProvider = new WebsocketProvider(url, id, first, { WebSocketPolyfill: WebSocket, connect: false });
    const secondProvider = new WebsocketProvider(url, id, second, { WebSocketPolyfill: WebSocket, connect: false });
    firstProvider.connect();
    secondProvider.connect();
    firstProvider.awareness.setLocalStateField("user", { name: "Ivan", color: "#111111" });
    secondProvider.awareness.setLocalStateField("user", { name: "Anya", color: "#222222" });

    await waitFor(() => firstProvider.wsconnected && secondProvider.wsconnected);
    await waitFor(
      () => firstProvider.awareness.getStates().size === 2 && secondProvider.awareness.getStates().size === 2
    );
    expect(firstProvider.awareness.getStates().size).toBe(2);
    expect(
      [...firstProvider.awareness.getStates().values()]
        .map((state) => state.user?.name)
        .sort()
    ).toEqual(["Anya", "Ivan"]);
    first.getText("content").insert(0, "shared text");
    await waitFor(() => second.getText("content").toString() === "shared text");

    firstProvider.destroy();
    secondProvider.destroy();
    first.destroy();
    second.destroy();
    await app.close();
  });

  it("keeps an awareness cursor at the same character after concurrent edits", async () => {
    const app = await buildApp({ dataDir: dataDir() });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("Missing server address");
    const created = await app.inject({ method: "POST", url: "/api/rooms" });
    const { id } = created.json<{ id: string }>();

    const first = new Y.Doc();
    const second = new Y.Doc();
    const url = `ws://127.0.0.1:${address.port}/ws`;
    const firstProvider = new WebsocketProvider(url, id, first, { WebSocketPolyfill: WebSocket, connect: false });
    const secondProvider = new WebsocketProvider(url, id, second, { WebSocketPolyfill: WebSocket, connect: false });
    firstProvider.connect();
    secondProvider.connect();

    await waitFor(() => firstProvider.wsconnected && secondProvider.wsconnected);
    first.getText("content").insert(0, "hello world");
    await waitFor(() => second.getText("content").toString() === "hello world");

    const cursor = Y.createRelativePositionFromTypeIndex(first.getText("content"), 5);
    firstProvider.awareness.setLocalStateField("cursor", { anchor: cursor, head: cursor });
    await waitFor(() =>
      [...secondProvider.awareness.getStates().values()].some((state) => state.cursor?.head)
    );
    second.getText("content").insert(0, "say ");
    await waitFor(() => first.getText("content").toString() === "say hello world");

    const remoteCursor = [...secondProvider.awareness.getStates().values()]
      .find((state) => state.cursor?.head)?.cursor;
    const resolved = Y.createAbsolutePositionFromRelativePosition(remoteCursor.head, second);
    expect(resolved?.index).toBe(9);

    firstProvider.destroy();
    secondProvider.destroy();
    first.destroy();
    second.destroy();
    await app.close();
  });

  it("sends the current document and initial cursor awareness to late joiners", async () => {
    const app = await buildApp({ dataDir: dataDir() });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("Missing server address");
    const created = await app.inject({ method: "POST", url: "/api/rooms" });
    const { id } = created.json<{ id: string }>();

    const first = new Y.Doc();
    const second = new Y.Doc();
    const url = `ws://127.0.0.1:${address.port}/ws`;
    const firstProvider = new WebsocketProvider(url, id, first, { WebSocketPolyfill: WebSocket, connect: false });
    const secondProvider = new WebsocketProvider(url, id, second, { WebSocketPolyfill: WebSocket, connect: false });
    const setInitialCursor = (doc: Y.Doc, provider: WebsocketProvider) => {
      const cursor = Y.createRelativePositionFromTypeIndex(doc.getText("content"), 0);
      provider.awareness.setLocalStateField("cursor", { anchor: cursor, head: cursor });
    };
    firstProvider.awareness.setLocalState({ user: { name: "Ivan", color: "#111111" } });
    firstProvider.connect();

    await waitFor(() => firstProvider.wsconnected);
    setInitialCursor(first, firstProvider);
    first.getText("content").insert(0, "existing text");

    secondProvider.awareness.setLocalState({ user: { name: "Anya", color: "#222222" } });
    secondProvider.connect();

    await waitFor(() => secondProvider.wsconnected && second.getText("content").toString() === "existing text");
    setInitialCursor(second, secondProvider);
    await waitFor(() =>
      [...firstProvider.awareness.getStates().values()].some((state) => state.user?.name === "Anya" && state.cursor?.head)
    );

    const remoteCursor = [...firstProvider.awareness.getStates().values()]
      .find((state) => state.user?.name === "Anya")?.cursor;
    const resolved = Y.createAbsolutePositionFromRelativePosition(remoteCursor.head, first);
    expect(resolved?.index).toBe(0);

    firstProvider.destroy();
    secondProvider.destroy();
    first.destroy();
    second.destroy();
    await app.close();
  });

  it("limits rooms to the available participant colors", async () => {
    const app = await buildApp({ dataDir: dataDir() });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("Missing server address");
    const created = await app.inject({ method: "POST", url: "/api/rooms" });
    const { id } = created.json<{ id: string }>();
    const url = `ws://127.0.0.1:${address.port}/ws/${id}`;
    const sockets = Array.from({ length: MAX_ROOM_PARTICIPANTS }, () => new WebSocket(url));

    await Promise.all(sockets.map((socket) => new Promise<void>((resolve) => socket.once("open", resolve))));
    const extra = new WebSocket(url);
    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
      extra.once("close", (code, reason) => resolve({ code, reason: reason.toString() }));
    });

    await expect(closed).resolves.toEqual({ code: 1013, reason: "Room is full" });

    sockets.forEach((socket) => socket.close());
    await app.close();
  });
});
