# code room

[![CI](https://github.com/Discoverivan/code-room/actions/workflows/ci.yml/badge.svg)](https://github.com/Discoverivan/code-room/actions/workflows/ci.yml)
[![Container](https://img.shields.io/badge/ghcr.io-code--room-7166f4?logo=docker&logoColor=white)](https://github.com/Discoverivan/code-room/pkgs/container/code-room)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Create a room. Share a link. Start typing.

`code room` is a minimal self-hosted collaborative editor for running your own
real-time writing or live-coding site. It requires no accounts, external
database, or third-party services.

## Quick start

```bash
docker run -d \
  --name code-room \
  --restart unless-stopped \
  -p 8080:8080 \
  -v code-room-data:/data \
  ghcr.io/discoverivan/code-room:latest
```

Open [http://localhost:8080](http://localhost:8080).

## Docker Compose

```yaml
services:
  code-room:
    image: ghcr.io/discoverivan/code-room:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - code-room-data:/data

volumes:
  code-room-data:
```

The same configuration is available in [`compose.yaml`](compose.yaml):

```bash
docker compose up -d
```

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP and WebSocket port |
| `DATA_DIR` | `/data` | SQLite storage directory |
| `ROOM_TTL_DAYS` | `30` | Delete rooms after this many inactive days |

Persist `/data` in production. Room links act as the access secret.

## Development

Requires Node.js 22.

```bash
npm ci
npm run dev
```

The web app runs at `http://localhost:5173`; the API and WebSocket server run
at `http://localhost:8080`.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md)
before submitting a change. Report security issues according to
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
