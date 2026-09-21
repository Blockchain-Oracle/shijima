'use client'

import { settingsCopy } from '@desk/shared'
import qrcode from 'qrcode-generator'
import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  type TelegramState,
  telegramCodeAction,
  telegramStateAction,
  telegramUnlinkAction,
} from '@/app/owner-actions'
import { Button } from '@/components/ui/button'

const t = settingsCopy.telegram
const POLL_MS = 3000

/** The QR code as plain SVG squares, so nothing is ever injected into the page as HTML. */
function Qr({ text }: { text: string }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const n = qr.getModuleCount()
    const dark: [number, number][] = []
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push([c, r])
    return { n, dark }
  }, [text])
  return (
    <svg
      className="settings-qr"
      viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`}
      role="img"
      aria-label={t.scan}
      shapeRendering="crispEdges"
    >
      <rect x={-2} y={-2} width={cells.n + 4} height={cells.n + 4} fill="#fff" />
      {cells.dark.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#141210" />
      ))}
    </svg>
  )
}

/**
 * Connect Telegram (design brief 8.8): a button, then a QR code and a link that open @ShijimaBot with a one-time
 * code. The page watches for the bot to claim the code and shows "Connected as @name" as soon as it does.
 */
export function TelegramConnect({ deskId, initial }: { deskId: string; initial: TelegramState }) {
  const [state, setState] = useState(initial)
  const [code, setCode] = useState<string | null>(initial?.pending?.code ?? null)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // While a code is out, look every few seconds for the bot to have claimed it.
  useEffect(() => {
    if (!code || state?.linked) return
    const timer = setInterval(async () => {
      const next = await telegramStateAction(deskId).catch(() => null)
      if (!next) return
      setState(next)
      if (next.linked) setCode(null)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [code, state?.linked, deskId])

  if (state?.linked) {
    return (
      <div className="flex flex-col gap-3">
        <p className="type-body text-profit">{t.connected(state.linked.username)}</p>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const done = await telegramUnlinkAction(deskId)
              if (done.ok) {
                setState({ linked: null, pending: null })
                setNote(t.disconnected)
              }
            })
          }
        >
          {t.disconnect}
        </Button>
      </div>
    )
  }

  const link = code ? `https://t.me/${t.bot}?start=${code}` : null
  return (
    <div className="flex flex-col gap-3">
      {note && <p className="type-caption text-ink-secondary">{note}</p>}
      {link && code ? (
        <div className="settings-telegram">
          <Qr text={link} />
          <div className="flex flex-col gap-2">
            <p className="type-caption text-ink-secondary">{t.scan}</p>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="type-body-strong text-accent hover:underline"
            >
              {t.open} ↗
            </a>
            <p className="type-caption text-ink-muted">{t.orSend(code)}</p>
            <p className="type-caption text-ink-muted" role="status">
              {t.waiting}
            </p>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setProblem(null)
              const made = await telegramCodeAction(deskId)
              if (made.ok) setCode(made.code)
              else setProblem(made.why)
            })
          }
        >
          {pending ? t.making : t.connect}
        </Button>
      )}
      {problem && <p className="type-caption text-loss">{problem}</p>}
      <p className="type-caption text-ink-muted">{t.without}</p>
    </div>
  )
}
