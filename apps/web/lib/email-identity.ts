/** Only provider-verified email and wallet accounts may mint a wallet-scoped session. */
export function emailIdentity(
  accounts: ReadonlyArray<{
    type: string
    address?: string
    chain_type?: string
    verified_at?: number
  }>,
  requestedAddress: string,
): { email: string; address: string } | null {
  const email = accounts.find((a) => a.type === 'email' && a.address && a.verified_at)
  const wallet = accounts.find(
    (a) =>
      a.type === 'wallet' &&
      a.chain_type === 'ethereum' &&
      a.address?.toLowerCase() === requestedAddress.toLowerCase() &&
      a.verified_at,
  )
  if (!email?.address || !wallet?.address) return null
  return { email: email.address, address: wallet.address.toLowerCase() }
}
