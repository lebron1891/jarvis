import { Router } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { authenticator } from "otplib";
import { z } from "zod";
import { env } from "../config/env";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/mailer";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { ApiError, asyncHandler } from "../middleware/error";
import { authLimiter } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import { applyLedgerEntry } from "../services/credits";
import { SIGNUP_BONUS_CREDITS } from "../utils/gamification";
import { hashPassword, verifyPassword } from "../utils/passwords";
import {
  generateOpaqueToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
} from "../utils/tokens";

const router = Router();

export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  name: true,
  avatarUrl: true,
  bio: true,
  country: true,
  timezone: true,
  languages: true,
  role: true,
  plan: true,
  premiumUntil: true,
  profileTheme: true,
  emailVerified: true,
  verifiedTeacher: true,
  twoFactorEnabled: true,
  onboardingDone: true,
  creditBalance: true,
  xp: true,
  level: true,
  streakCount: true,
  ratingAvg: true,
  ratingCount: true,
  completedExchanges: true,
  sessionsTaught: true,
  sessionsLearned: true,
  reliabilityScore: true,
  createdAt: true,
} as const;

async function issueTokens(user: { id: string; role: string; plan: string }) {
  const accessToken = signAccessToken(user);
  const refreshToken = generateOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
    },
  });
  return { accessToken, refreshToken };
}

async function createVerification(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET") {
  const token = generateOpaqueToken();
  const ttlMs = type === "EMAIL_VERIFY" ? 24 * 3600_000 : 3600_000;
  await prisma.verificationToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return token;
}

// ---------------------------------------------------------------------------
// Registration & login
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_.-]+$/i, "Username can contain letters, digits, . _ -")
    .toLowerCase(),
  name: z.string().min(1).max(80),
});

router.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { email, password, username, name } = req.body;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (existing) {
      throw ApiError.conflict(
        existing.email === email ? "Email already registered" : "Username already taken",
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, username, name },
        select: { ...PUBLIC_USER_SELECT },
      });
      await applyLedgerEntry(tx, {
        userId: created.id,
        amount: SIGNUP_BONUS_CREDITS,
        type: "SIGNUP_BONUS",
        description: "Welcome bonus — book your first lessons!",
      });
      return created;
    });

    const verifyToken = await createVerification(user.id, "EMAIL_VERIFY");
    await sendVerificationEmail(email, verifyToken);

    const tokens = await issueTokens({ id: user.id, role: "USER", plan: "FREE" });
    res.status(201).json({
      user: { ...user, creditBalance: SIGNUP_BONUS_CREDITS },
      ...tokens,
    });
  }),
);

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

router.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw ApiError.unauthorized("Invalid email or password");
    }
    if (user.isBanned) {
      throw ApiError.forbidden(`Account suspended: ${user.banReason ?? "contact support"}`);
    }

    if (user.twoFactorEnabled) {
      return res.json({
        twoFactorRequired: true,
        challengeToken: signTwoFactorChallenge(user.id),
      });
    }

    const tokens = await issueTokens(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });
    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: PUBLIC_USER_SELECT,
    });
    res.json({ user: safeUser, ...tokens });
  }),
);

// ---------------------------------------------------------------------------
// Two-factor authentication (TOTP)
// ---------------------------------------------------------------------------

router.post(
  "/2fa/verify",
  authLimiter,
  validate({
    body: z.object({ challengeToken: z.string(), code: z.string().length(6) }),
  }),
  asyncHandler(async (req, res) => {
    let payload;
    try {
      payload = verifyTwoFactorChallenge(req.body.challengeToken);
    } catch {
      throw ApiError.unauthorized("Challenge expired, sign in again");
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.twoFactorSecret) throw ApiError.unauthorized();
    if (!authenticator.verify({ token: req.body.code, secret: user.twoFactorSecret })) {
      throw ApiError.unauthorized("Invalid verification code");
    }
    const tokens = await issueTokens(user);
    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: PUBLIC_USER_SELECT,
    });
    res.json({ user: safeUser, ...tokens });
  }),
);

router.post(
  "/2fa/setup",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const secret = authenticator.generateSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });
    res.json({
      secret,
      otpauthUrl: authenticator.keyuri(user.email, "SkillSwap", secret),
    });
  }),
);

router.post(
  "/2fa/enable",
  requireAuth,
  validate({ body: z.object({ code: z.string().length(6) }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.twoFactorSecret) throw ApiError.badRequest("Run 2FA setup first");
    if (!authenticator.verify({ token: req.body.code, secret: user.twoFactorSecret })) {
      throw ApiError.badRequest("Invalid verification code");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });
    res.json({ enabled: true });
  }),
);

router.post(
  "/2fa/disable",
  requireAuth,
  validate({ body: z.object({ code: z.string().length(6) }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.twoFactorSecret || !user.twoFactorEnabled) {
      throw ApiError.badRequest("Two-factor authentication is not enabled");
    }
    if (!authenticator.verify({ token: req.body.code, secret: user.twoFactorSecret })) {
      throw ApiError.badRequest("Invalid verification code");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    res.json({ enabled: false });
  }),
);

// ---------------------------------------------------------------------------
// Token lifecycle
// ---------------------------------------------------------------------------

router.post(
  "/refresh",
  validate({ body: z.object({ refreshToken: z.string() }) }),
  asyncHandler(async (req, res) => {
    const tokenHash = hashToken(req.body.refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized("Session expired, sign in again");
    }
    if (stored.user.isBanned) throw ApiError.forbidden("Account suspended");

    // Rotation: the old token can never be replayed.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await issueTokens(stored.user);
    res.json(tokens);
  }),
);

router.post(
  "/logout",
  validate({ body: z.object({ refreshToken: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    if (req.body.refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(req.body.refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Email verification & password reset
// ---------------------------------------------------------------------------

router.post(
  "/verify-email",
  validate({ body: z.object({ token: z.string() }) }),
  asyncHandler(async (req, res) => {
    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(req.body.token) },
    });
    if (!record || record.type !== "EMAIL_VERIFY" || record.usedAt || record.expiresAt < new Date()) {
      throw ApiError.badRequest("Verification link is invalid or expired");
    }
    await prisma.$transaction([
      prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
    ]);
    res.json({ verified: true });
  }),
);

router.post(
  "/resend-verification",
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (user.emailVerified) return res.json({ verified: true });
    const token = await createVerification(user.id, "EMAIL_VERIFY");
    await sendVerificationEmail(user.email, token);
    res.json({ sent: true });
  }),
);

router.post(
  "/forgot-password",
  authLimiter,
  validate({ body: z.object({ email: z.string().email().toLowerCase() }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user) {
      const token = await createVerification(user.id, "PASSWORD_RESET");
      await sendPasswordResetEmail(user.email, token);
    }
    // Same response either way — do not leak which emails exist.
    res.json({ sent: true });
  }),
);

router.post(
  "/reset-password",
  authLimiter,
  validate({
    body: z.object({ token: z.string(), password: z.string().min(8).max(128) }),
  }),
  asyncHandler(async (req, res) => {
    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(req.body.token) },
    });
    if (!record || record.type !== "PASSWORD_RESET" || record.usedAt || record.expiresAt < new Date()) {
      throw ApiError.badRequest("Reset link is invalid or expired");
    }
    const passwordHash = await hashPassword(req.body.password);
    await prisma.$transaction([
      prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      // Invalidate every session on password change.
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    res.json({ reset: true });
  }),
);

// ---------------------------------------------------------------------------
// OAuth (Google & Apple) — the client obtains an ID token, we verify it.
// ---------------------------------------------------------------------------

async function findOrCreateOAuthUser(
  provider: "google" | "apple",
  providerAccountId: string,
  email: string,
  name: string,
  avatarUrl?: string,
) {
  const account = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: true },
  });
  if (account) return account.user;

  // Link to an existing account with the same verified email, or create one.
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 24) || "user";
    let username = base;
    for (let i = 1; await prisma.user.findUnique({ where: { username } }); i++) {
      username = `${base}${i}`;
    }
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, username, name: name || base, avatarUrl, emailVerified: true },
      });
      await applyLedgerEntry(tx, {
        userId: created.id,
        amount: SIGNUP_BONUS_CREDITS,
        type: "SIGNUP_BONUS",
        description: "Welcome bonus — book your first lessons!",
      });
      return created;
    });
  }
  await prisma.oAuthAccount.create({
    data: { userId: user.id, provider, providerAccountId },
  });
  return user;
}

router.post(
  "/oauth/google",
  authLimiter,
  validate({ body: z.object({ idToken: z.string() }) }),
  asyncHandler(async (req, res) => {
    if (!env.GOOGLE_CLIENT_ID) throw ApiError.badRequest("Google login is not configured");
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(req.body.idToken)}`,
    );
    if (!resp.ok) throw ApiError.unauthorized("Invalid Google token");
    const info = (await resp.json()) as {
      aud: string;
      sub: string;
      email: string;
      email_verified: string;
      name?: string;
      picture?: string;
    };
    if (info.aud !== env.GOOGLE_CLIENT_ID || info.email_verified !== "true") {
      throw ApiError.unauthorized("Invalid Google token");
    }
    const user = await findOrCreateOAuthUser(
      "google",
      info.sub,
      info.email.toLowerCase(),
      info.name ?? "",
      info.picture,
    );
    if (user.isBanned) throw ApiError.forbidden("Account suspended");
    const tokens = await issueTokens(user);
    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: PUBLIC_USER_SELECT,
    });
    res.json({ user: safeUser, ...tokens });
  }),
);

const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

router.post(
  "/oauth/apple",
  authLimiter,
  validate({
    body: z.object({ idToken: z.string(), name: z.string().optional() }),
  }),
  asyncHandler(async (req, res) => {
    if (!env.APPLE_CLIENT_ID) throw ApiError.badRequest("Apple login is not configured");
    let payload;
    try {
      const verified = await jwtVerify(req.body.idToken, appleJwks, {
        issuer: "https://appleid.apple.com",
        audience: env.APPLE_CLIENT_ID,
      });
      payload = verified.payload as { sub: string; email?: string };
    } catch {
      throw ApiError.unauthorized("Invalid Apple token");
    }
    if (!payload.email) throw ApiError.unauthorized("Apple token missing email");
    const user = await findOrCreateOAuthUser(
      "apple",
      payload.sub,
      payload.email.toLowerCase(),
      req.body.name ?? "",
    );
    if (user.isBanned) throw ApiError.forbidden("Account suspended");
    const tokens = await issueTokens(user);
    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: PUBLIC_USER_SELECT,
    });
    res.json({ user: safeUser, ...tokens });
  }),
);

// ---------------------------------------------------------------------------

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        ...PUBLIC_USER_SELECT,
        skills: { include: { skill: { include: { category: true } } } },
        availability: true,
        badges: { include: { badge: true } },
      },
    });
    if (!user) throw ApiError.unauthorized();
    res.json({ user });
  }),
);

export default router;
