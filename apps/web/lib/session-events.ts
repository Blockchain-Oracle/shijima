export const SESSION_CHANGED_EVENT = 'shijima:session'

/** Existing mounted panels reread their server state after either login method or logout. */
export function sessionChanged() {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}
