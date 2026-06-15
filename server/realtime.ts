import type { WebSocket } from "ws";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";
import type { RoomStore } from "./rooms.js";

const messageSync = 0;
const messageAwareness = 1;
export const MAX_ROOM_PARTICIPANTS = 10;

type ActiveRoom = {
  document: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Map<WebSocket, Set<number>>;
  saveTimer?: NodeJS.Timeout;
};

export function createRealtimeServer(store: RoomStore) {
  const rooms = new Map<string, ActiveRoom>();

  const getRoom = (id: string) => {
    let room = rooms.get(id);
    if (room) return room;
    const document = store.load(id);
    if (!document) return null;
    room = {
      document,
      awareness: new awarenessProtocol.Awareness(document),
      clients: new Map()
    };
    room.awareness.setLocalState(null);
    const broadcast = (message: Uint8Array) => {
      for (const client of room!.clients.keys()) {
        if (client.readyState === client.OPEN) client.send(message);
      }
    };
    document.on("update", (update: Uint8Array) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      broadcast(encoding.toUint8Array(encoder));
      clearTimeout(room!.saveTimer);
      room!.saveTimer = setTimeout(() => store.save(id, document), 500);
    });
    room.awareness.on("update", (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: WebSocket | null
    ) => {
      const changed = added.concat(updated, removed);
      if (origin) {
        const controlledIds = room!.clients.get(origin);
        added.forEach((id) => controlledIds?.add(id));
        removed.forEach((id) => controlledIds?.delete(id));
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(room!.awareness, changed)
      );
      broadcast(encoding.toUint8Array(encoder));
    });
    rooms.set(id, room);
    return room;
  };

  return {
    connect(id: string, socket: WebSocket) {
      const room = getRoom(id);
      if (!room) {
        socket.close(1008, "Room not found");
        return;
      }
      if (room.clients.size >= MAX_ROOM_PARTICIPANTS) {
        socket.close(1013, "Room is full");
        return;
      }
      store.touch(id);
      room.clients.set(socket, new Set());
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, room.document);
      socket.send(encoding.toUint8Array(encoder));
      const awarenessIds = [...room.awareness.getStates().keys()];
      if (awarenessIds.length > 0) {
        const awarenessEncoder = encoding.createEncoder();
        encoding.writeVarUint(awarenessEncoder, messageAwareness);
        encoding.writeVarUint8Array(
          awarenessEncoder,
          awarenessProtocol.encodeAwarenessUpdate(room.awareness, awarenessIds)
        );
        socket.send(encoding.toUint8Array(awarenessEncoder));
      }

      socket.on("message", (data: Buffer) => {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const type = decoding.readVarUint(decoder);
        if (type === messageSync) {
          const reply = encoding.createEncoder();
          encoding.writeVarUint(reply, messageSync);
          syncProtocol.readSyncMessage(decoder, reply, room.document, socket);
          if (encoding.length(reply) > 1) socket.send(encoding.toUint8Array(reply));
        } else if (type === messageAwareness) {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(room.awareness, update, socket);
        }
      });
      socket.on("close", () => {
        const ids = [...(room.clients.get(socket) ?? [])];
        room.clients.delete(socket);
        awarenessProtocol.removeAwarenessStates(room.awareness, ids, socket);
        store.save(id, room.document);
        if (room.clients.size === 0) {
          clearTimeout(room.saveTimer);
          rooms.delete(id);
          room.document.destroy();
        }
      });
    },
    activeRoomIds() {
      return new Set([...rooms.entries()].filter(([, room]) => room.clients.size > 0).map(([id]) => id));
    },
    close() {
      for (const [id, room] of rooms) store.save(id, room.document);
    }
  };
}
