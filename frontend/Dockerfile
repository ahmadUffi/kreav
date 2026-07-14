# Kreav frontend — Next.js (standalone output). Multi-stage build (npm).
# NEXT_PUBLIC_API_URL is baked into the client bundle at build time.

# ---- build stage ----
FROM node:24-alpine AS build
WORKDIR /app

# Public API base is a build-time value for Next.js client code.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Fase 2A anchor off-ramp flag — also baked into the client bundle at build time.
ARG NEXT_PUBLIC_ANCHOR_ENABLED
ENV NEXT_PUBLIC_ANCHOR_ENABLED=${NEXT_PUBLIC_ANCHOR_ENABLED}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output bundles only what the server needs.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
