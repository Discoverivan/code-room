import { mkdirSync, readFileSync } from "node:fs";
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

export function renderPageMetadata(html: string, origin: string, pathname: string) {
  const isRoom = pathname.startsWith("/room/");
  const canonicalUrl = `${origin}/`;
  const pageUrl = isRoom ? `${origin}${pathname}` : canonicalUrl;
  const imageUrl = `${origin}/social-preview.png`;

  return html
    .replace('<meta name="robots" content="index, follow" />', `<meta name="robots" content="${isRoom ? "noindex, nofollow" : "index, follow"}" />`)
    .replace('<link rel="canonical" href="/"', `<link rel="canonical" href="${canonicalUrl}"`)
    .replace('<meta property="og:url" content="/" />', `<meta property="og:url" content="${pageUrl}" />`)
    .replace('<meta property="og:image" content="/social-preview.png" />', `<meta property="og:image" content="${imageUrl}" />`)
    .replace('<meta name="twitter:image" content="/social-preview.png" />', `<meta name="twitter:image" content="${imageUrl}" />`);
}

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
    const indexHtml = readFileSync(path.join(options.staticDir, "index.html"), "utf8");
    await app.register(fastifyStatic, { root: options.staticDir, index: false });
    const sendPage = (request: { protocol: string; headers: { host?: string }; url: string }, reply: { header: (name: string, value: string) => unknown; type: (value: string) => { send: (body: string) => unknown } }) => {
      const origin = `${request.protocol}://${request.headers.host}`;
      const pathname = request.url.split("?")[0];
      if (pathname.startsWith("/room/")) reply.header("X-Robots-Tag", "noindex, nofollow");
      return reply.type("text/html").send(renderPageMetadata(indexHtml, origin, pathname));
    };
    app.get("/", sendPage);
    app.get("/room/:id", sendPage);
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/")) {
        return sendPage(request, reply);
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
