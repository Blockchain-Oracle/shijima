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
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}
