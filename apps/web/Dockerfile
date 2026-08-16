# SkillSwap web — build from the repository root:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .

FROM node:22-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_APPLE_CLIENT_ID=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_APPLE_CLIENT_ID=$NEXT_PUBLIC_APPLE_CLIENT_ID

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY apps/web apps/web
RUN npm run build --workspace apps/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web apps/web

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "apps/web"]
