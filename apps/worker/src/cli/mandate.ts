/**
 * Gives the dev desk a real mandate, and starts it. LOCAL DEVELOPMENT: the owner does this on the website.
 *
 *   pnpm desk:mandate --preset broad-market --per-action 5 --daily 15
 *   pnpm desk:mandate --targets NVDA=2000,SPY=3000 --cash 5000 --per-action 5 --daily 15
 *   pnpm desk:mandate --show
 *
 * Optional: --tolerance 300  --max-position 5000  --loss-stop 1500  --large 100  --notes "..."
 * Weights and the three percentages are basis points. Dollar amounts are whole USDG.
 */
import { APPROVED_TOKENS } from '@desk/chain'
import { applyMandate, currentMandate, startDesk } from '@desk/db'
import {
  checkMandate,
  DEFAULT_LIMITS,
  errorText,
  Mandate,
  presetById,
  presetMaxPositionBps,
} from '@desk/shared'
import { formatUnits, parseUnits } from 'viem'
import { openCli, readDevDesk, registerDevDesk } from './context'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : (process.argv[i + 1] ?? '')
}
const bySymbol = (symbol: string) => {
  const token = APPROVED_TOKENS.find((t) => t.symbol === symbol.toUpperCase())
  if (!token) throw new Error(`${symbol} is not on the approved list`)
  return token
}
const symbolOf = (address: string) =>
  APPROVED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())?.symbol ?? address

const cli = await openCli()
try {
  const { deployment, state } = await readDevDesk(cli.deps)
  const desk = await registerDevDesk(cli.db, deployment, state)

  if (process.argv.includes('--show')) {
    const row = await currentMandate(cli.db, desk.id)
    if (!row) throw new Error('this desk has no mandate yet')
    console.log(
      `mandate v${row.version}${row.preset ? ` (${row.preset})` : ''}, applied ${row.appliedAt?.toISOString()}`,
    )
    for (const t of row.targets.tokens)
      console.log(`  ${symbolOf(t.token).padEnd(6)} ${(t.weightBps / 100).toFixed(1)}%`)
    console.log(`  cash   ${(row.targets.cashBps / 100).toFixed(1)}%`)
    console.log(
      `  may wander ${row.driftToleranceBps} bps, largest holding ${row.maxPositionBps} bps, loss limit ${row.lossStopBps} bps`,
    )
    console.log(
      `  per action $${formatUnits(row.perActionCapUsdg, 6)}, per day $${formatUnits(row.dailyCapUsdg, 6)}, asks first from $${formatUnits(row.largeActionUsdg, 6)}`,
    )
  } else {
    const presetId = arg('preset')
    const preset = presetId ? presetById(presetId) : undefined
    if (presetId && !preset) throw new Error(`no preset called "${presetId}"`)
    const pairs: [string, number][] = preset
      ? Object.entries(preset.weights)
      : (arg('targets') ?? '')
          .split(',')
          .filter(Boolean)
          .map((p) => {
            const [symbol, bps] = p.split('=')
            return [symbol ?? '', Number(bps)]
          })
    if (pairs.length === 0) throw new Error('give --preset <id> or --targets SYMBOL=bps,...')

    const usd = (name: string, fallback: string) => parseUnits(arg(name) ?? fallback, 6)
    const mandate = Mandate.parse({
      preset: preset?.id ?? null,
      targets: {
        cashBps: preset ? preset.cashBps : Number(arg('cash') ?? '0'),
        tokens: pairs.map(([symbol, weightBps]) => ({ token: bySymbol(symbol).address, weightBps })),
      },
      driftToleranceBps: Number(arg('tolerance') ?? DEFAULT_LIMITS.driftToleranceBps),
      maxPositionBps: Number(
        arg('max-position') ?? (preset ? presetMaxPositionBps(preset) : DEFAULT_LIMITS.maxPositionBps),
      ),
      lossStopBps: Number(arg('loss-stop') ?? DEFAULT_LIMITS.lossStopBps),
      perActionCapUsdg: usd('per-action', '5'),
      dailyCapUsdg: usd('daily', '15'),
      largeActionUsdg: usd('large', '100'),
      notes: arg('notes') ?? '',
    })
    const problems = checkMandate(mandate, APPROVED_TOKENS)
    if (problems.length > 0)
      throw new Error(`this mandate does not hold together:\n  ${problems.join('\n  ')}`)

    const row = await applyMandate(cli.db, desk.id, mandate, { actor: 'owner', via: 'worker' })
    await startDesk(cli.db, desk.id)
    console.log(`mandate v${row.version} applied and the desk is running in ${desk.mode} mode.`)
    console.log('  pending approvals and remembered waits from the old mandate were cancelled.')
  }
} catch (e) {
  console.error(errorText(e))
  process.exitCode = 1
} finally {
  await cli.close()
}
