/**
 * The address the reader's browser used. Behind Coolify's proxy, `request.url` is the container's own
 * (`http://0.0.0.0:3007`), so the host and scheme come from the proxy's `X-Forwarded-*` headers, which Traefik
 * sets itself and does not take from the client. Locally there is no proxy and `request.url` is already right.
 */
export function publicUrl(request: Request): URL {
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (host) url.host = host
  if (proto === 'http' || proto === 'https') url.protocol = `${proto}:`
  return url
}

/**
 * A mutating request must come from this site. Browsers send `Origin` on every cross-site POST, and the session
 * cookie is `SameSite=Lax` besides, so this is the second lock on the same door: a form or script on another
 * site cannot post, ask or sign in as the reader. A request with no `Origin` at all is not a browser's, and the
 * signed-in session is what those are judged on.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === publicUrl(request).host
  } catch {
    return false
  }
}
