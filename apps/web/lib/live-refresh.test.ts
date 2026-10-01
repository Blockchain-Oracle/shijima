import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), cleanup: undefined as undefined | (() => void) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('react', () => ({
  startTransition: (callback: () => void) => callback(),
  useEffect: (effect: () => undefined | (() => void)) => {
    mocks.cleanup = effect() || undefined
  },
}))

import { useLiveRefresh } from '../components/shell/app/useLiveRefresh'

function environment() {
  vi.useFakeTimers()
  const win = new EventTarget()
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
    activeElement: { matches: vi.fn(() => false) },
  })
  const nav = { onLine: true }
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', doc)
  vi.stubGlobal('navigator', nav)
  return { win, doc, nav }
}

afterEach(() => {
  mocks.cleanup?.()
  mocks.cleanup = undefined
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('live data refresh', () => {
  it('refreshes visible data every thirty seconds and removes listeners on navigation', () => {
    const { win } = environment()
    useLiveRefresh('/activity')
    vi.advanceTimersByTime(30000)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    win.dispatchEvent(new Event('focus'))
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
    mocks.cleanup?.()
    vi.advanceTimersByTime(60000)
    win.dispatchEvent(new Event('focus'))
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
  })

  it('waits while hidden, offline or typing, then refreshes when the page becomes visible', () => {
    const { doc, nav } = environment()
    useLiveRefresh('/agents/my-agent')
    doc.visibilityState = 'hidden'
    vi.advanceTimersByTime(30000)
    doc.visibilityState = 'visible'
    nav.onLine = false
    vi.advanceTimersByTime(30000)
    nav.onLine = true
    doc.activeElement.matches.mockReturnValue(true)
    vi.advanceTimersByTime(30000)
    expect(mocks.refresh).not.toHaveBeenCalled()
    doc.activeElement.matches.mockReturnValue(false)
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it.each(['/agents/new', '/agents/my-agent/settings', '/fund', '/send', '/withdraw'])(
    'does not refresh a form at %s',
    (path) => {
      const { win } = environment()
      useLiveRefresh(path)
      vi.advanceTimersByTime(60000)
      win.dispatchEvent(new Event('focus'))
      expect(mocks.refresh).not.toHaveBeenCalled()
    },
  )
})
