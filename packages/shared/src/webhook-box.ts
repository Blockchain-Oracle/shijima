/**
 * The OpenServ webhook URL at rest. Its token is a bearer credential: anyone holding it can start that workspace's
 * workflow. So it is stored only as AES-256-GCM ciphertext, under OPENSERV_WEBHOOK_KEY (32 random bytes, base64),
 * a key of its own that the session secret never touches. The web process seals it; the worker opens it.
 *
 * Server only: this imports node:crypto. It is a subpath (`@desk/shared/webhook-box`), never re-exported from the
 * package index, so no browser bundle can pull it in.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const KEY_ENV = 'OPENSERV_WEBHOOK_KEY'

function key(raw = process.env[KEY_ENV]): Buffer {
  if (!raw) throw new Error(`${KEY_ENV} is missing. Generate one with: openssl rand -base64 32`)
  const k = Buffer.from(raw, 'base64')
  if (k.length !== 32) throw new Error(`${KEY_ENV} must be 32 bytes, base64 encoded`)
  return k
}

/** True when the key is present and well formed, so a caller can say "not set up" instead of throwing. */
export function webhookKeyReady(): boolean {
  try {
    key()
    return true
  } catch {
    return false
  }
}

/** `v1.<iv>.<tag>.<ciphertext>`, each part base64url. A fresh 12-byte IV every time. */
export function sealWebhookUrl(url: string, raw?: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(raw), iv)
  const body = Buffer.concat([cipher.update(url, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv, tag, body].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.')
}

/** The URL back. Throws on a wrong key or any tampering: GCM authenticates the whole thing. */
export function openWebhookUrl(sealed: string, raw?: string): string {
  const [version, iv, tag, body] = sealed.split('.')
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('not a sealed webhook URL')
  const decipher = createDecipheriv('aes-256-gcm', key(raw), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
}
