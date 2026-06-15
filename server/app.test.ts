import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, renderPageMetadata } from "./app.js";

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

describe("page metadata", () => {
  const html = `
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="/" vite-ignore />
    <meta property="og:url" content="/" />
    <meta property="og:image" content="/social-preview.png" />
    <meta name="twitter:image" content="/social-preview.png" />
  `;

  it("keeps room links shareable without allowing indexing", () => {
    const rendered = renderPageMetadata(html, "https://code-room.example", "/room/example");

    expect(rendered).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(rendered).toContain('<link rel="canonical" href="https://code-room.example/"');
    expect(rendered).toContain('<meta property="og:url" content="https://code-room.example/room/example" />');
    expect(rendered).toContain('<meta property="og:image" content="https://code-room.example/social-preview.png" />');
  });

  it("serves room metadata and noindex headers before JavaScript runs", async () => {
    const staticDir = dataDir();
    writeFileSync(path.join(staticDir, "index.html"), html);
    const app = await buildApp({ dataDir: dataDir(), staticDir });
    const response = await app.inject({
      method: "GET",
      url: "/room/example",
      headers: { host: "code-room.example" }
    });

    expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response.body).toContain('<meta property="og:url" content="http://code-room.example/room/example" />');
    await app.close();
  });

  it("serves indexable metadata on the landing page", async () => {
    const staticDir = dataDir();
    writeFileSync(path.join(staticDir, "index.html"), html);
    const app = await buildApp({ dataDir: dataDir(), staticDir });
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: { host: "code-room.example" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-robots-tag"]).toBeUndefined();
    expect(response.body).toContain('<meta name="robots" content="index, follow" />');
    expect(response.body).toContain('<meta property="og:url" content="http://code-room.example/" />');
    await app.close();
  });
});
