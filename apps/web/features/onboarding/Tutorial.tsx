'use client'

import { Dialog } from '@base-ui/react/dialog'
import { tutorialCopy as T } from '@desk/shared'
import { XIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { HeaderAccount } from '@/components/shell/HeaderAccount'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SEEN = 'shijima.tutorialSeen'

/** First visit or not: nothing renders until storage is read, so a returning visitor never sees a frame of it. */
function useFirstRun() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(SEEN) !== '1')
    } catch {
      setOpen(true)
    }
  }, [])
  const dismiss = useCallback(() => {
    setOpen(false)
    try {
      window.localStorage.setItem(SEEN, '1')
    } catch {}
  }, [])
  return { open, dismiss }
}

/**
 * Masayume's first-run walkthrough (Agari `features/onboarding/Tutorial.tsx`), carrying the home page's job
 * (design brief 8.1, 8.3): what this is, the weekend fact from our own price log, the five promises, who may not
 * hold Stock Tokens, and Connect. The Base UI dialog brings the focus trap and Escape; the steps are the only thing
 * that changed. A signed-in visitor never sees it.
 */
export function Tutorial({ weekendFact, signedIn }: { weekendFact: string | null; signedIn: boolean }) {
  const { open, dismiss } = useFirstRun()
  const [step, setStep] = useState(0)
  const popupRef = useRef<HTMLDivElement>(null)
  const s = T.steps

  const steps = [
    { title: s.what.title, body: <p>{s.what.body}</p> },
    { title: s.weekend.title, body: <p>{s.weekend.body(weekendFact)}</p> },
    {
      title: s.promises.title,
      body: (
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {s.promises.items.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      ),
    },
    { title: s.region.title, body: <p>{s.region.body}</p> },
    { title: s.connect.title, body: null },
  ]
  const isLast = step === steps.length - 1
  const current = steps[step]

  useEffect(() => {
    if (open && signedIn) dismiss()
  }, [open, signedIn, dismiss])

  if (!open || !current || signedIn) return null

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="tutorial-scrim" />
        <Dialog.Popup
          ref={popupRef}
          initialFocus={popupRef}
          className="tutorial-card rounded-2xl border border-white/10 bg-neutral-900/95 backdrop-blur-xl"
        >
          <div key={step} className="tutorial-step">
            <div className="flex items-start justify-between gap-3 px-8 pt-8 pb-3">
              <Dialog.Title className="font-bold font-display text-2xl text-white">
                {current.title}
              </Dialog.Title>
              <Dialog.Close
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-1 -mr-2 text-gray-600 hover:text-white"
                  />
                }
                aria-label={T.close}
              >
                <XIcon />
              </Dialog.Close>
            </div>

            <div className="px-8 py-5">
              {isLast ? (
                <>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4">
                    <div className="tutorial-eyebrow mb-1 font-mono text-gray-600 uppercase">
                      {s.connect.kicker}
                    </div>
                    <p className="mb-0.5 font-semibold text-sm text-white">{s.connect.heading}</p>
                    <p className="mb-3 text-gray-500 text-xs leading-snug">{s.connect.note}</p>
                    <div className="flex justify-center">
                      <HeaderAccount signedInAs={undefined} />
                    </div>
                  </div>
                  <p className="tutorial-fineprint mt-3 text-gray-600">{s.connect.fineprint}</p>
                </>
              ) : (
                <Dialog.Description render={<div />} className="text-base text-gray-400 leading-relaxed">
                  {current.body}
                </Dialog.Description>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-8 pb-8">
            <ol className="flex gap-1.5" aria-label={T.progress(step + 1, steps.length)}>
              {steps.map((st, i) => (
                <li
                  key={st.title}
                  aria-current={i === step ? 'step' : undefined}
                  className={cn(
                    'h-1 rounded-full transition-all',
                    i === step ? 'w-6 bg-vermilion' : i < step ? 'w-2 bg-white/20' : 'w-2 bg-white/10',
                  )}
                />
              ))}
            </ol>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={dismiss} className="text-gray-500 hover:text-white">
                {T.skip}
              </Button>
              {!isLast && (
                <Button
                  className="rounded-lg font-bold text-sm uppercase tracking-wider"
                  onClick={() => setStep(step + 1)}
                >
                  {T.next}
                </Button>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
