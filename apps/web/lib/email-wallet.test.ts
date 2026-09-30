import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareEmailWallet, walletDeadline } from './email-wallet'

afterEach(() => vi.useRealTimers())
describe('email wallet setup', () => {
  const ethereum = { type: 'wallet', chainType: 'ethereum' }
  it('creates a wallet after headless OTP and refreshes the verified account', async () => {
    const refresh = vi
      .fn()
      .mockResolvedValueOnce({ linkedAccounts: [] })
      .mockResolvedValueOnce({ linkedAccounts: [ethereum] })
    const create = vi.fn().mockResolvedValue({})
    await prepareEmailWallet(refresh, create)
    expect(create).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('keeps the existing Ethereum wallet instead of creating a different owner', async () => {
    const create = vi.fn()
    await prepareEmailWallet(async () => ({ linkedAccounts: [ethereum] }), create)
    expect(create).not.toHaveBeenCalled()
  })
  it('creates an Ethereum wallet when only a Solana wallet is linked', async () => {
    const refresh = vi
      .fn()
      .mockResolvedValueOnce({ linkedAccounts: [{ type: 'wallet', chainType: 'solana' }] })
      .mockResolvedValueOnce({ linkedAccounts: [ethereum] })
    const create = vi.fn().mockResolvedValue({})
    await prepareEmailWallet(refresh, create)
    expect(create).toHaveBeenCalledOnce()
  })
  it('reports an incomplete wallet rather than accepting OTP as full app sign-in', async () => {
    await expect(
      prepareEmailWallet(
        async () => ({ linkedAccounts: [] }),
        async () => ({}),
      ),
    ).rejects.toThrow('not finished connecting')
  })
  it('preserves the provider error so setup can be retried', async () => {
    await expect(
      prepareEmailWallet(
        async () => ({ linkedAccounts: [] }),
        async () => {
          throw new Error('Wallet service unavailable')
        },
      ),
    ).rejects.toThrow('Wallet service unavailable')
  })
  it('releases a stalled loading state without losing email verification', async () => {
    vi.useFakeTimers()
    const result = walletDeadline(new Promise(() => {}), 40_000)
    const assertion = expect(result).rejects.toThrow('your email is still verified')
    await vi.advanceTimersByTimeAsync(40_000)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })
  it('clears the timeout after successful setup', async () => {
    vi.useFakeTimers()
    expect(await walletDeadline(Promise.resolve('ready'))).toBe('ready')
    expect(vi.getTimerCount()).toBe(0)
  })
})
