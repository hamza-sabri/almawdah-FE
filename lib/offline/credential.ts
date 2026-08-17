"use client"

const CRED_KEY = "alrahmah_offline_cred"
/**
 * The freshest token pair, mirrored here whenever the app refreshes.
 *
 * The blob above is encrypted with the user's password, which we don't have at
 * refresh time — so it can only ever hold the pair captured at login. The
 * backend rotates refresh tokens and blacklists the old one on first use, so
 * that captured pair is dead within the hour. A cashier unlocking offline the
 * next morning would authenticate fine, sell from cache, and then be thrown to
 * /login the instant the network came back — before the queue uploaded.
 *
 * Plain localStorage adds no exposure: lib/tokens.ts already keeps the live
 * tokens there in the clear. The encryption's job is gating the unlock on the
 * password, and that still holds — this slot is only read AFTER the password
 * has decrypted the blob successfully.
 */
const CRED_TOKENS_KEY = "alrahmah_offline_cred_tokens"
const ITERATIONS = 100_000

type StoredCredential = {
  username: string
  salt: string
  iv: string
  ciphertext: string
}

export type SessionTokens = { access: string; refresh: string }

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

function normalize(username: string): string {
  return username.trim().toLowerCase()
}

function subtle(): SubtleCrypto | null {
  if (typeof crypto === "undefined" || !crypto.subtle) return null
  return crypto.subtle
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const engine = subtle()!
  const base = await engine.importKey("raw", encode(password), "PBKDF2", false, [
    "deriveKey",
  ])
  return engine.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function saveOfflineCredential(
  username: string,
  password: string,
  tokens: SessionTokens,
): Promise<void> {
  const engine = subtle()
  if (!engine) return
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(password, salt)
    const ciphertext = await engine.encrypt(
      { name: "AES-GCM", iv },
      key,
      encode(JSON.stringify(tokens)),
    )
    const stored: StoredCredential = {
      username: normalize(username),
      salt: toBase64(salt.buffer),
      iv: toBase64(iv.buffer),
      ciphertext: toBase64(ciphertext),
    }
    window.localStorage.setItem(CRED_KEY, JSON.stringify(stored))
    refreshOfflineCredentialTokens(tokens.access, tokens.refresh)
  } catch {
    return
  }
}

/** Keep the offline-unlock tokens current after a refresh rotation. */
export function refreshOfflineCredentialTokens(
  access: string,
  refresh: string,
): void {
  try {
    if (!window.localStorage.getItem(CRED_KEY)) return // no unlock configured
    window.localStorage.setItem(
      CRED_TOKENS_KEY,
      JSON.stringify({ access, refresh } satisfies SessionTokens),
    )
  } catch {
    return
  }
}

export function hasOfflineCredential(username?: string): boolean {
  try {
    const raw = window.localStorage.getItem(CRED_KEY)
    if (!raw) return false
    if (!username) return true
    return (JSON.parse(raw) as StoredCredential).username === normalize(username)
  } catch {
    return false
  }
}

export async function unlockOffline(
  username: string,
  password: string,
): Promise<SessionTokens | null> {
  const engine = subtle()
  if (!engine) return null
  try {
    const raw = window.localStorage.getItem(CRED_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredCredential
    if (stored.username !== normalize(username)) return null
    const key = await deriveKey(password, fromBase64(stored.salt))
    const plain = await engine.decrypt(
      { name: "AES-GCM", iv: fromBase64(stored.iv) },
      key,
      fromBase64(stored.ciphertext),
    )
    const atLogin = JSON.parse(
      new TextDecoder().decode(plain),
    ) as SessionTokens
    // Password verified. Prefer the rotated pair if we have one — the blob's
    // copy was blacklisted the first time it rotated.
    try {
      const fresh = window.localStorage.getItem(CRED_TOKENS_KEY)
      if (fresh) {
        const parsed = JSON.parse(fresh) as SessionTokens
        if (parsed?.access && parsed?.refresh) return parsed
      }
    } catch {
      /* fall back to the blob */
    }
    return atLogin
  } catch {
    return null
  }
}

export function clearOfflineCredential(): void {
  try {
    window.localStorage.removeItem(CRED_KEY)
    window.localStorage.removeItem(CRED_TOKENS_KEY)
  } catch {
    return
  }
}
