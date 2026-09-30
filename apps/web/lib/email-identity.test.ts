import { describe, expect, it } from 'vitest'
import { emailIdentity } from './email-identity'

const address = '0x1234567890123456789012345678901234567890'
const email = { type: 'email', address: 'owner@example.com', verified_at: 1 }
const wallet = { type: 'wallet', address, chain_type: 'ethereum', verified_at: 1 }

describe('verified email access to a wallet', () => {
  it('accepts verified email and the selected Ethereum wallet', () => {
    expect(emailIdentity([email, wallet], address)).toEqual({ email: email.address, address })
  })
  it('refuses an arbitrary wallet sent by the browser', () => {
    expect(emailIdentity([email, wallet], '0x0000000000000000000000000000000000000000')).toBeNull()
  })
  it('does not treat an imported or unverified email as login proof', () => {
    expect(emailIdentity([{ ...email, verified_at: 0 }, wallet], address)).toBeNull()
    expect(emailIdentity([{ type: 'email', address: email.address }, wallet], address)).toBeNull()
  })
  it('does not treat an unverified wallet as ownership proof', () => {
    expect(emailIdentity([email, { ...wallet, verified_at: 0 }], address)).toBeNull()
  })
  it('refuses a different chain and a non-email account', () => {
    expect(emailIdentity([email, { ...wallet, chain_type: 'solana' }], address)).toBeNull()
    expect(emailIdentity([{ ...email, type: 'google_oauth' }, wallet], address)).toBeNull()
  })
  it('chooses only the requested linked wallet, regardless of account order', () => {
    const other = { ...wallet, address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' }
    expect(emailIdentity([other, email, wallet], other.address.toUpperCase())?.address).toBe(other.address)
  })
})
