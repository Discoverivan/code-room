import { mkdirSync } from "node:fs";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { createRealtimeServer } from "./realtime.js";
import { createRoomStore, ROOM_ID_PATTERN } from "./rooms.js";

export type AppOptions = {
  dataDir: string;
  ttlDays?: number;
  staticDir?: string;
};

export async function buildApp(options: AppOptions) {
  mkdirSync(options.dataDir, { recursive: true });
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  const store = createRoomStore(path.join(options.dataDir, "code-room.db"));
  const realtime = createRealtimeServer(store);

  await app.register(websocket);
  app.get("/health", async () => ({ status: "ok" }));
  app.post("/api/rooms", async (request) => {
    const id = store.create();
    const origin = `${request.protocol}://${request.headers.host}`;
    return { id, url: `${origin}/room/${id}` };
  });
  app.get<{ Params: { id: string } }>("/api/rooms/:id", async (request, reply) => {
    if (!ROOM_ID_PATTERN.test(request.params.id) || !store.exists(request.params.id)) {
      return reply.code(404).send({ error: "Room not found" });
    }
    return { id: request.params.id };
  });
  app.get<{ Params: { id: string } }>(
    "/ws/:id",
    { websocket: true },
    (socket, request) => realtime.connect(request.params.id, socket)
  );

  const cleanup = setInterval(() => {
    store.cleanup(options.ttlDays ?? 30, realtime.activeRoomIds());
  }, 60 * 60 * 1000);
  cleanup.unref();

  if (options.staticDir) {
    await app.register(fastifyStatic, { root: options.staticDir });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "Not found" });
    });
  }

  app.addHook("onClose", async () => {
    clearInterval(cleanup);
    realtime.close();
    store.close();
  });
  return app;
}
