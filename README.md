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

Release Please maintains a release pull request from conventional commits.
Merging it creates a GitHub release and semantic version tag, starting with
`v0.1.0`. The release automatically publishes public Linux AMD64 and ARM64
images such as `0.1.0`, `0.1`, `0`, and `latest` to
`ghcr.io/discoverivan/code-room`.

Pushing a semantic version tag manually also runs the container publishing
workflow.

## License

MIT
