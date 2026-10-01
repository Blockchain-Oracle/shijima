import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ desk: vi.fn(), slug: vi.fn(), viewer: vi.fn() }))
vi.mock('@desk/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@desk/db')>()),
  deskById: mocks.desk,
  deskIdBySlug: mocks.slug,
}))
vi.mock('./session', () => ({ signedInAddress: mocks.viewer }))
vi.mock('./db', () => ({ db: () => ({}) }))

import { deskForViewer } from './desk.server'

const id = 'b94afdb8-06d9-4d80-9133-2e17304f99db'
const agent = {
  id,
  name: 'The companies building AI',
  ownerAddress: '0xowner',
  address: '0xagent',
  lifecycle: 'running',
  deployedAt: new Date(),
  shareSlug: null,
  shareEnabled: false,
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.desk.mockResolvedValue(agent)
  mocks.slug.mockResolvedValue(id)
  mocks.viewer.mockResolvedValue(undefined)
})

describe('public beta agent records', () => {
  it('allows a signed-out reader by agent ID without granting owner access', async () => {
    const view = await deskForViewer(id)
    expect(view).toMatchObject({ isOwner: false, face: { id, name: agent.name } })
    expect(view?.face).not.toHaveProperty('ownerAddress')
  })
  it('allows a different owner and a historical share slug even with the old sharing flag off', async () => {
    mocks.viewer.mockResolvedValue('0xsomeoneelse')
    expect(await deskForViewer('desk')).toMatchObject({ isOwner: false, face: { id } })
    expect(mocks.slug).toHaveBeenCalledWith({}, 'desk')
  })
  it('still recognizes the actual owner, and keeps unfinished drafts private', async () => {
    mocks.viewer.mockResolvedValue('0xOWNER')
    expect(await deskForViewer(id)).toMatchObject({ isOwner: true })
    mocks.desk.mockResolvedValue({ ...agent, lifecycle: 'onboarding', deployedAt: null })
    mocks.viewer.mockResolvedValue(undefined)
    expect(await deskForViewer(id)).toBeUndefined()
    mocks.viewer.mockResolvedValue('0xowner')
    expect(await deskForViewer(id)).toMatchObject({ isOwner: true })
  })
  it('still refuses an unknown agent', async () => {
    mocks.desk.mockResolvedValue(undefined)
    expect(await deskForViewer(id)).toBeUndefined()
  })
})
