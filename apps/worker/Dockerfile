# The worker: the engine's timer, the OpenServ agent, the Telegram bot and the gift sender, in one process.
#
#   docker build -f apps/worker/Dockerfile .
#
# The OpenServ credentials file is gitignored, so the deploy passes it as OPENSERV_STATE_JSON and the
# container writes it where the worker reads it.
FROM node:24-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@11.24.0 --activate
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=shijima-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@desk/worker..."
WORKDIR /app/apps/worker
CMD ["sh", "-c", "if [ -n \"$OPENSERV_STATE_JSON\" ]; then umask 077; printf '%s' \"$OPENSERV_STATE_JSON\" > .openserv.json; fi; exec pnpm start"]
