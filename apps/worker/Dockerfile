# The worker: the engine's timer, the OpenServ agent, the Telegram bot and the gift sender, in one process.
#
#   docker build -f apps/worker/Dockerfile .
#
#   build:   install the workspace, bundle the worker's TypeScript (it and every @desk package) to JavaScript once
#            (scripts/build.mjs), then `pnpm deploy` a production install.
#   runtime: the bundle, the assets, the migrations and production node_modules, run by `node` as one process — it
#            was sh → pnpm → tsx → node, compiling TypeScript at runtime. The heap is set under the container's limit.
#
# The OpenServ credentials file is gitignored, so the deploy passes it as OPENSERV_STATE_JSON and the
# container writes it where the worker reads it.
FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=shijima-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@desk/worker..."
# The check fails the build if the flat install holds a different version of a package than the bundle was built
# against (scripts/build.mjs --check).
RUN pnpm --filter @desk/worker build \
    && pnpm --filter @desk/worker deploy --prod --legacy --config.node-linker=hoisted /out \
    && node apps/worker/scripts/build.mjs --check /out

FROM node:24-slim
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
# The bundle finds its folders the way the sources did (scripts/build.mjs): the worker's root is /app/apps/worker,
# the migrations sit at /app/packages/db/drizzle.
WORKDIR /app/apps/worker
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /app/apps/worker/assets ./assets
COPY --from=build /app/packages/db/drizzle /app/packages/db/drizzle
CMD ["sh", "-c", "if [ -n \"$OPENSERV_STATE_JSON\" ]; then umask 077; printf '%s' \"$OPENSERV_STATE_JSON\" > .openserv.json; fi; exec node --max-old-space-size=512 --import ./dist/bundle/register.mjs dist/bundle/main.mjs"]
