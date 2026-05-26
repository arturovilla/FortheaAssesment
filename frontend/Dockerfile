# syntax=docker/dockerfile:1.7
#
# Production-style multi-stage build for the Next.js dashboard.
#
# Three stages:
#   1. deps     install node_modules from the lockfile only (max layer cache)
#   2. builder  copy source, take build args for NEXT_PUBLIC_* vars, run `next build`
#   3. runner   minimal runtime image using Next.js standalone output
#
# Local dev still uses `npm run dev` directly for hot reload. This image is
# what `docker compose up --build` produces, and what an Azure Container Apps
# deployment would run.
#
# Build args (passed by docker-compose.yml from shell env, see the top of
# that file for the recommended `source` pattern):
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY  — baked into the client bundle
#   NEXT_PUBLIC_API_BASE_URL           — baked into the client bundle

# =============================================================================
# Stage 1: deps
# =============================================================================
FROM node:22-alpine AS deps
WORKDIR /app

# Copy ONLY package.json + lockfile so this layer is reused unless deps change.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# =============================================================================
# Stage 2: builder
# =============================================================================
FROM node:22-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* values get baked into the client bundle at build time, so
# they MUST be present here. Compose passes them as `--build-arg`s.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_BASE_URL

ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
# Skip Next.js's anonymous telemetry on the build server.
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# =============================================================================
# Stage 3: runner — minimal runtime image
# =============================================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user per Next.js security recommendation.
RUN addgroup -S -g 1001 nodejs && \
    adduser  -S -u 1001 -G nodejs nextjs

# Next.js standalone build leaves `public/` and `.next/static/` OUTSIDE the
# `standalone/` directory, so they're copied explicitly here per the
# Next.js docs. The `docs/` directory at the repo root is also needed at
# runtime — `lib/docs-server.ts` reads markdown from it via process.cwd().
COPY --from=builder --chown=nextjs:nodejs /app/public         ./public
COPY --from=builder --chown=nextjs:nodejs /app/docs           ./docs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static   ./.next/static

USER nextjs
EXPOSE 3000

# server.js is the standalone server emitted by `next build` into the root
# of the standalone directory.
CMD ["node", "server.js"]
