#!/usr/bin/env node
/**
 * openlocale license signing tool. NEVER published; the private key lives in
 * ~/.openlocale/license-signing.pem (outside any repo).
 *
 *   node keygen.js init
 *     Generate an Ed25519 keypair. Prints the public key PEM to embed in
 *     packages/license/src/license.ts.
 *
 *   node keygen.js sign --org "Acme" --email buyer@acme.com \
 *     [--plan pro] [--features ai] [--seats 10] [--expires 2027-07-01]
 *     Print a license key.
 */
import { generateKeyPairSync, createPrivateKey, sign, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const KEY_DIR = join(homedir(), ".openlocale");
const KEY_PATH = process.env.OPENLOCALE_SIGNING_KEY ?? join(KEY_DIR, "license-signing.pem");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const command = process.argv[2];

if (command === "init") {
  if (existsSync(KEY_PATH) && !process.argv.includes("--force")) {
    console.error(`refusing to overwrite ${KEY_PATH} (use --force)`);
    process.exit(1);
  }
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(KEY_PATH, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  console.error(`private key written to ${KEY_PATH}`);
  console.error("embed this public key in packages/license/src/license.ts:\n");
  console.log(publicKey.export({ type: "spki", format: "pem" }).toString().trim());
} else if (command === "sign") {
  const org = arg("org");
  const email = arg("email");
  if (!org || !email) {
    console.error("usage: keygen.js sign --org <name> --email <email> [--plan pro] [--features ai] [--seats N] [--expires YYYY-MM-DD]");
    process.exit(1);
  }
  const expires = arg("expires");
  const exp = expires
    ? Math.floor(new Date(`${expires}T23:59:59Z`).getTime() / 1000)
    : Math.floor(Date.now() / 1000) + 365 * 24 * 3600;

  const payload = {
    v: 1,
    id: `lic_${randomBytes(8).toString("hex")}`,
    org,
    email,
    plan: arg("plan", "pro"),
    features: arg("features", "ai").split(",").map((s) => s.trim()),
    ...(arg("seats") ? { seats: Number(arg("seats")) } : {}),
    iat: Math.floor(Date.now() / 1000),
    exp
  };

  const privateKey = createPrivateKey(readFileSync(KEY_PATH, "utf8"));
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(null, Buffer.from(payloadB64, "utf8"), privateKey);
  console.error(`license for ${org} <${email}> (${payload.plan}, expires ${new Date(exp * 1000).toISOString().slice(0, 10)}):\n`);
  console.log(`OL1.${payloadB64}.${signature.toString("base64url")}`);
} else {
  console.error("usage: keygen.js <init|sign> [options]");
  process.exit(1);
}
