'use client'

import { moneyCopy } from '@desk/shared'
import { ArrowUpRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatUnits, isAddress, parseUnits } from 'viem'
import { AmountInput, BoundaryBadge, Callout, Eyebrow, Field, Screen, ScreenTitle } from '@/components/kit'
import { TokenLogo } from '@/components/ui/token-logo'
import type { FundAsset } from './FundScreen'
import { MoveFlow } from './MoveFlow'
import { ScanButton } from './ScanButton'

const c = moneyCopy.send

function toRaw(amount: string, decimals: number): bigint | null {
  if (!/^\d*\.?\d*$/.test(amount) || amount === '' || amount === '.') return null
  try {
    const raw = parseUnits(amount, decimals)
    return raw > 0n ? raw : null
  } catch {
    return null
  }
}

/**
 * Send (W6), the reference wallet's public send (SendScreen.tsx:79-186): what, to whom, how much, from your own
 * wallet on Robinhood Chain. USDG, ETH or a Stock Token, to any address; a token contract is refused, and your own
 * agent is pointed to Fund so it is counted as money in. On a phone, Scan reads an address QR.
 */
export function SendScreen({ owner, assets }: { owner: string; assets: FundAsset[] }) {
  const [token, setToken] = useState(assets[0]?.token ?? '')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const asset = assets.find((a) => a.token === token)

  const { input, invalid } = useMemo(() => {
    if (!asset) return { input: null, invalid: null }
    const recipient = to.trim()
    if (recipient && !isAddress(recipient)) return { input: null, invalid: c.badAddress }
    const raw = toRaw(amount, asset.decimals)
    if (raw !== null && raw > BigInt(asset.balanceRaw))
      return { input: null, invalid: c.moreThanHeld(asset.symbol) }
    if (!recipient || raw === null) return { input: null, invalid: null }
    return {
      input: {
        kind: 'send' as const,
        recipient: recipient as `0x${string}`,
        source: { chainId: 4663, token: asset.token, amountRaw: raw.toString() },
      },
      invalid: null,
    }
  }, [asset, to, amount])

  const held = asset ? formatUnits(BigInt(asset.balanceRaw), asset.decimals) : null

  return (
    <Screen width={560} gap={8}>
      <ScreenTitle title={c.title} sub={c.sub} />
      {assets.length === 0 ? (
        <Callout tone="wallet">{c.empty}</Callout>
      ) : (
        <MoveFlow
          title={c.cardTitle}
          icon={<ArrowUpRight size={16} />}
          badge={<BoundaryBadge kind="leaves" />}
          owner={owner}
          input={input}
          invalid={invalid}
          reviewLabel={c.review}
          doneTitle={c.done}
          form={
            <>
              <Eyebrow>{c.what}</Eyebrow>
              <div className="kit-asset-list">
                {assets.map((a) => (
                  <button
                    key={a.token}
                    type="button"
                    aria-pressed={a.token === token}
                    className="kit-asset"
                    data-on={a.token === token || undefined}
                    onClick={() => {
                      setToken(a.token)
                      setAmount('')
                    }}
                  >
                    <TokenLogo symbol={a.kind === 'usdg' ? 'CASH' : a.symbol} size={26} />
                    <span className="kit-asset-name">
                      <strong>{a.symbol}</strong>
                      <em>{a.name}</em>
                    </span>
                    <span className="kit-asset-held">
                      <b>
                        {Number(formatUnits(BigInt(a.balanceRaw), a.decimals)).toLocaleString('en-US', {
                          maximumFractionDigits: 5,
                        })}
                      </b>
                      <em>{a.valueUsd === null ? '—' : `$${a.valueUsd.toFixed(2)}`}</em>
                    </span>
                  </button>
                ))}
              </div>
              <Field
                label={c.to}
                value={to}
                onChange={setTo}
                placeholder="0x…"
                mono
                invalid={Boolean(to.trim()) && !isAddress(to.trim())}
                right={<ScanButton onAddress={setTo} />}
                hint={c.toHint}
              />
              <div
                style={{
                  border: '1px solid var(--bd2)',
                  borderRadius: 14,
                  background: 'var(--card)',
                  padding: '20px 16px',
                }}
              >
                <AmountInput
                  value={amount}
                  onChange={setAmount}
                  unit={asset?.symbol ?? ''}
                  {...(held && Number(held) > 0 ? { onMax: () => setAmount(held) } : {})}
                  caption={
                    held !== null
                      ? c.available(
                          Number(held).toLocaleString('en-US', { maximumFractionDigits: 6 }),
                          asset?.symbol ?? '',
                        )
                      : undefined
                  }
                />
              </div>
              <Callout tone="danger" title={c.publicTitle}>
                {c.publicBody}
              </Callout>
            </>
          }
        />
      )}
    </Screen>
  )
}
