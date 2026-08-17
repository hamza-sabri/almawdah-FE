"use client"

const CRED_KEY = "alrahmah_offline_cred"
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
    return JSON.parse(new TextDecoder().decode(plain)) as SessionTokens
  } catch {
    return null
  }
}

export function clearOfflineCredential(): void {
  try {
    window.localStorage.removeItem(CRED_KEY)
  } catch {
    return
  }
}
