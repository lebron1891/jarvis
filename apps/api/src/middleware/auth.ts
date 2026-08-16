import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/tokens";
import { ApiError } from "./error";

export interface AuthUser {
  id: string;
  role: string;
  plan: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractUser(req: Request): AuthUser | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  try {
    const payload = verifyAccessToken(header.slice(7));
    return { id: payload.sub, role: payload.role, plan: payload.plan };
  } catch {
    return undefined;
  }
}

/** Attaches req.user when a valid token is present; never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = extractUser(req);
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = extractUser(req);
  if (!req.user) return next(ApiError.unauthorized());
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.user = req.user ?? extractUser(req);
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}
