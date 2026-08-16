import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string;
  role: string;
  plan: string;
  purpose: "access";
}

export interface TwoFactorChallengePayload {
  sub: string;
  purpose: "2fa";
}

export function signAccessToken(user: { id: string; role: string; plan: string }) {
  const payload: AccessTokenPayload = {
    sub: user.id,
    role: user.role,
    plan: user.plan,
    purpose: "access",
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (payload.purpose !== "access") throw new Error("Wrong token purpose");
  return payload;
}

export function signTwoFactorChallenge(userId: string) {
  const payload: TwoFactorChallengePayload = { sub: userId, purpose: "2fa" };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "5m" });
}

export function verifyTwoFactorChallenge(token: string): TwoFactorChallengePayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TwoFactorChallengePayload;
  if (payload.purpose !== "2fa") throw new Error("Wrong token purpose");
  return payload;
}

/** Opaque refresh tokens: random value handed to the client, SHA-256 hash stored. */
export function generateOpaqueToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
