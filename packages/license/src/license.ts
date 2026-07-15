import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { licensePayloadSchema, type LicenseFeature, type LicensePayload } from "@openlocale/shared";

/**
 * openlocale license keys: `OL1.<base64url(payload json)>.<base64url(ed25519 sig)>`
 * Verified fully offline against the embedded public key. The private key
 * never ships; see tools/license-keygen.
 */

// Public half of the openlocale license signing keypair. Replace with your
// own if you fork and sell licenses yourself (tools/license-keygen init).
export const PRODUCTION_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAbhAFDg4vdIucqHVa3idQp7nCeaWfCl/9xYlUk6Nr0W8=
-----END PUBLIC KEY-----`;

const PREFIX = "OL1";
const CLOCK_SKEW_SECONDS = 24 * 60 * 60;

export type VerifyResult =
  | { valid: true; payload: LicensePayload }
  | { valid: false; reason: string };

function publicKeyFrom(pem?: string): KeyObject {
  return createPublicKey(pem ?? process.env.OPENLOCALE_LICENSE_PUBLIC_KEY ?? PRODUCTION_PUBLIC_KEY_PEM);
}

export function verifyLicense(key: string, publicKeyPem?: string): VerifyResult {
  const parts = key.trim().split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return { valid: false, reason: "malformed key (expected OL1.<payload>.<signature>)" };
  }
  const [, payloadB64, sigB64] = parts;

  let signatureOk = false;
  try {
    signatureOk = verify(
      null,
      Buffer.from(payloadB64!, "utf8"),
      publicKeyFrom(publicKeyPem),
      Buffer.from(sigB64!, "base64url")
    );
  } catch {
    return { valid: false, reason: "signature verification error" };
  }
  if (!signatureOk) return { valid: false, reason: "invalid signature" };

  let payload: LicensePayload;
  try {
    payload = licensePayloadSchema.parse(
      JSON.parse(Buffer.from(payloadB64!, "base64url").toString("utf8"))
    );
  } catch {
    return { valid: false, reason: "invalid payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp + CLOCK_SKEW_SECONDS < now) {
    return { valid: false, reason: "license expired" };
  }

  return { valid: true, payload };
}

export function hasFeature(result: VerifyResult, feature: LicenseFeature): boolean {
  return result.valid && result.payload.features.includes(feature);
}

/** Sign a license payload. Used by tools/license-keygen and tests only. */
export function signLicense(payload: LicensePayload, privateKeyPem: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(null, Buffer.from(payloadB64, "utf8"), createPrivateKey(privateKeyPem));
  return `${PREFIX}.${payloadB64}.${signature.toString("base64url")}`;
}
