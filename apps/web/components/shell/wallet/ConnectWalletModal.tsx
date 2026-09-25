'use client'

import { webCopy } from '@desk/shared'
import { ChevronLeft, Loader2, Wallet } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { robinhood } from 'viem/chains'
import { type Connector, useAccount, useConnect, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { BrandLogo } from '@/components/ui/brand-logo'
import { Modal } from '@/components/ui/modal'
import { Qr } from '@/components/ui/qr'
import { isRejection, useSignIn } from './useSignIn'

const W = webCopy.wallet

type Step = 'pick' | 'connecting' | 'qr' | 'verify'

/**
 * The wallet picker, in the shape RainbowKit made familiar: every wallet this browser has (found through
 * EIP-6963, with its own name and icon), WalletConnect for a wallet on a phone, then one signature to sign in.
 * The wallet is moved to Robinhood Chain on the way, because every transaction after this happens there.
 *
 * Already connected but not signed in, it opens on the signature, with a way to pick another wallet.
 */
export function ConnectWalletModal({
  open,
  onClose,
  onSignedIn,
  signedInAs,
}: {
  open: boolean
  onClose: () => void
  onSignedIn: () => void
  /** The session's wallet, when there is one: reconnecting that same wallet needs no new signature. */
  signedInAs?: string | undefined
}) {
  const { address, isConnected, chainId, connector: active } = useAccount()
  const connectors = useConnectors()
  const { connectAsync } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const signIn = useSignIn()

  const [step, setStep] = useState<Step>('pick')
  const [pending, setPending] = useState<Connector>()
  const [uri, setUri] = useState<string>()
  const [copied, setCopied] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'switching' | 'signing'>('idle')
  const [problem, setProblem] = useState<string>()
  const started = useRef(false)

  // Every opening starts fresh: on the signature when a wallet is already connected, else on the list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on opening; a connection made inside the modal moves the step itself
  useEffect(() => {
    if (!open) return
    setStep(isConnected ? 'verify' : 'pick')
    setProblem(undefined)
    setPhase('idle')
    started.current = false
  }, [open])

  const browserWallets = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected')
  // The plain `injected` connector is the fallback for a wallet that does not announce itself (EIP-6963).
  const fallback =
    browserWallets.length === 0 && typeof window !== 'undefined' && 'ethereum' in window
      ? connectors.find((c) => c.id === 'injected')
      : undefined
  const walletConnect = connectors.find((c) => c.type === 'walletConnect')

  const verify = useCallback(async () => {
    if (!address) return
    setProblem(undefined)
    try {
      if (signedInAs && address.toLowerCase() === signedInAs.toLowerCase()) {
        onSignedIn()
        return
      }
      if (chainId !== robinhood.id) {
        setPhase('switching')
        // A wallet that refuses to switch can still sign in; each transaction asks again when it needs to.
        await switchChainAsync({ chainId: robinhood.id }).catch(() => undefined)
      }
      setPhase('signing')
      await signIn(address)
      onSignedIn()
    } catch (e) {
      setProblem(isRejection(e) ? W.rejected : e instanceof Error ? e.message.split('\n')[0] : undefined)
    } finally {
      setPhase('idle')
    }
  }, [address, chainId, signedInAs, onSignedIn, switchChainAsync, signIn])

  // The signature is asked for as soon as a wallet is connected, once per opening; after a "no", the button asks again.
  useEffect(() => {
    if (open && step === 'verify' && isConnected && address && !started.current) {
      started.current = true
      void verify()
    }
  }, [open, step, isConnected, address, verify])

  const pick = async (connector: Connector) => {
    setProblem(undefined)
    setPending(connector)
    const qr = connector.type === 'walletConnect'
    setStep(qr ? 'qr' : 'connecting')
    setUri(undefined)
    const onMessage = ({ type, data }: { type: string; data?: unknown }) => {
      if (type === 'display_uri' && typeof data === 'string') setUri(data)
    }
    if (qr) connector.emitter.on('message', onMessage)
    try {
      // WalletConnect loads on first use, and its very first connect can fail while it starts; one retry covers it.
      await connectAsync({ connector }).catch((e) => {
        if (!qr || isRejection(e)) throw e
        return connectAsync({ connector })
      })
      started.current = false
      setStep('verify')
    } catch (e) {
      setProblem(isRejection(e) ? W.rejected : (e instanceof Error && e.message.split('\n')[0]) || W.failed)
      setStep('pick')
    } finally {
      if (qr) connector.emitter.off('message', onMessage)
    }
  }

  const other = async () => {
    await disconnectAsync().catch(() => undefined)
    setStep('pick')
    setProblem(undefined)
  }

  const title =
    step === 'verify'
      ? W.verifyTitle
      : step === 'qr'
        ? W.qrTitle
        : step === 'connecting' && pending
          ? W.opening(pending.name)
          : W.pickTitle
  const description =
    step === 'verify'
      ? W.verifyBody
      : step === 'qr'
        ? W.qrBody
        : step === 'connecting'
          ? W.approve
          : W.pickBody

  // At the page root: inside the app frame a fixed panel is clipped by the frame, not the screen.
  if (typeof document === 'undefined') return null
  return createPortal(
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={W.eyebrow}
      title={title}
      description={description}
      closeLabel={W.close}
    >
      {step === 'pick' && (
        <div className="wallet-pick">
          {browserWallets.length > 0 || fallback ? (
            <>
              <span className="wallet-pick-label">{W.installed}</span>
              {(fallback ? [fallback] : browserWallets).map((c) => (
                <WalletRow key={c.uid} connector={c} onPick={pick} />
              ))}
            </>
          ) : (
            <div className="wallet-pick-empty">
              <strong>{W.none}</strong>
              <span>{W.noneBody}</span>
              <div className="wallet-pick-get">
                <a href="https://metamask.io/download" target="_blank" rel="noreferrer">
                  {W.getMetaMask}
                </a>
                <a href="https://rabby.io" target="_blank" rel="noreferrer">
                  {W.getRabby}
                </a>
              </div>
            </div>
          )}
          {walletConnect && (
            <button
              type="button"
              className="wallet-row"
              onClick={() => void pick(walletConnect)}
              data-cursor="hover"
            >
              <span className="wallet-row-icon">
                <BrandLogo brand="walletconnect" size={36} />
              </span>
              <span className="wallet-row-text">
                <span className="wallet-row-name">{W.walletConnect}</span>
                <span className="wallet-row-note">{W.walletConnectNote}</span>
              </span>
            </button>
          )}
        </div>
      )}

      {step === 'connecting' && (
        <div className="wallet-wait">
          {pending?.icon ? (
            <img src={pending.icon} alt="" className="wallet-wait-icon" />
          ) : (
            <Wallet className="h-8 w-8" />
          )}
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {step === 'qr' && (
        <div className="wallet-qr">
          {uri ? (
            <>
              <Qr text={uri} label={W.qrLabel} className="wallet-qr-code" />
              <button
                type="button"
                className="setup-cta"
                onClick={() => {
                  void navigator.clipboard?.writeText(uri).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  })
                }}
              >
                {copied ? W.copied : W.copyLink}
              </button>
            </>
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
          <BackButton onBack={() => setStep('pick')} />
        </div>
      )}

      {step === 'verify' && (
        <div className="wallet-verify">
          <div className="wallet-row wallet-row--static">
            <span className="wallet-row-icon">
              {active?.icon ? <img src={active.icon} alt="" /> : <Wallet className="h-4 w-4" />}
            </span>
            <span className="wallet-row-text">
              <span className="wallet-row-name">{active?.name ?? W.connectedAs}</span>
              <span className="wallet-row-note font-mono">{address}</span>
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={phase !== 'idle'}
            onClick={() => void verify()}
            data-cursor="hover"
          >
            {phase === 'switching' ? W.switching : phase === 'signing' ? W.signing : W.sign}
          </button>
          <button type="button" className="wallet-link" onClick={() => void other()} data-cursor="hover">
            {W.other}
          </button>
        </div>
      )}

      {problem && <p className="type-caption text-loss">{problem}</p>}
    </Modal>,
    document.body,
  )
}

function WalletRow({ connector, onPick }: { connector: Connector; onPick: (c: Connector) => void }) {
  return (
    <button type="button" className="wallet-row" onClick={() => onPick(connector)} data-cursor="hover">
      <span className="wallet-row-icon">
        {connector.icon ? <img src={connector.icon} alt="" /> : <Wallet className="h-4 w-4" />}
      </span>
      <span className="wallet-row-text">
        <span className="wallet-row-name">
          {connector.name === 'Injected' ? 'Browser wallet' : connector.name}
        </span>
      </span>
    </button>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="wallet-link" onClick={onBack} data-cursor="hover">
      <ChevronLeft className="h-3.5 w-3.5" />
      {W.back}
    </button>
  )
}
