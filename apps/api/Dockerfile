# SkillSwap API — build from the repository root:
#   docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY apps/api apps/api
RUN npm run db:generate --workspace apps/api \
 && npm run build --workspace apps/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json apps/api/
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma

EXPOSE 4000
# Sync the schema on boot (swap for `prisma migrate deploy` once you commit
# migration files), then start the server.
CMD ["sh", "-c", "npx prisma db push --schema apps/api/prisma/schema.prisma --skip-generate && node apps/api/dist/index.js"]
