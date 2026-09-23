'use client'

import { moneyCopy } from '@desk/shared'
import { ArrowLeftRight, Fuel } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import {
  AmountInput,
  BoundaryBadge,
  Button,
  Callout,
  Card,
  Chip,
  Eyebrow,
  FlowCard,
  Screen,
  ScreenTitle,
  Segmented,
} from '@/components/kit'
import type { FundChain } from './FundScreen'
import { MoveFlow } from './MoveFlow'

const c = moneyCopy.bridge
const USDG_DECIMALS = 6

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
 * Bridge (W6), the reference wallet's two-panel bridge (BridgeScreen.tsx:190-269): the move on the left, how it
 * moves and Get gas on the right. Out sends USDG from your wallet to your same wallet on another chain as USDC or
 * its native coin; In opens Fund on its other-chain source, since money coming in belongs to an agent.
 */
export function BridgeScreen({
  owner,
  initialDir,
  usdgRaw,
  eth,
  outChains,
  gasChains,
}: {
  owner: string
  initialDir: 'out' | 'in'
  usdgRaw: string
  eth: string
  outChains: FundChain[]
  gasChains: FundChain[]
}) {
  const [dir, setDir] = useState(initialDir)
  const [chainId, setChainId] = useState(outChains[0]?.id ?? 8453)
  const chain = outChains.find((ch) => ch.id === chainId)
  const [token, setToken] = useState(chain?.tokens[0]?.address ?? '')
  const [amount, setAmount] = useState('')
  const dest = chain?.tokens.find((t) => t.address === token) ?? chain?.tokens[0]
  const held = formatUnits(BigInt(usdgRaw), USDG_DECIMALS)

  const { input, invalid } = useMemo(() => {
    const raw = toRaw(amount, USDG_DECIMALS)
    if (raw === null || !dest) return { input: null, invalid: null }
    if (raw > BigInt(usdgRaw)) return { input: null, invalid: moneyCopy.fund.moreThanHeld('USDG') }
    return {
      input: { kind: 'bridge_out' as const, amountRaw: raw.toString(), to: { chainId, token: dest.address } },
      invalid: null,
    }
  }, [amount, dest, usdgRaw, chainId])

  return (
    <Screen width={1040} gap={8}>
      <ScreenTitle title={c.title} sub={c.sub} />
      <div style={{ maxWidth: 520, margin: '8px 0' }}>
        <Segmented
          label={c.direction}
          fullWidth
          options={[
            { value: 'out', label: c.dirs.out },
            { value: 'in', label: c.dirs.in },
          ]}
          value={dir}
          onChange={(v) => setDir(v as 'out' | 'in')}
        />
      </div>
      <div className="kit-two">
        <div>
          {dir === 'in' ? (
            <FlowCard
              icon={<ArrowLeftRight size={16} />}
              title={c.inTitle}
              badge={<BoundaryBadge kind="agent" />}
            >
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.55 }}>{c.inBody}</p>
              <Link href={'/fund?from=chain' as Route} style={{ textDecoration: 'none' }}>
                <Button fullWidth>{c.inCta} →</Button>
              </Link>
            </FlowCard>
          ) : (
            <MoveFlow
              title={c.outTitle}
              icon={<ArrowLeftRight size={16} />}
              badge={<BoundaryBadge kind="wallet" />}
              owner={owner}
              input={input}
              invalid={invalid}
              reviewLabel={c.review}
              doneTitle={c.done}
              form={
                <>
                  <Eyebrow>{c.toChain}</Eyebrow>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {outChains.map((ch) => (
                      <Chip
                        key={ch.id}
                        label={ch.name}
                        active={ch.id === chainId}
                        onClick={() => {
                          setChainId(ch.id)
                          setToken(ch.tokens[0]?.address ?? '')
                        }}
                      />
                    ))}
                  </div>
                  <Eyebrow>{c.receiveAs}</Eyebrow>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {chain?.tokens.map((t) => (
                      <Chip
                        key={t.address}
                        label={t.symbol}
                        active={t.address === dest?.address}
                        onClick={() => setToken(t.address)}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      border: '1px solid var(--bd2)',
                      borderRadius: 14,
                      background: 'var(--card)',
                      padding: '20px 16px',
                    }}
                  >
                    <AmountInput
                      prefix="$"
                      unit="USDG"
                      value={amount}
                      onChange={setAmount}
                      invalid={Boolean(invalid)}
                      {...(Number(held) > 0 ? { onMax: () => setAmount(held) } : {})}
                      caption={c.held(Number(held).toLocaleString('en-US', { maximumFractionDigits: 2 }))}
                    />
                  </div>
                  <Callout tone="wallet">{c.toYou}</Callout>
                </>
              }
            />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <strong style={{ fontSize: 14 }}>{c.howTitle}</strong>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {c.how.map((line) => (
                  <li key={line} style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5 }}>
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          </Card>
          <GetGas owner={owner} eth={eth} usdgRaw={usdgRaw} chains={gasChains} />
        </div>
      </div>
    </Screen>
  )
}

/**
 * Get gas: with a little ETH and a dollar of USDG, $1 of USDG swapped to ETH in your wallet; otherwise ETH comes
 * from another chain through Relay.
 */
function GetGas({
  owner,
  eth,
  usdgRaw,
  chains,
}: {
  owner: string
  eth: string
  usdgRaw: string
  chains: FundChain[]
}) {
  // The swap needs a dollar of USDG and a little ETH to pay for itself; without both, gas comes over Relay.
  const canSwap = Number(eth) > 0 && BigInt(usdgRaw) >= 1_000_000n
  const [chainId, setChainId] = useState(chains[0]?.id ?? 8453)
  const chain = chains.find((ch) => ch.id === chainId)
  const [amount, setAmount] = useState('0.0005')
  const native = chain?.tokens[0]

  const input = useMemo(() => {
    if (canSwap) return { kind: 'get_gas' as const }
    const raw = native ? toRaw(amount, native.decimals) : null
    if (raw === null || !native) return null
    return {
      kind: 'get_gas' as const,
      origin: { chainId, token: native.address, amountRaw: raw.toString() },
    }
  }, [canSwap, native, amount, chainId])

  return (
    <div id="gas">
      <MoveFlow
        title={c.gasTitle}
        icon={<Fuel size={16} />}
        owner={owner}
        input={input}
        reviewLabel={c.gasReview}
        doneTitle={c.gasDone}
        form={
          <>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5 }}>
              {c.gasBody} {c.gasHave(Number(eth).toLocaleString('en-US', { maximumFractionDigits: 6 }))}
            </p>
            {canSwap ? (
              <Eyebrow>{c.gasSwap}</Eyebrow>
            ) : (
              <>
                <Eyebrow>{c.gasFrom}</Eyebrow>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {chains.map((ch) => (
                    <Chip
                      key={ch.id}
                      label={`${ch.name} · ${ch.tokens[0]?.symbol ?? ''}`}
                      active={ch.id === chainId}
                      onClick={() => setChainId(ch.id)}
                    />
                  ))}
                </div>
                <AmountInput
                  value={amount}
                  onChange={setAmount}
                  unit={native?.symbol ?? 'ETH'}
                  caption={c.gasFromHint}
                />
              </>
            )}
            <Link
              href={'/wallet#gift' as Route}
              style={{ fontSize: 12, color: 'var(--ac2)', fontWeight: 600 }}
            >
              {c.gift}
            </Link>
          </>
        }
      />
    </div>
  )
}
