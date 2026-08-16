# SkillSwap 🔁

**Exchange skills, not money.** Teach for one hour, earn one credit, spend it
learning anything else — coding, languages, music, cooking — from people around
the world.

Modern full-stack application: **Next.js 14 + Tailwind** frontend,
**Express + Prisma + PostgreSQL** backend, real-time everything over
**Socket.IO**, built-in **WebRTC video classroom**, and a **Claude-powered AI
learning assistant**.

---

## ✨ Features

| Area | What you get |
|---|---|
| **Authentication** | Email/password + JWT with refresh-token rotation, email verification, password reset, TOTP two-factor auth, Google & Apple OAuth (ID-token verification), onboarding wizard |
| **Profiles** | Avatar, bio, country, languages, teach/learn skills, weekly availability calendar, hour balance, rating, exchange count, badges |
| **Marketplace** | Browse teachers, full-text search, filter by category / language / online vs in-person, sort by rating, popularity, proximity or recency |
| **Exchange system** | 1 hour taught = 1 credit. Append-only credit ledger, escrow on acceptance, payout on mutual completion confirmation, automatic balances, full transaction history |
| **Booking** | Session requests, accept/decline/cancel with refunds, timezone-aware scheduling, automatic hour-before reminders, real-time notifications |
| **Video classroom** | WebRTC HD calls, screen sharing, peer-to-peer session chat, collaborative whiteboard, session timer |
| **Messaging** | Live 1:1 chat — text, images, files, voice messages, emoji reactions, read receipts, typing indicators |
| **AI assistant** | Lesson plans, quizzes, summaries, exercise correction, teacher recommendations, learning paths, translation (Anthropic API; free-tier daily quota, unlimited for Premium) |
| **Reputation** | 5-star ratings + written reviews per completed session, reliability score, verified-teacher badge |
| **Gamification** | XP & levels, daily streaks, weekly challenges, leaderboards (XP / exchanges / streaks / credits), unlockable badges |
| **Admin** | User management & bans, report moderation, category management, platform-wide announcements, analytics dashboard (active users, growth, retention, popular skills, revenue) |
| **Premium** | Unlimited AI, priority ranking, 100 MB uploads, custom themes, exclusive badges (payment-provider-agnostic billing endpoints) |
| **Security** | Helmet, CORS allow-list, rate limiting (global + auth + AI), zod validation on every route, bcrypt(12), hashed tokens at rest, role-based access control |

## 🧱 Tech stack

- **Frontend** — React 18, Next.js 14 (App Router), TypeScript, Tailwind CSS, next-themes (dark/light), lucide-react, socket.io-client
- **Backend** — Node.js, Express, TypeScript, Prisma ORM, Socket.IO, zod, otplib, jose
- **Database** — PostgreSQL 16
- **Realtime** — WebSockets (chat, notifications, presence, WebRTC signaling, whiteboard)
- **AI** — Anthropic SDK (`claude-opus-4-8` by default)
- **Storage** — local disk or any S3-compatible object store (AWS S3, R2, MinIO)
- **Ops** — Docker + docker-compose, GitHub Actions CI, vitest + supertest

## 📂 Project structure

```
skillswap/
├── apps/
│   ├── api/                 # Express REST API + realtime gateway
│   │   ├── prisma/          #   schema.prisma + seed.ts
│   │   └── src/
│   │       ├── config/      #   zod-validated environment
│   │       ├── middleware/  #   auth, validation, rate limits, errors
│   │       ├── routes/      #   16 route modules (auth, bookings, admin…)
│   │       ├── services/    #   credits ledger, gamification, AI, notifications
│   │       ├── sockets/     #   Socket.IO gateway (chat, WebRTC, whiteboard)
│   │       └── tests/       #   vitest suite
│   └── web/                 # Next.js app
│       └── src/
│           ├── app/         #   landing, auth, onboarding, (app) shell + pages
│           ├── components/  #   design system + feature components
│           └── lib/         #   API client, auth context, socket, types
├── docker-compose.yml       # db + api + web
└── .github/workflows/ci.yml # typecheck + tests + builds
```

## 🚀 Quick start

### Option A — Docker (everything in one command)

```bash
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:4000 (health: `/api/health`)

Seed the database with demo data (in another terminal):

```bash
docker compose exec api npx tsx apps/api/prisma/seed.ts   # or see Option B
```

### Option B — Local development

Requirements: Node.js ≥ 20, PostgreSQL ≥ 14 (or `docker compose up db`).

```bash
# 1. Install
npm install

# 2. Configure
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
#    → adjust DATABASE_URL if needed

# 3. Create schema + demo data
npm run db:generate
npm run db:push
npm run db:seed

# 4. Run (two terminals)
npm run dev:api        # http://localhost:4000
npm run dev:web        # http://localhost:3000
```

### Demo accounts

Seeded with password **`Password123!`**:

| Email | Role |
|---|---|
| `admin@skillswap.app` | Administrator |
| `maya@skillswap.app` | Designer teaching Figma |
| `liam@skillswap.app` | Developer teaching TypeScript |
| `sofia@skillswap.app` | Language coach teaching Spanish |
| `kenji@skillswap.app` | Pianist teaching music theory |

## ⚙️ Configuration

All variables are documented in [`apps/api/.env.example`](apps/api/.env.example)
and [`apps/web/.env.example`](apps/web/.env.example). Everything optional
degrades gracefully:

| Feature | Enable with | Without it |
|---|---|---|
| AI assistant | `ANTHROPIC_API_KEY` | Helpful stub responses |
| Emails | `SMTP_*` | Links logged to the API console |
| Google/Apple login | `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` (+ `NEXT_PUBLIC_*` on web) | Email sign-in only |
| S3 storage | `S3_*` | Local `uploads/` directory |

**Production checklist:** set strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
(the API refuses to boot with dev secrets in `NODE_ENV=production`), serve both
apps over HTTPS, point `WEB_ORIGIN` / `PUBLIC_API_URL` / `NEXT_PUBLIC_API_URL`
at your real domains, configure SMTP + S3, and replace `prisma db push` with
committed migrations (`prisma migrate dev` → `prisma migrate deploy`). For
video calls across strict NATs, add a TURN server to the ICE config in
`apps/web/src/app/(app)/session/[roomId]/page.tsx`.

## 🧪 Testing & quality

```bash
npm run test        # vitest (credit math, level curve, streaks, JWT, HTTP smoke tests)
npm run typecheck   # strict TypeScript on both apps
npm run build       # production builds
```

CI (GitHub Actions) runs typechecks, tests, both builds and both Docker images
on every push/PR.

## 🔌 API overview

Base URL: `http://localhost:4000/api`

| Domain | Endpoints |
|---|---|
| Auth | `POST /auth/register` `login` `refresh` `logout` `verify-email` `forgot-password` `reset-password` `2fa/{setup,enable,disable,verify}` `oauth/{google,apple}` · `GET /auth/me` |
| Users | `PATCH /users/me` · `POST /users/me/onboarding` · `PUT /users/me/availability` · `POST/DELETE /users/me/skills` · `GET /users/:username` · `POST/DELETE /users/:id/follow` |
| Marketplace | `GET /marketplace/teachers` (q, category, language, mode, sort, pagination) · `GET /marketplace/featured` · `GET /categories` · `GET /skills` |
| Bookings | `POST /bookings` · `GET /bookings/mine` · `POST /bookings/:id/{accept,decline,cancel,complete}` |
| Exchange | `GET /exchanges/balance` · `GET /exchanges/transactions` |
| Messaging | `GET/POST /conversations` · `GET/POST /conversations/:id/messages` · `POST /conversations/messages/:id/reactions` · `POST /conversations/:id/read` |
| Reviews | `POST /reviews` · `GET /reviews/user/:id` |
| Gamification | `GET /gamification/{leaderboard,me,achievements,challenges}` |
| AI | `POST /ai/{lesson-plan,quiz,summarize,correct,recommend,learning-path,translate}` |
| Notifications | `GET /notifications` · `POST /notifications/{:id/read,read-all}` |
| Billing | `GET /billing/status` · `POST /billing/{subscribe,cancel}` |
| Uploads | `POST /uploads` (multipart, 10 MB free / 100 MB premium) |
| Moderation | `POST /reports` · `GET/POST /admin/*` (users, reports, categories, announcements, analytics) |

Realtime events (Socket.IO, `auth: { token }`): `notification:new`,
`message:new`, `message:reactions`, `typing`, `conversation:read`,
`rtc:{join,signal,peer-joined,peer-left}`, `whiteboard:{draw,clear}`.

## 📄 License

MIT — build something kind with it.
