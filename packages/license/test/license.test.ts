import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hasFeature, signLicense, verifyLicense } from "../src/license.js";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const now = Math.floor(Date.now() / 1000);

function makeLicense(overrides: Partial<Parameters<typeof signLicense>[0]> = {}) {
  return signLicense(
    {
      v: 1,
      id: "lic_test",
      org: "Acme",
      email: "buyer@acme.example",
      plan: "pro",
      features: ["ai"],
      iat: now,
      exp: now + 365 * 24 * 3600,
      ...overrides
    },
    privatePem
  );
}

describe("license verification", () => {
  it("accepts a validly signed license", () => {
    const result = verifyLicense(makeLicense(), publicPem);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.org).toBe("Acme");
      expect(hasFeature(result, "ai")).toBe(true);
    }
  });

  it("rejects tampered payloads", () => {
    const key = makeLicense();
    const [prefix, payload, sig] = key.split(".");
    const tampered = JSON.parse(Buffer.from(payload!, "base64url").toString());
    tampered.plan = "enterprise";
    const tamperedB64 = Buffer.from(JSON.stringify(tampered)).toString("base64url");
    const result = verifyLicense(`${prefix}.${tamperedB64}.${sig}`, publicPem);
    expect(result.valid).toBe(false);
  });

  it("rejects keys signed by a different keypair", () => {
    const other = generateKeyPairSync("ed25519");
    const otherPem = other.publicKey.export({ type: "spki", format: "pem" }).toString();
    const result = verifyLicense(makeLicense(), otherPem);
    expect(result).toEqual({ valid: false, reason: "invalid signature" });
  });

  it("rejects expired licenses (with 24h skew tolerance)", () => {
    const expired = makeLicense({ exp: now - 2 * 24 * 3600 });
    expect(verifyLicense(expired, publicPem).valid).toBe(false);

    const justExpired = makeLicense({ exp: now - 3600 }); // within skew
    expect(verifyLicense(justExpired, publicPem).valid).toBe(true);
  });

  it("rejects garbage", () => {
    expect(verifyLicense("nonsense", publicPem).valid).toBe(false);
    expect(verifyLicense("OL1.abc.def", publicPem).valid).toBe(false);
    expect(verifyLicense("", publicPem).valid).toBe(false);
  });

  it("hasFeature is false for missing features", () => {
    const noAi = makeLicense({ features: [] });
    expect(hasFeature(verifyLicense(noAi, publicPem), "ai")).toBe(false);
  });
});
