import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { apiLimiter } from "./middleware/rateLimit";
import adminRouter from "./routes/admin";
import aiRouter from "./routes/ai";
import authRouter from "./routes/auth";
import billingRouter from "./routes/billing";
import bookingsRouter from "./routes/bookings";
import categoriesRouter from "./routes/categories";
import conversationsRouter from "./routes/conversations";
import exchangesRouter from "./routes/exchanges";
import gamificationRouter from "./routes/gamification";
import marketplaceRouter from "./routes/marketplace";
import notificationsRouter from "./routes/notifications";
import reportsRouter from "./routes/reports";
import reviewsRouter from "./routes/reviews";
import skillsRouter from "./routes/skills";
import uploadsRouter from "./routes/uploads";
import usersRouter from "./routes/users";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(apiLimiter);

  // Local uploads fallback (S3 serves its own URLs when configured)
  app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR)));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/skills", skillsRouter);
  app.use("/api/marketplace", marketplaceRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/exchanges", exchangesRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/gamification", gamificationRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
