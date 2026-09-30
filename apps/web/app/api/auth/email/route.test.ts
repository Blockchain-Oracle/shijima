import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  getUser: vi.fn(),
  ensureOwner: vi.fn(),
  save: vi.fn(),
  session: {} as {
    address?: string
    email?: string
    privyUserId?: string
    nonce?: string
    signedInAt?: string
    save?: () => Promise<void>
  },
}))
vi.mock('@privy-io/node', () => ({
  PrivyClient: class {
    utils() {
      return { auth: () => ({ verifyAccessToken: mocks.verify }) }
    }
    users() {
      return { _get: mocks.getUser }
    }
  },
}))
vi.mock('@desk/db', () => ({ ensureOwner: mocks.ensureOwner }))
vi.mock('@/lib/db', () => ({ db: () => ({}) }))
vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }))

import { POST } from './route'

const address = '0x1234567890123456789012345678901234567890'
const linked = [
  { type: 'email', address: 'owner@example.com', verified_at: 1 },
  { type: 'wallet', address, chain_type: 'ethereum', verified_at: 1 },
]
const request = (body: unknown = { address }, origin = 'http://localhost:3007', token = 'valid-token') =>
  new Request('http://localhost:3007/api/auth/email', {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', 'test-app')
  vi.stubEnv('PRIVY_APP_SECRET', 'test-secret')
  mocks.session = { nonce: 'old-nonce', save: mocks.save }
  mocks.verify.mockResolvedValue({ user_id: 'did:privy:owner' })
  mocks.getUser.mockResolvedValue({ id: 'did:privy:owner', linked_accounts: linked })
})
describe('email session boundary', () => {
  it('rejects cross-origin requests before verifying any token', async () => {
    expect((await POST(request(undefined, 'https://another.example'))).status).toBe(403)
    expect(mocks.verify).not.toHaveBeenCalled()
  })
  it('fails honestly when email is not configured', async () => {
    vi.stubEnv('PRIVY_APP_SECRET', '')
    expect((await POST(request())).status).toBe(503)
  })
  it('requires a provider token and a valid wallet address', async () => {
    expect((await POST(request({ address }, undefined, ''))).status).toBe(401)
    expect((await POST(request({ address: 'owner-wallet' }))).status).toBe(400)
  })
  it('refuses a forged or expired token without writing an owner', async () => {
    mocks.verify.mockRejectedValue(new Error('Invalid signature'))
    expect((await POST(request())).status).toBe(401)
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.ensureOwner).not.toHaveBeenCalled()
  })
  it('fetches current links and rejects wallets removed from the account', async () => {
    mocks.getUser.mockResolvedValue({ id: 'did:privy:owner', linked_accounts: [linked[0]] })
    expect((await POST(request())).status).toBe(403)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('cannot link email to a different wallet’s existing session', async () => {
    mocks.session.address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
    expect((await POST(request({ address, link: true }))).status).toBe(403)
    expect(mocks.ensureOwner).not.toHaveBeenCalled()
  })
  it('requires wallet sign-in before linking, even with a verified provider identity', async () => {
    expect((await POST(request({ address, link: true }))).status).toBe(403)
  })
  it('creates the wallet-scoped session and spends any older wallet nonce', async () => {
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ address })
    expect(mocks.getUser).toHaveBeenCalledWith('did:privy:owner')
    expect(mocks.session).toMatchObject({
      address,
      email: 'owner@example.com',
      privyUserId: 'did:privy:owner',
    })
    expect(mocks.session.nonce).toBeUndefined()
    expect(mocks.save).toHaveBeenCalledOnce()
  })
  it('does not report successful sign-in when the database is unavailable', async () => {
    mocks.ensureOwner.mockRejectedValue(new Error('Database unavailable'))
    expect((await POST(request())).status).toBe(503)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('does not report success when the session cookie cannot be saved', async () => {
    mocks.save.mockRejectedValue(new Error('Cookie write failed'))
    expect((await POST(request())).status).toBe(503)
  })
})
