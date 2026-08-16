import { Router } from "express";
import multer from "multer";
import { storeFile } from "../lib/storage";
import { requireAuth } from "../middleware/auth";
import { ApiError, asyncHandler } from "../middleware/error";

const router = Router();

const FREE_LIMIT = 10 * 1024 * 1024; // 10 MB
const PREMIUM_LIMIT = 100 * 1024 * 1024; // 100 MB — premium perk

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "audio/webm",
  "audio/mpeg",
  "audio/ogg",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PREMIUM_LIMIT },
});

router.post(
  "/",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw ApiError.badRequest("No file provided");
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw ApiError.badRequest(`File type ${file.mimetype} is not allowed`);
    }
    const limit = req.user!.plan === "PREMIUM" ? PREMIUM_LIMIT : FREE_LIMIT;
    if (file.size > limit) {
      throw ApiError.badRequest(
        `File exceeds your ${Math.round(limit / 1024 / 1024)} MB limit${req.user!.plan !== "PREMIUM" ? " — Premium members can upload up to 100 MB" : ""}`,
      );
    }
    const stored = await storeFile(file.buffer, file.originalname, file.mimetype);
    res.status(201).json({
      url: stored.url,
      fileName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    });
  }),
);

export default router;
