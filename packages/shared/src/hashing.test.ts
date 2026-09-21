import { describe, expect, it } from 'vitest'
import {
  assertHashable,
  canonicalJson,
  chainHead,
  hashRecord,
  UnhashableValueError,
  verifyRecord,
  ZERO_HASH,
} from './hashing'

const record = {
  schemaVersion: 1,
  desk: '0x00000000000000000000000000000000000000aa',
  seq: 7,
  prevHash: ZERO_HASH,
  outcome: 'WAIT_REOPEN',
  token: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
  amountUsdg: '120.50',
  gapBps: 149,
  confidence: '0.72',
  rejected: [{ option: 'ACT_NOW', reason: 'premium is not explained by any headline' }],
  note: null,
}

describe('canonicalJson', () => {
  it('sorts keys and is independent of insertion order', () => {
    const a = canonicalJson({ b: 1, a: 'x', c: [3, 2] })
    const b = canonicalJson({ c: [3, 2], a: 'x', b: 1 })
    expect(a).toBe('{"a":"x","b":1,"c":[3,2]}')
    expect(b).toBe(a)
  })
  it('keeps array order, because order is meaning', () => {
    expect(canonicalJson([2, 1])).toBe('[2,1]')
  })
  it('matches the RFC 8785 rules that apply to us', () => {
    // key order is by UTF-16 code unit, so uppercase sorts before lowercase, and digits before both
    expect(canonicalJson({ b: 1, B: 2, '1': 3, a: 4 })).toBe('{"1":3,"B":2,"a":4,"b":1}')
    // escaping is exactly JSON.stringify: control characters escaped, non-ASCII left as is
    expect(canonicalJson({ s: 'line\nbreak "quoted" \u20ac' })).toBe(
      '{"s":"line\\nbreak \\"quoted\\" \u20ac"}',
    )
    expect(canonicalJson({ z: -0 })).toBe('{"z":0}')
    expect(canonicalJson({ n: null, t: true, e: [], o: {} })).toBe('{"e":[],"n":null,"o":{},"t":true}')
  })
})

describe('the no-float rule', () => {
  it('rejects a float and names the path', () => {
    expect(() => assertHashable({ evidence: { price: 222.44 } })).toThrow(/evidence\.price/)
  })
  it('rejects the classic float trap', () => {
    expect(() => canonicalJson({ v: 0.1 + 0.2 })).toThrow(UnhashableValueError)
  })
  it('rejects bigint, undefined, Date and unsafe integers', () => {
    expect(() => canonicalJson({ v: 10n })).toThrow(/bigint/)
    expect(() => canonicalJson({ v: undefined })).toThrow(/undefined/)
    expect(() => canonicalJson({ v: new Date(0) })).toThrow(/plain object/)
    expect(() => canonicalJson({ v: 2 ** 60 })).toThrow(/safe integer/)
  })
  it('accepts decimal strings, integers, booleans, null and nesting', () => {
    expect(() => assertHashable(record)).not.toThrow()
  })
})

describe('hashRecord', () => {
  it('matches the fixed vector. If this changes, every stored record stops verifying', () => {
    expect(hashRecord(record)).toBe(VECTOR)
  })
  it('verifies, and fails when a single character changes', () => {
    const h = hashRecord(record)
    expect(verifyRecord(record, h)).toBe(true)
    expect(verifyRecord({ ...record, amountUsdg: '120.51' }, h)).toBe(false)
    expect(verifyRecord({ ...record, note: '' }, h)).toBe(false)
  })
})

describe('chainHead', () => {
  it('chains, and depends on every input', () => {
    const d1 = hashRecord(record)
    const h1 = chainHead(ZERO_HASH, 1n, d1)
    const h2 = chainHead(h1, 2n, d1)
    expect(h1).not.toBe(h2)
    expect(chainHead(ZERO_HASH, 2n, d1)).not.toBe(h1)
    expect(h1).toMatch(/^0x[0-9a-f]{64}$/)
  })
})

// Frozen 2026-09-19. Cross-checked by a second implementation: Python json.dumps(sort_keys=True,
// separators=(",", ":"), ensure_ascii=False) piped to Foundry `cast keccak` gives this same value.
// If this test ever fails, do not update the constant. Find what changed the bytes.
const VECTOR = '0x48b3816a1fcddb1159fde378e715252ae053ba7cbfc793c18d6a83e961709190'
