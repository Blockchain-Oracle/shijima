/** What the layout reads once per request for the shells: who is signed in, their unread count, their Telegram. */
export interface HeaderProps {
  signedInAs: string | undefined
  /** What the owner's desks held at their last check, raw USDG as a string; null when none has been valued. */
  desksTotalUsdg: string | null
  /** Messages the owner has not opened yet. */
  unread: number
  /** Whether the wallet's Telegram is linked, for the account menu. */
  telegram: HeaderTelegram | null
}

export interface HeaderTelegram {
  linked: { username: string | null } | null
}
