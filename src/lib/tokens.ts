// The signed token type
export type SignedToken = {
  token: string; // base64url-encoded payload
  signature: string; // base64url-encoded HMAC
  signed: string; // `token.signature`
};

/**
 * Convert string to base64url encoding (browser-compatible)
 */
function base64UrlEncode(str: string): string {
  // Use TextEncoder for browser compatibility
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  // Convert bytes to binary string, then to base64
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // Convert to base64, then make it URL-safe
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Convert base64url string to original string (browser-compatible)
 */
function base64UrlDecode(str: string): string {
  // Make it standard base64
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  // Decode
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Create HMAC signature using Web Crypto API (browser-compatible)
 */
async function createHmacSignature(
  data: string,
  key: string,
): Promise<string> {
  // Import the key for HMAC
  const keyData = new TextEncoder().encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Sign the data
  const dataBytes = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);

  // Convert ArrayBuffer to base64url
  const signatureArray = new Uint8Array(signature);
  let binary = "";
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Verify HMAC signature using Web Crypto API (browser-compatible)
 */
async function verifyHmacSignature(
  data: string,
  signature: string,
  key: string,
): Promise<boolean> {
  try {
    // Import the key for HMAC
    const keyData = new TextEncoder().encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    // Convert base64url to standard base64 and add padding if needed
    let base64 = signature.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding
    const padding = base64.length % 4;
    if (padding) {
      base64 += "=".repeat(4 - padding);
    }

    // Decode the signature from base64
    const binaryString = atob(base64);
    const signatureBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      signatureBytes[i] = binaryString.charCodeAt(i);
    }

    // Verify the signature
    const dataBytes = new TextEncoder().encode(data);
    return await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signatureBytes,
      dataBytes,
    );
  } catch {
    return false;
  }
}

/**
 * Create a signed token for the provided typed payload.
 */
export async function createSignedToken<T>(
  payload: T,
  key: string = process.env.SESSION_SECRET!,
): Promise<SignedToken> {
  const json = JSON.stringify(payload);
  const token = base64UrlEncode(json);
  const signature = await createHmacSignature(token, key);
  return {
    token,
    signature,
    signed: `${token}.${signature}`,
  };
}

/**
 * Dehydrate (verify + decode) a signed token.
 * Throws if invalid signature or decoding fails.
 */
export async function dehydrateSignedToken<T>(
  signedToken: SignedToken,
  key: string = process.env.SESSION_SECRET!,
): Promise<T> {
  const { token, signature } = signedToken;
  if (!token || !signature) throw new Error("Malformed signed token");

  // Verify the signature
  const isValid = await verifyHmacSignature(token, signature, key);
  if (!isValid) {
    throw new Error("Invalid token signature");
  }

  // Decode the token
  const json = base64UrlDecode(token);
  return JSON.parse(json) as T;
}
