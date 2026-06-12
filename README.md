# Code Room

Create a room. Share a link. Start typing.

Code Room is a minimal self-hosted real-time collaborative text editor. It has
no accounts, projects, formatting, syntax highlighting, chat, or external
services.

## Run

```bash
docker run -d \
  --name code-room \
  -p 8080:8080 \
  -v code-room-data:/data \
  ghcr.io/discoverivan/code-room:latest
```

Open [http://localhost:8080](http://localhost:8080).

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP and WebSocket port |
| `DATA_DIR` | `/data` | Directory containing the SQLite database |
| `ROOM_TTL_DAYS` | `30` | Days of inactivity before a room is removed |

## Development

Requires Node.js 22.

```bash
npm ci
npm run dev
```

The client runs on `http://localhost:5173` and proxies API/WebSocket requests
to the server on port `8080`.

```bash
npm run lint
npm run typecheck
npm test
npm run build
docker build -t code-room .
```

## Releases

Every push to `main` creates the next semantic version from conventional
commits and publishes a GitHub release. Breaking changes bump the major
version, `feat` commits bump the minor version, and all other commits bump the
patch version. Versioning starts at `v0.1.0`.

Each release automatically publishes public Linux AMD64 and ARM64 images such
as `0.1.0`, `0.1`, `0`, and `latest` to `ghcr.io/discoverivan/code-room`.

Pushing a semantic version tag manually also runs the container publishing
workflow.

## License

MIT
