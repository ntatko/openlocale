# openlocale — single-container self-host image (SvelteKit + API in one process)
#
#   docker run -p 3000:3000 -v openlocale-data:/data \
#     -e OPENLOCALE_AUTH_SECRET=$(openssl rand -hex 32) \
#     -e OPENLOCALE_BASE_URL=https://locale.example.com \
#     openlocale/openlocale
#
# SQLite persists at /data/openlocale.db by default; point OPENLOCALE_DB_URL
# at postgres://… to use Postgres instead. All config: see .env.example.

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages ./packages
COPY tools ./tools
RUN pnpm install --frozen-lockfile --filter web...
# heap cap keeps the build viable on small builders (2 GiB machines)
RUN NODE_OPTIONS=--max-old-space-size=1536 pnpm --filter web build
# self-contained production deploy (app + prod node_modules only)
RUN pnpm --filter web --prod deploy /out

FROM node:22-slim
ENV NODE_ENV=production \
    PORT=3000 \
    OPENLOCALE_DB_URL=file:/data/openlocale.db \
    OPENLOCALE_MIGRATIONS_DIR=/app/migrations
WORKDIR /app
COPY --from=build /app/apps/web/build ./build
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /app/packages/db/migrations ./migrations
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
VOLUME /data
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "build"]
