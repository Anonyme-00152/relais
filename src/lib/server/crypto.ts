import "server-only";
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Identifiant public court, sans caractères ambigus (0/O, 1/l/I). */
export function publicId(len = 8): string {
  const bytes = randomBytes(len * 2);
  let out = "";
  for (let i = 0; out.length < len && i < bytes.length; i++) {
    // Rejet pour une distribution uniforme.
    if (bytes[i] < 256 - (256 % ALPHABET.length)) out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out.length === len ? out : publicId(len);
}

export function secretToken(): string {
  return randomBytes(24).toString("base64url");
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const N = 16384;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32, { N, r: 8, p: 1 });
  return `scrypt$${N}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, n, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const key = await scrypt(pw, Buffer.from(salt, "base64url"), 32, { N: Number(n), r: 8, p: 1 });
  return safeEqual(key.toString("base64url"), hash);
}

function secret(): string {
  const s = process.env.RELAIS_SECRET ?? process.env.BLOB_READ_WRITE_TOKEN;
  if (s) return s;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
    throw new Error("RELAIS_SECRET manquant");
  }
  return "relais-dev-secret-change-me";
}

export function hmac(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Empreinte anonyme d'un client (IP) pour limiter les abus sans stocker l'IP. */
export function clientFingerprint(ip: string): string {
  return hmac(`ip:${ip}`).slice(0, 16);
}
