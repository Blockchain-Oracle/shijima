'use client'

import { appCopy, OPENSERV } from '@desk/shared'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  type LinkedWorkspace,
  linkedWorkspacesAction,
  removeWebhookAction,
  saveWebhookAction,
  setAllowChecksAction,
  unlinkWorkspaceAction,
} from '@/app/openserv-actions'
import { openservCodeAction } from '@/app/owner-actions'
import { Switch } from '@/components/ui/switch'
import { When } from '@/components/when'

const c = appCopy.openserv
const POLL_MS = 3000

function useCountdown(to: string | null): string | null {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!to) return setLeft(null)
    const tick = () => setLeft(Math.max(0, new Date(to).getTime() - Date.now()))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [to])
  if (left === null) return null
  const m = Math.floor(left / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Connect OpenServ, honestly: OpenServ has no "sign in with" for other apps, so linking is three plain steps.
 * Add Shijima in OpenServ; send a one-time code from your workspace, and this card turns to the linked workspace
 * by name within seconds; optionally, have every decision start a workflow there. Each linked workspace can be
 * allowed to ask for a look, or unlinked, on its own.
 */
export function OpenservConnect({ deskId }: { deskId: string }) {
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null)
  const [links, setLinks] = useState<LinkedWorkspace[]>([])
  const [why, setWhy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  const left = useCountdown(code?.expiresAt ?? null)
  const expired = left === '0:00'

  const refresh = useCallback(async () => {
    const all = await linkedWorkspacesAction().catch(() => [])
    const mine = all.filter((l) => l.deskId === deskId)
    setLinks((before) => {
      // A new link while a code waits means the code was used: clear it.
      if (mine.length > before.length) setCode(null)
      return mine
    })
  }, [deskId])

  useEffect(() => {
    void refresh()
    if (!code) return
    const t = setInterval(refresh, POLL_MS)
    return () => clearInterval(t)
  }, [code, refresh])

  const make = () =>
    start(async () => {
      setWhy(null)
      const r = await openservCodeAction(deskId)
      if (r.ok) setCode({ code: r.code, expiresAt: r.expiresAt })
      else setWhy(r.why)
    })

  const line = code ? `link ${code.code}` : ''

  return (
    <div className="osc">
      {/* The card around this carries OpenServ's mark, name and tagline, so they are not repeated here. */}
      <p className="osc-what">{c.what}</p>

      <ol className="osc-steps">
        <li>
          <strong>{c.steps.add.title}</strong>
          <p>{c.steps.add.body}</p>
          <a
            className="btn-secondary ov-btn-sm osc-cta"
            href={OPENSERV.agentUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" /> {c.steps.add.cta}
          </a>
          <small>{c.steps.add.pending}</small>
        </li>

        <li>
          <strong>{c.steps.link.title}</strong>
          <p>{c.steps.link.body}</p>
          {code && !expired ? (
            <div className="osc-code">
              <span className="osc-muted">{c.steps.link.send}</span>
              <div className="osc-code-row">
                <code>{line}</code>
                <button
                  type="button"
                  className="ap-chip-btn"
                  onClick={() => {
                    void navigator.clipboard?.writeText(line).then(() => setCopied(true))
                  }}
                >
                  {copied ? (
                    <Check aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Copy aria-hidden="true" className="size-3.5" />
                  )}
                  {copied ? c.steps.link.copied : c.steps.link.copy}
                </button>
              </div>
              <span className="osc-muted">
                {c.steps.link.expires(left ?? '')} {c.steps.link.waiting}
              </span>
            </div>
          ) : (
            <>
              {expired && <p className="osc-why">{c.steps.link.expired}</p>}
              <button
                type="button"
                className="btn-primary ov-btn-sm osc-cta"
                disabled={pending}
                onClick={make}
              >
                {pending ? c.steps.link.making : c.steps.link.make}
              </button>
            </>
          )}
        </li>
      </ol>

      <div className="osc-linked">
        <strong>{c.linkedTitle}</strong>
        {links.length === 0 ? (
          <p className="osc-muted">{c.none}</p>
        ) : (
          <ul>
            {links.map((l) => (
              <LinkedRow key={l.id} link={l} onChange={refresh} />
            ))}
          </ul>
        )}
      </div>
      {why && <p className="osc-why">{why}</p>}
      <p className="osc-credit">{c.credit}</p>
    </div>
  )
}

function LinkedRow({ link, onChange }: { link: LinkedWorkspace; onChange: () => Promise<void> }) {
  const [url, setUrl] = useState('')
  const [why, setWhy] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; why?: string }>) =>
    start(async () => {
      setWhy(null)
      const r = await fn()
      if (!r.ok) setWhy(r.why ?? null)
      await onChange()
    })
  return (
    <li className="osc-row">
      <div className="osc-row-top">
        <span className="osc-ws">
          <Check aria-hidden="true" className="size-3.5" /> {c.workspace(link.workspaceName)}
        </span>
        {link.linkedAt && (
          <span className="osc-muted">
            {c.since('')}
            <When at={link.linkedAt} />
          </span>
        )}
        <button
          type="button"
          className="osc-unlink"
          disabled={pending}
          onClick={() => run(() => unlinkWorkspaceAction(link.id))}
        >
          {c.unlink}
        </button>
      </div>
      <div className="osc-allow">
        <Switch
          checked={link.allowChecks}
          disabled={pending}
          aria-label={c.allowChecks}
          onCheckedChange={(v) => run(() => setAllowChecksAction(link.id, v))}
        />
        <span>
          {c.allowChecks}
          <small>{c.allowChecksNote}</small>
        </span>
      </div>
      <div className="osc-push">
        <strong>{c.steps.push.title}</strong>
        <p className="osc-muted">{c.steps.push.body}</p>
        {link.hasWebhook ? (
          <p className="osc-on">
            {c.steps.push.on}{' '}
            <button
              type="button"
              className="osc-unlink"
              disabled={pending}
              onClick={() => run(() => removeWebhookAction(link.id))}
            >
              {c.steps.push.remove}
            </button>
          </p>
        ) : (
          <div className="osc-code-row">
            <input
              value={url}
              placeholder={c.steps.push.placeholder}
              onChange={(e) => setUrl(e.target.value.trim())}
              aria-label={c.steps.push.title}
            />
            <button
              type="button"
              className="btn-secondary ov-btn-sm"
              disabled={pending || !url}
              onClick={() => run(() => saveWebhookAction(link.id, url))}
            >
              {c.steps.push.save}
            </button>
          </div>
        )}
      </div>
      {why && <p className="osc-why">{why}</p>}
    </li>
  )
}
