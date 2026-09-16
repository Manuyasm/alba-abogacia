# Multi-stage build for the Astro site (output: "static" + @astrojs/node
# standalone adapter — see astro.config.mjs and AGENTS.md §3/§8). The build
# stage produces a static client bundle plus a self-contained Node server
# (dist/server/entry.mjs) that serves it and handles the one on-demand route
# (POST /api/contacto). Only `zod` stays external to that bundle (see
# dist/server's imports) — everything else Astro/Vite bundles inline — so the
# runtime stage only needs a production-only node_modules install, not the
# full dev toolchain.
#
# PUBLIC_-prefixed vars (PUBLIC_CAP_API_URL, PUBLIC_CAP_SITE_KEY, ...) are
# inlined into the client bundle by Vite at BUILD time, unlike the
# server-only vars in src/pages/api/contacto.ts, which are read from
# process.env at request time. They must be supplied as Docker build ARGs
# (docker-compose.yml's `build.args`), not just container-runtime env vars.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG PUBLIC_CAP_API_URL
ARG PUBLIC_CAP_SITE_KEY
ARG PUBLIC_UMAMI_SCRIPT_URL
ARG PUBLIC_UMAMI_WEBSITE_ID
ENV PUBLIC_CAP_API_URL=$PUBLIC_CAP_API_URL \
    PUBLIC_CAP_SITE_KEY=$PUBLIC_CAP_SITE_KEY \
    PUBLIC_UMAMI_SCRIPT_URL=$PUBLIC_UMAMI_SCRIPT_URL \
    PUBLIC_UMAMI_WEBSITE_ID=$PUBLIC_UMAMI_WEBSITE_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
