# Kreav backend — NestJS + Prisma. Multi-stage build (pnpm).
# Runtime applies pending Prisma migrations against Neon, then boots the API.

# ---- build stage ----
FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma:generate && pnpm build

# ---- runtime stage ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

# Reuse the resolved dependency tree from the build stage. It includes the
# generated Prisma client and the `prisma` CLI needed by `migrate deploy`.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Apply migrations against Neon, then start. Runs on every deploy; a no-op when
# the DB is already up to date.
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]
