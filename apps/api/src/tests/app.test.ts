import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";

process.env.NODE_ENV = "test";

describe("API app", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  it("responds on the health endpoint", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("returns 404 with a structured error for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("rejects garbage bearer tokens", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("validates registration payloads before touching the database", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "short", username: "!", name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });
});
