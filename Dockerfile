# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data ROOM_TTL_DAYS=30
WORKDIR /app
RUN groupadd --system code-room && useradd --system --gid code-room --home /app code-room \
    && mkdir -p /data && chown code-room:code-room /data
COPY --from=build --chown=code-room:code-room /app/node_modules ./node_modules
COPY --from=build --chown=code-room:code-room /app/dist ./dist
COPY --from=build --chown=code-room:code-room /app/server-dist ./server-dist
COPY --from=build --chown=code-room:code-room /app/package.json ./
USER code-room
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server-dist/index.js"]
