import "dotenv/config";
import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z
      .string()
      .default("postgresql://skillswap:skillswap@localhost:5432/skillswap"),
    WEB_ORIGIN: z.string().default("http://localhost:3000"),

    JWT_ACCESS_SECRET: z.string().default("dev-access-secret-change-me"),
    JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret-change-me"),
    ACCESS_TOKEN_TTL_MIN: z.coerce.number().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

    // OAuth
    GOOGLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_ID: z.string().optional(),

    // AI assistant (Anthropic)
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default("claude-opus-4-8"),
    AI_FREE_DAILY_LIMIT: z.coerce.number().default(5),

    // Email (logs to console when SMTP is not configured)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().default("SkillSwap <no-reply@skillswap.app>"),

    // Storage: local disk by default, S3-compatible when configured
    UPLOAD_DIR: z.string().default("uploads"),
    S3_ENDPOINT: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    PUBLIC_API_URL: z.string().default("http://localhost:4000"),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV === "production") {
      for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
        if (cfg[key].startsWith("dev-")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} must be set to a strong secret in production`,
          });
        }
      }
    }
  });

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
