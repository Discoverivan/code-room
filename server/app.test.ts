import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const directories: string[] = [];
function dataDir() {
  const directory = mkdtempSync(path.join(tmpdir(), "code-room-app-"));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("HTTP API", () => {
  it("creates and finds a room", async () => {
    const app = await buildApp({ dataDir: dataDir() });
    const created = await app.inject({ method: "POST", url: "/api/rooms" });
    expect(created.statusCode).toBe(200);
    const { id } = created.json<{ id: string }>();
    expect((await app.inject({ method: "GET", url: `/api/rooms/${id}` })).statusCode).toBe(200);
    await app.close();
  });

  it("returns 404 for an unknown room", async () => {
    const app = await buildApp({ dataDir: dataDir() });
    const response = await app.inject({ method: "GET", url: "/api/rooms/1234567890abcdef" });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
