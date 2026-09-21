/**
 * Canonical hashing of decision records.
 *
 * The fingerprint written on-chain must be reproducible by anyone, in any language, from the stored
 * record. Serialisation follows RFC 8785 (JSON Canonicalization Scheme) and the hash is keccak256.
 *
 * Hard rule: no floats and no bigints inside a hashed record. `0.1 + 0.2` serialises as
 * `0.30000000000000004`, which a second implementation may not reproduce. Every amount, price, weight
 * and ratio is a decimal STRING or a safe integer (basis points, seconds, counts).
 *
 * Why there is no dependency here. With floats banned, RFC 8785 reduces to two things that JavaScript
 * already does exactly as the RFC requires: object keys sorted by UTF-16 code units (the default
 * Array.prototype.sort order), and string escaping identical to JSON.stringify. So the whole canonical
 * form is a dozen lines. The npm package `canonicalize` was the original pick. It was dropped on
 * 2026-09-19 because its newest release was one day old and it sits on the path that guards money.
 * Any RFC 8785 library in any language still reproduces these bytes for our restricted value domain.
 */
import { type Hex, keccak256, toBytes } from 'viem'

export { chainHead } from './chain-head'

export const ZERO_HASH: Hex = `0x${'0'.repeat(64)}`

export class UnhashableValueError extends Error {
  constructor(path: string, why: string) {
    super(`Record is not hashable at ${path || '<root>'}: ${why}`)
    this.name = 'UnhashableValueError'
  }
}

function serialise(value: unknown, path: string): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value)
    case 'boolean':
      return value ? 'true' : 'false'
    case 'number':
      if (!Number.isSafeInteger(value)) {
        throw new UnhashableValueError(path, `number ${value} is not a safe integer. Use a decimal string.`)
      }
      return String(value === 0 ? 0 : value) // -0 becomes 0, as the RFC requires
    case 'bigint':
      throw new UnhashableValueError(path, 'bigint. Call .toString() first.')
    case 'undefined':
      throw new UnhashableValueError(path, 'undefined. Use null so the field is visible in the record.')
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((v, i) => serialise(v, `${path}[${i}]`)).join(',')}]`
      }
      if (Object.getPrototypeOf(value) !== Object.prototype) {
        throw new UnhashableValueError(
          path,
          'not a plain object (Date, Map, class instance). Convert it first.',
        )
      }
      const obj = value as Record<string, unknown>
      const body = Object.keys(obj)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${serialise(obj[k], path ? `${path}.${k}` : k)}`)
      return `{${body.join(',')}}`
    }
    default:
      throw new UnhashableValueError(path, `unsupported type ${typeof value}`)
  }
}

/** Throws if the value breaks the no-float rule. Names the offending path. */
export function assertHashable(value: unknown): void {
  serialise(value, '')
}

/** RFC 8785 canonical JSON for our restricted value domain. */
export function canonicalJson(value: unknown): string {
  return serialise(value, '')
}

/** keccak256 over the canonical JSON bytes (UTF-8). This is the `decisionHash` sent on-chain. */
export function hashRecord(record: unknown): Hex {
  return keccak256(toBytes(canonicalJson(record)))
}

/** Recompute and compare. Used by the "Check it" button and by the worker after every transaction. */
export function verifyRecord(record: unknown, expected: Hex): boolean {
  return hashRecord(record).toLowerCase() === expected.toLowerCase()
}
