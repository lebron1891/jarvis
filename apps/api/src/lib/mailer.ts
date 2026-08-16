import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

let transporter: Transporter | undefined;

if (env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

/**
 * Sends an email through SMTP when configured; otherwise logs the message so
 * verification / reset links remain usable in development.
 */
export async function sendMail(to: string, subject: string, html: string) {
  if (transporter) {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
    return;
  }
  // eslint-disable-next-line no-console
  console.info(`\n📧 [mail:dev] To: ${to}\nSubject: ${subject}\n${html}\n`);
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">${label}</a>`;

const shell = (content: string) =>
  `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#111">
     <h2 style="margin:0 0 8px">SkillSwap</h2>${content}
     <p style="color:#888;font-size:12px;margin-top:32px">If you didn't request this, you can safely ignore this email.</p>
   </div>`;

export function sendVerificationEmail(to: string, token: string) {
  const url = `${env.WEB_ORIGIN}/verify-email?token=${token}`;
  return sendMail(
    to,
    "Verify your SkillSwap email",
    shell(`<p>Welcome! Confirm your email address to unlock your account.</p><p>${button(url, "Verify email")}</p><p style="font-size:13px;color:#555">Or open: ${url}</p>`),
  );
}

export function sendPasswordResetEmail(to: string, token: string) {
  const url = `${env.WEB_ORIGIN}/reset-password?token=${token}`;
  return sendMail(
    to,
    "Reset your SkillSwap password",
    shell(`<p>We received a request to reset your password. This link expires in 1 hour.</p><p>${button(url, "Reset password")}</p><p style="font-size:13px;color:#555">Or open: ${url}</p>`),
  );
}
