import { createHmac, timingSafeEqual } from "node:crypto";

// This should match the session secret from useAppSession
const SESSION_SECRET = (() => {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is not set");
  return process.env.SESSION_SECRET;
})();

// The signed token type
export type SignedToken = {
  token: string; // base64-encoded payload
  signature: string; // base64url-encoded HMAC
  signed: string; // `token.signature`
};

/**
 * Create a signed token for the provided typed payload.
 */
export function createSignedToken<T>(
  payload: T,
  key: string = SESSION_SECRET,
): SignedToken {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json, "utf8").toString("base64url");
  const hmac = createHmac("sha256", key).update(base64).digest("base64url");
  return {
    token: base64,
    signature: hmac,
    signed: `${base64}.${hmac}`,
  };
}

/**
 * Dehydrate (verify + decode) a signed token.
 * Throws if invalid signature or decoding fails.
 */
export function dehydrateSignedToken<T>(
  signedToken: SignedToken,
  key: string = SESSION_SECRET,
): T {
  const { token, signature } = signedToken;
  if (!token || !signature) throw new Error("Malformed signed token");
  const hmac = createHmac("sha256", key).update(token).digest("base64url");
  // Use timingSafeEqual to help prevent timing attacks
  const actual = Buffer.from(signature, "base64url");
  const expected = Buffer.from(hmac, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Invalid token signature");
  }
  const json = Buffer.from(token, "base64url").toString("utf8");
  return JSON.parse(json) as T;
}
