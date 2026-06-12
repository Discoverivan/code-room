import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const app = await buildApp({
  dataDir: process.env.DATA_DIR ?? path.resolve(currentDir, "../.data"),
  ttlDays: Number(process.env.ROOM_TTL_DAYS ?? 30),
  staticDir: path.resolve(currentDir, "../dist")
});

await app.listen({
  port: Number(process.env.PORT ?? 8080),
  host: "0.0.0.0"
});
