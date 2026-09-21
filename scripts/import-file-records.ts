/**
 * Moves the decision records that were written to var/records (before the database existed) into the database.
 *
 *   pnpm records:import               into DATABASE_URL
 *   pnpm records:import --rehearsal   into REHEARSAL_DATABASE_URL, so a fork starts from the real history
 *
 * Nothing is taken on trust. Each file's fingerprint is recomputed, and the transaction is read back from
 * MAINNET: the decision hash in the contract's event must equal that fingerprint, or the import stops.
 * Safe to run again: a record that is already in the database is skipped.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deskAbi, makePublicClient, OFFICIAL_RPC, readDeskState } from '@desk/chain'
import {
  appendRecord,
  appendResult,
  createDb,
  databaseName,
  findDeskByAddress,
  markActionPrepared,
  markActionSent,
  recordChain,
  registerDesk,
  resolveAction,
  verifyChain,
} from '@desk/db'
import { hashRecord, registerSecretsFromEnv } from '@desk/shared'
import { type Address, type Hex, keccak256, parseEventLogs, parseUnits, zeroHash } from 'viem'

registerSecretsFromEnv(process.env)

const ROOT = resolve(import.meta.dirname, '..')
const rehearsal = process.argv.includes('--rehearsal')
const urlName = rehearsal ? 'REHEARSAL_DATABASE_URL' : 'DATABASE_URL'
const url = process.env[urlName]
if (!url) throw new Error(`${urlName} is missing from .env`)
if (rehearsal !== databaseName(url).endsWith('_rehearsal')) {
  throw new Error(
    `${urlName} points at "${databaseName(url)}", which is the wrong kind of database for this run`,
  )
}

interface FileRecord {
  record: {
    schemaVersion: number
    desk: Address
    seq: number
    createdAt: string
    outcome: string
    candidate: { token: Address; side: 'buy' | 'sell'; usdgIn: string }
    serv: { decision: { confidencePercent: number; reasons: { text: string }[] } | null }
    preview: { usdgIn: string; quoteTokenOut: string; minTokenOut: string; deadline: number } | null
  } & Record<string, unknown>
  recordHash: Hex
  private: Record<string, unknown>
  result: ({ txHash: Hex } & Record<string, unknown>) | null
}

// History is always read from real mainnet, even when filling the rehearsal database.
const pub = makePublicClient(
  process.env.ALCHEMY_KEY
    ? [`https://robinhood-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`, OFFICIAL_RPC]
    : [OFFICIAL_RPC],
)
const deployments = JSON.parse(readFileSync(resolve(ROOT, 'packages/chain/deployments.json'), 'utf8'))
const deployment = deployments[deployments.current]
const { db, close } = createDb(url, { max: 2 })

try {
  const base = resolve(ROOT, 'var/records')
  const deskDirs = existsSync(base) ? readdirSync(base) : []
  if (deskDirs.length === 0) console.log('var/records is empty, nothing to import')

  for (const dir of deskDirs) {
    const files = readdirSync(resolve(base, dir))
      .filter((f) => f.endsWith('.json'))
      .sort()
    for (const name of files) {
      const file = JSON.parse(readFileSync(resolve(base, dir, name), 'utf8')) as FileRecord
      const { record, recordHash, result } = file
      const label = `${dir.slice(0, 10)}… record ${record.seq}`

      if (hashRecord(record) !== recordHash)
        throw new Error(`${label}: the file no longer hashes to its fingerprint`)
      if (!result?.txHash || !record.preview) throw new Error(`${label}: only sealed trades can be imported`)

      const [tx, receipt, state] = await Promise.all([
        pub.getTransaction({ hash: result.txHash }),
        pub.getTransactionReceipt({ hash: result.txHash }),
        readDeskState(pub, record.desk),
      ])
      const [bought] = parseEventLogs({ abi: deskAbi, eventName: 'Bought', logs: receipt.logs })
      if (!bought) throw new Error(`${label}: no Bought event in ${result.txHash}`)
      if (bought.args.decisionHash.toLowerCase() !== recordHash.toLowerCase()) {
        throw new Error(
          `${label}: the on-chain decision hash is NOT this record's fingerprint. Import stopped.`,
        )
      }

      const desk = await registerDesk(db, {
        ownerAddress: state.owner,
        deskAddress: record.desk,
        factory: deployment.factory,
        salt: zeroHash,
        contractVersion: deployments.current,
        operator: state.operator,
        name: 'dev desk',
      })
      if ((await recordChain(db, desk.id)).some((r) => r.recordHash === recordHash.toLowerCase())) {
        console.log(`${label}: already in the database, skipped`)
        continue
      }

      const saved = await appendRecord(
        db,
        desk.id,
        () => ({
          record,
          schemaVersion: record.schemaVersion,
          outcome: 'acted',
          mode: 'on_its_own',
          summary: record.serv.decision?.reasons[0]?.text ?? 'imported record',
          decidedAt: new Date(record.createdAt),
          token: record.candidate.token,
          side: record.candidate.side,
          amountUsdg: parseUnits(record.preview?.usdgIn ?? record.candidate.usdgIn, 6),
          ...(record.serv.decision ? { confidencePercent: record.serv.decision.confidencePercent } : {}),
          private: file.private,
          actions: [
            {
              kind: 'buy',
              operator: tx.from,
              token: record.candidate.token,
              amountIn: parseUnits(record.preview?.usdgIn ?? '0', 6),
              expectedOut: parseUnits(record.preview?.quoteTokenOut ?? '0', 18),
              minOut: parseUnits(record.preview?.minTokenOut ?? '0', 18),
            },
          ],
        }),
        { legacyBodyWithoutPrevHash: true },
      )
      const action = saved.actions[0]
      if (!action) throw new Error(`${label}: saved without its action`)
      // The same steps a live send takes, replayed with what the chain says actually happened.
      await markActionPrepared(db, action.id, {
        txHash: result.txHash,
        nonce: tx.nonce,
        calldataHash: keccak256(tx.input),
        deadlineUnix: record.preview.deadline,
      })
      await markActionSent(db, action.id)
      await resolveAction(db, action.id, {
        status: 'confirmed',
        chainSeq: Number(bought.args.seq),
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        actualOut: bought.args.tokenOut,
        feedPriceE8: bought.args.feedPrice,
      })
      await appendResult(db, saved.decision.id, { ...result, importedFrom: `var/records/${dir}/${name}` })
      console.log(`${label}: imported, fingerprint matches tx ${result.txHash}`)
    }
  }

  // The last word: every desk's whole record must verify from the rows alone.
  for (const dir of deskDirs) {
    const desk = await findDeskByAddress(db, dir)
    if (!desk) continue
    const problems = verifyChain(await recordChain(db, desk.id))
    console.log(problems.length === 0 ? `${dir.slice(0, 10)}… record verifies` : problems)
    if (problems.length > 0) process.exitCode = 1
  }
} finally {
  await close()
}
