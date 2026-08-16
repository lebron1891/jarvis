import rateLimit from "express-rate-limit";
import { isTest } from "../config/env";

const skip = () => isTest;

/** Global safety net for the whole API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
});

/** Tight limit for credential endpoints (login, register, password reset). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many attempts, try again later" } },
  skip,
});

/** AI endpoints are expensive — keep bursts down independently of quotas. */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Slow down a little" } },
  skip,
});
