const encoder = new TextEncoder();
const decoder = new TextDecoder();

function keyMaterial(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
}

export async function deriveAesKey(secret: string, salt: Uint8Array) {
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 210000, hash: "SHA-256" },
    await keyMaterial(secret),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSensitiveField(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveAesKey(secret, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return {
    alg: "AES-256-GCM",
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
}

export async function decryptSensitiveField(payload: { iv: string; salt: string; data: string }, secret: string) {
  const iv = Uint8Array.from(atob(payload.iv), (char) => char.charCodeAt(0));
  const salt = Uint8Array.from(atob(payload.salt), (char) => char.charCodeAt(0));
  const data = Uint8Array.from(atob(payload.data), (char) => char.charCodeAt(0));
  const key = await deriveAesKey(secret, salt);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return decoder.decode(decrypted);
}
