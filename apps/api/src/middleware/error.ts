import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isProd } from "../config/env";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(msg = "Bad request") {
    return new ApiError(400, msg, "bad_request");
  }
  static unauthorized(msg = "Authentication required") {
    return new ApiError(401, msg, "unauthorized");
  }
  static forbidden(msg = "You do not have permission to do that") {
    return new ApiError(403, msg, "forbidden");
  }
  static notFound(msg = "Not found") {
    return new ApiError(404, msg, "not_found");
  }
  static conflict(msg = "Conflict") {
    return new ApiError(409, msg, "conflict");
  }
  static paymentRequired(msg = "Upgrade required") {
    return new ApiError(402, msg, "payment_required");
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json({ error: { code: err.code ?? "error", message: err.message } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "validation_error",
        message: err.errors[0]?.message ?? "Invalid input",
        details: err.flatten().fieldErrors,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({
    error: {
      code: "internal_error",
      message: isProd ? "Something went wrong" : String((err as Error)?.message ?? err),
    },
  });
}

/** Wrap async route handlers so rejections reach the error middleware. */
export function asyncHandler<
  T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
