# syntax=docker/dockerfile:1

# ---- build ----
# Node 22 required: @tanstack/start-* packages declare engines >=22.12.0.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps: plain `npm install` hits a real npm/arborist bug with
# this project's bleeding-edge deps (React 19, Vite 8, vitest 4) — see CLAUDE.md.
RUN npm ci --legacy-peer-deps
COPY . .
# Overrides vite.config.ts's default Cloudflare nitro preset with a plain
# Node server build — this app runs on EC2/VPS via Docker, not Cloudflare.
# VITE_API_BASE_URL=/api is relative/same-origin: nginx proxies /api/* to the
# backend container in front of both apps, so no per-environment value or
# CORS config is needed.
ENV NITRO_PRESET=node-server
ENV VITE_API_BASE_URL=/api
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
# Nitro's node-server build traces and bundles its own runtime deps into
# .output/server/node_modules, so no separate node_modules copy is needed.
COPY --from=build /app/.output ./.output
RUN chown -R app:app /app
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
