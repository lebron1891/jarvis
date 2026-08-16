import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env";

export interface StoredFile {
  url: string;
  key: string;
}

const s3Enabled = !!(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);

const s3 = s3Enabled
  ? new S3Client({
      region: env.S3_REGION ?? "auto",
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    })
  : undefined;

function makeKey(originalName: string) {
  const ext = path.extname(originalName).slice(0, 10);
  return `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${ext}`;
}

/**
 * Persists an uploaded buffer. Uses S3-compatible object storage when
 * configured (AWS S3, Cloudflare R2, MinIO…), local disk otherwise.
 */
export async function storeFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<StoredFile> {
  const key = makeKey(originalName);

  if (s3 && env.S3_BUCKET) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    const base = env.S3_ENDPOINT
      ? `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}`
      : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`;
    return { url: `${base}/${key}`, key };
  }

  const dir = path.join(env.UPLOAD_DIR, path.dirname(key));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(env.UPLOAD_DIR, key), buffer);
  return { url: `${env.PUBLIC_API_URL}/uploads/${key}`, key };
}
