import { describe, expect, it } from "vitest";
import {
  generateOpaqueToken,
  hashToken,
  signAccessToken,
  signTwoFactorChallenge,
  verifyAccessToken,
  verifyTwoFactorChallenge,
} from "../utils/tokens";

describe("access tokens", () => {
  const user = { id: "user_1", role: "USER", plan: "FREE" };

  it("round-trips user identity", () => {
    const token = signAccessToken(user);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user_1");
    expect(payload.role).toBe("USER");
    expect(payload.plan).toBe("FREE");
  });

  it("rejects tampered tokens", () => {
    const token = signAccessToken(user);
    expect(() => verifyAccessToken(token.slice(0, -2) + "xx")).toThrow();
  });

  it("rejects a 2FA challenge used as an access token", () => {
    const challenge = signTwoFactorChallenge("user_1");
    expect(() => verifyAccessToken(challenge)).toThrow();
  });

  it("accepts 2FA challenges only for their purpose", () => {
    const challenge = signTwoFactorChallenge("user_1");
    expect(verifyTwoFactorChallenge(challenge).sub).toBe("user_1");
    expect(() => verifyTwoFactorChallenge(signAccessToken(user))).toThrow();
  });
});

describe("opaque refresh tokens", () => {
  it("generates unique high-entropy tokens", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(64);
  });

  it("hashes deterministically", () => {
    const token = generateOpaqueToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(hashToken(generateOpaqueToken()));
    expect(hashToken(token)).toHaveLength(64); // sha256 hex
  });
});
