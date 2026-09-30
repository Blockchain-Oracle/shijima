type WalletUser = { linkedAccounts: { type: string; chainType?: string }[] }

/** Headless OTP does not run Privy's modal-only createOnLogin behavior. */
export async function prepareEmailWallet(
  refreshUser: () => Promise<WalletUser>,
  createWallet: () => Promise<unknown>,
) {
  const hasWallet = (user: WalletUser) =>
    user.linkedAccounts.some((account) => account.type === 'wallet' && account.chainType === 'ethereum')
  if (hasWallet(await refreshUser())) return
  await createWallet()
  if (!hasWallet(await refreshUser()))
    throw new Error('Your wallet has not finished connecting. Try again in a moment.')
}

/** A late SDK result can still update the account; the UI must always offer recovery. */
export async function walletDeadline<T>(operation: Promise<T>, milliseconds = 40_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'Your wallet is taking longer than expected. Try again; your email is still verified.',
              ),
            ),
          milliseconds,
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
