# openlocale — single-container self-host image (SvelteKit + API in one process)
#
#   docker build -t openlocale .
#   docker run -p 3000:3000 -v openlocale-data:/data \
#     -e OPENLOCALE_DB_URL=file:/data/openlocale.db \
#     -e OPENLOCALE_AUTH_SECRET=$(openssl rand -hex 32) \
#     -e OPENLOCALE_BASE_URL=https://locale.example.com \
#     openlocale
#
# For Postgres, point OPENLOCALE_DB_URL at postgres://…

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY tools ./tools
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build
# prune to production deps for the runtime layer
RUN pnpm --filter web --prod deploy --legacy /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/web/build ./build
COPY --from=build /out/node_modules ./node_modules
# drizzle migrations run on boot; they live inside the db package
COPY --from=build /app/packages ./packages
EXPOSE 3000
ENV PORT=3000
VOLUME /data
CMD ["node", "build"]
