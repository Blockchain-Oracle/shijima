'use client'

import { moneyCopy, short } from '@desk/shared'
import { ArrowLeftRight, ArrowUpFromLine, ArrowUpRight } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatUnits, isAddress, parseUnits } from 'viem'
import { BoundaryBadge, buttonStyle, Callout, Screen, ScreenTitle } from '@/components/kit'
import {
  AssetPicker,
  AssetPill,
  dollars,
  readable,
  TicketAmount,
  TicketArrow,
  TicketBox,
} from '@/components/kit/ticket'
import type { FundAsset } from './FundScreen'
import { MoneyEmpty, WalletList } from './MoneyParts'
import { MoveFlow } from './MoveFlow'
import { ScanButton } from './ScanButton'

const c = moneyCopy.send
const t = moneyCopy.ticket
const ROBINHOOD = 4663

export function toRaw(amount: string, decimals: number): bigint | null {
  if (!/^\d*\.?\d*$/.test(amount) || amount === '' || amount === '.') return null
  try {
    const raw = parseUnits(amount, decimals)
    return raw > 0n ? raw : null
  } catch {
    return null
  }
}

/** What an amount of a held asset is worth, from the wallet's own pricing of what it holds. */
export function worthOf(asset: FundAsset, amount: string): string | null {
  const raw = toRaw(amount, asset.decimals)
  if (raw === null || asset.valueUsd === null || BigInt(asset.balanceRaw) === 0n) return null
  return dollars((asset.valueUsd * Number(raw)) / Number(BigInt(asset.balanceRaw)))
}

/**
 * Send (W6), the reference wallet's public send on the money ticket: what and how much on the left with its logo
 * and chain, the recipient under it with Scan, and the summary and Review on the right. From your own wallet on
 * Robinhood Chain; a token contract is refused, and your own agent is pointed to Fund so it counts as money in.
 */
export function SendScreen({ owner, assets }: { owner: string; assets: FundAsset[] }) {
  const [token, setToken] = useState(assets[0]?.token ?? '')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [picking, setPicking] = useState(false)
  const asset = assets.find((a) => a.token === token)
  const recipient = to.trim()
  const validTo = recipient !== '' && isAddress(recipient)

  const { input, invalid } = useMemo(() => {
    if (!asset) return { input: null, invalid: null }
    if (recipient && !isAddress(recipient)) return { input: null, invalid: c.badAddress }
    const raw = toRaw(amount, asset.decimals)
    if (raw !== null && raw > BigInt(asset.balanceRaw))
      return { input: null, invalid: c.moreThanHeld(asset.symbol) }
    if (!recipient || raw === null) return { input: null, invalid: null }
    return {
      input: {
        kind: 'send' as const,
        recipient: recipient as `0x${string}`,
        source: { chainId: ROBINHOOD, token: asset.token, amountRaw: raw.toString() },
      },
      invalid: null,
    }
  }, [asset, recipient, amount])

  if (!asset) {
    return (
      <Screen width={1100} gap={8}>
        <ScreenTitle title={c.title} sub={c.sub} />
        <MoneyEmpty
          marks={[{ token: 'USDG' }, { chain: 4663 }, { token: 'ETH' }]}
          title={c.emptyTitle}
          body={c.empty}
        >
          <Link href={'/withdraw' as Route} style={buttonStyle('primary')}>
            <ArrowUpFromLine aria-hidden="true" size={16} /> {c.emptyWithdraw}
          </Link>
          <Link href={'/bridge' as Route} style={buttonStyle('secondary')}>
            <ArrowLeftRight aria-hidden="true" size={16} /> {c.emptyBring}
          </Link>
        </MoneyEmpty>
      </Screen>
    )
  }

  const worth = worthOf(asset, amount)

  return (
    <Screen width={1100} gap={8}>
      <ScreenTitle title={c.title} sub={c.sub} />
      <MoveFlow
        title={c.cardTitle}
        icon={<ArrowUpRight size={16} />}
        badge={<BoundaryBadge kind="leaves" />}
        owner={owner}
        input={input}
        invalid={invalid}
        reviewLabel={c.review}
        doneTitle={c.done}
        route={{
          from: { chainId: ROBINHOOD, label: c.fromYou },
          to: { chainId: ROBINHOOD, label: validTo ? short(recipient, 6, 4) : c.toThem },
        }}
        extraRows={validTo ? [{ label: c.to, value: short(recipient, 6, 4) }] : []}
        aside={
          <WalletList
            selected={asset.token}
            lines={assets.map((a) => ({
              key: a.token,
              symbol: a.symbol,
              name: a.name,
              held: readable(a.balanceRaw, a.decimals),
              usd: a.valueUsd === null ? null : dollars(a.valueUsd),
            }))}
          />
        }
        ticket={() => (
          <>
            <TicketBox
              label={t.youSend}
              side={
                <>
                  {t.held(`${readable(asset.balanceRaw, asset.decimals)} ${asset.symbol}`)}
                  <button
                    type="button"
                    onClick={() => setAmount(formatUnits(BigInt(asset.balanceRaw), asset.decimals))}
                  >
                    {t.max}
                  </button>
                </>
              }
              foot={worth ? t.worth(worth) : ' '}
            >
              <TicketAmount
                value={amount}
                onChange={setAmount}
                label={`${asset.symbol} amount`}
                invalid={Boolean(invalid && amount)}
              />
              <AssetPill symbol={asset.symbol} chainId={ROBINHOOD} onClick={() => setPicking(true)} />
            </TicketBox>
            <TicketArrow />
            <TicketBox label={c.to} side={<ScanButton onAddress={setTo} />} foot={c.toHint}>
              <input
                className="kit-ticket-address"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="0x…"
                spellCheck={false}
                autoComplete="off"
                aria-label={c.to}
                data-invalid={(recipient !== '' && !validTo) || undefined}
              />
            </TicketBox>
            <Callout tone="danger" title={c.publicTitle}>
              {c.publicBody}
            </Callout>
            <AssetPicker
              open={picking}
              onClose={() => setPicking(false)}
              title={t.pickToken}
              selected={asset.token}
              options={assets.map((a) => ({
                key: a.token,
                symbol: a.symbol,
                name: a.name,
                chainId: ROBINHOOD,
                held: readable(a.balanceRaw, a.decimals),
                usd: a.valueUsd === null ? null : dollars(a.valueUsd),
              }))}
              onPick={(key) => {
                setToken(key)
                setAmount('')
              }}
            />
          </>
        )}
      />
    </Screen>
  )
}
