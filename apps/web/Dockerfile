# The web app, built from the repo root so the workspace packages it compiles from source are present.
#
#   docker build -f apps/web/Dockerfile .
#
# The web never signs a trade: it needs the database and a session secret, nothing else.
FROM node:24-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1 NEXT_TELEMETRY_DISABLED=1
# Coolify's health check runs curl; the slim image ships without it.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@11.24.0 --activate
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=shijima-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@desk/web..."
RUN --mount=type=cache,id=shijima-next-cache,target=/app/apps/web/.next/cache \
    pnpm --filter @desk/web build
ENV NODE_ENV=production HOSTNAME=0.0.0.0
EXPOSE 3007
CMD ["pnpm", "--filter", "@desk/web", "start"]
