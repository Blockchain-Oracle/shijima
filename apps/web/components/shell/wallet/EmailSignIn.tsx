'use client'

import { short } from '@desk/shared'
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck, Wallet } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { walletDeadline } from '@/lib/email-wallet'
import { useEmailAuth } from './email-auth-context'

/** One real input gives paste, screen readers and mobile OTP autofill their native behavior. */
export function EmailSignIn({
  onDone,
  onBack,
  linkAddress,
}: {
  onDone: () => void
  onBack: () => void
  linkAddress?: string | undefined
}) {
  const auth = useEmailAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code' | 'wallet'>('email')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const lock = useRef(false)
  const attemptedWallet = useRef(false)
  const attemptedSignIn = useRef<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: each new step focuses its new input
  useEffect(() => {
    input.current?.focus()
  }, [step])
  useEffect(() => {
    if (!resendAt) return
    const update = () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [resendAt])

  const run = useCallback(async (action: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setProblem('')
    try {
      await action()
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not continue. Try again.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }, [])
  const prepareWallet = useCallback(
    () => run(() => walletDeadline(auth.prepareWallet())),
    [auth.prepareWallet, run],
  )
  useEffect(() => {
    if (step === 'email') {
      attemptedWallet.current = false
      attemptedSignIn.current = null
    }
    if (
      step !== 'wallet' ||
      linkAddress ||
      busy ||
      !auth.ready ||
      !auth.authenticated ||
      auth.accounts.length ||
      attemptedWallet.current
    )
      return
    attemptedWallet.current = true
    void prepareWallet()
  }, [step, linkAddress, busy, auth.ready, auth.authenticated, auth.accounts.length, prepareWallet])
  const send = () =>
    run(async () => {
      if (linkAddress) await auth.prepareLink(linkAddress)
      else if (step === 'email') await auth.logout()
      await auth.sendCode(email.trim())
      setStep('code')
      setCode('')
      setResendAt(Date.now() + 30_000)
    })
  const verify = () =>
    run(async () => {
      await auth.verifyCode(code)
      setStep('wallet')
    })
  const finish = useCallback(
    (address: string) =>
      run(async () => {
        await walletDeadline(auth.finish(address, Boolean(linkAddress)))
        onDone()
      }),
    [auth.finish, linkAddress, onDone, run],
  )
  const singleAccount = auth.accounts.length === 1 ? auth.accounts[0] : undefined
  const automaticOwner = linkAddress ?? singleAccount?.address
  const walletConnected =
    !singleAccount?.embedded ||
    auth.wallets.some((w) => w.address.toLowerCase() === singleAccount.address.toLowerCase())
  useEffect(() => {
    if (step !== 'wallet' || linkAddress || !singleAccount?.embedded || walletConnected || busy || problem)
      return
    const timer = setTimeout(
      () =>
        setProblem(
          'Your email is verified, but your wallet is taking longer to connect. Try continuing again in a moment.',
        ),
      40_000,
    )
    return () => clearTimeout(timer)
  }, [step, linkAddress, singleAccount?.embedded, walletConnected, busy, problem])
  useEffect(() => {
    if (
      step !== 'wallet' ||
      busy ||
      problem ||
      !auth.ready ||
      !auth.authenticated ||
      !automaticOwner ||
      (!linkAddress && !walletConnected) ||
      attemptedSignIn.current === automaticOwner
    )
      return
    attemptedSignIn.current = automaticOwner
    void finish(automaticOwner)
  }, [
    step,
    busy,
    problem,
    auth.ready,
    auth.authenticated,
    automaticOwner,
    linkAddress,
    walletConnected,
    finish,
  ])

  return (
    <div className="email-flow">
      <span className="email-emblem" aria-hidden="true">
        <Mail />
      </span>
      {step === 'email' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          {!linkAddress && auth.authenticated && (
            <button
              type="button"
              className="btn btn-secondary w-full"
              disabled={busy}
              onClick={() => setStep('wallet')}
            >
              Continue as {auth.email}
            </button>
          )}
          <label htmlFor="signin-email">Your email address</label>
          <input
            ref={input}
            id="signin-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
          />
          <p className="email-note">
            {linkAddress
              ? 'Verify your wallet, then enter the code we send. Your agents stay with this wallet.'
              : 'We’ll send a six-digit code. New here? Your wallet is created when you sign in.'}
          </p>
          <button className="btn btn-primary w-full" type="submit" disabled={busy || !auth.ready}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRight className="size-4" aria-hidden="true" />
            )}
            {busy ? 'Sending code…' : 'Send me a code'}
          </button>
        </form>
      ) : step === 'code' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void verify()
          }}
        >
          <label htmlFor="signin-code">Enter your verification code</label>
          <p className="email-note">
            Sent to <strong>{email}</strong>. Check your spam folder too.
          </p>
          <input
            ref={input}
            id="signin-code"
            className="email-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            disabled={busy}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            aria-describedby="code-help"
          />
          <p id="code-help" className="email-note">
            Paste the whole code or use your phone’s autofill.
          </p>
          <button className="btn btn-primary w-full" type="submit" disabled={busy || code.length !== 6}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Verifying…' : 'Verify email'}
          </button>
          <div className="email-secondary">
            <button
              type="button"
              className="wallet-link"
              disabled={busy}
              onClick={() => {
                setStep('email')
                setCode('')
                setProblem('')
              }}
            >
              Change email
            </button>
            <button
              type="button"
              className="wallet-link"
              disabled={busy || seconds > 0}
              onClick={() => void send()}
            >
              {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
            </button>
          </div>
        </form>
      ) : (
        <div className="email-flow">
          <p className="email-verified">
            <ShieldCheck className="size-4" aria-hidden="true" /> Email verified
          </p>
          {linkAddress ? (
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={busy}
              onClick={() => void finish(linkAddress)}
            >
              {busy ? 'Linking…' : 'Link email to this wallet'}
            </button>
          ) : auth.accounts.length > 0 ? (
            <>
              <p className="email-note">
                {auth.accounts.length > 1
                  ? 'Choose the wallet whose agents you want to open.'
                  : busy
                    ? 'Signing you in…'
                    : !walletConnected
                      ? 'Connecting your email wallet…'
                      : 'Finishing your sign-in…'}
              </p>
              {auth.accounts.map((a) => (
                <button
                  type="button"
                  key={a.address}
                  className="wallet-row"
                  disabled={busy}
                  onClick={() => void finish(a.address)}
                >
                  <span className="wallet-row-icon">
                    <Wallet className="size-4" aria-hidden="true" />
                  </span>
                  <span className="wallet-row-text">
                    <span className="wallet-row-name">
                      {a.embedded ? 'Your email wallet' : 'Your linked wallet'}
                    </span>
                    <span className="wallet-row-note">{short(a.address, 6, 4)}</span>
                  </span>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="size-4 ml-auto" aria-hidden="true" />
                  )}
                </button>
              ))}
            </>
          ) : (
            <>
              <p className="email-note" role="status">
                {busy
                  ? 'Creating your wallet… This usually takes a few seconds.'
                  : 'Your email is verified. Let’s finish setting up your wallet.'}
              </p>
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={busy || !auth.ready}
                onClick={() => void prepareWallet()}
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {busy ? 'Preparing wallet…' : problem ? 'Try again' : 'Create my wallet'}
              </button>
            </>
          )}
        </div>
      )}
      {problem && (
        <p className="type-caption text-loss" role="alert">
          {problem}
        </p>
      )}
      <button type="button" className="wallet-link" disabled={busy} onClick={onBack}>
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Back
      </button>
      <p className="email-note email-footnote">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> No password. You approve wallet transactions
        separately.
      </p>
    </div>
  )
}
