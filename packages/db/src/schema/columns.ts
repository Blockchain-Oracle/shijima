/**
 * Column helpers shared by every table.
 *
 * Money rule, same as the rest of the codebase: no floats. An amount is a bigint in code and an exact
 * numeric in Postgres. Addresses and hashes are stored LOWERCASE so equality is plain string equality, and a
 * CHECK makes a mixed-case or truncated value fail at the door instead of silently never matching.
 */
import { sql } from 'drizzle-orm'
import { type AnyPgColumn, check, customType, timestamp } from 'drizzle-orm/pg-core'

/**
 * An exact unsigned on-chain integer. numeric(78,0) holds a full uint256. Used for raw token units, USDG
 * (6 decimals), prices scaled to 8 decimals like the feed, gas, and multipliers. bigint in code.
 */
export const uint = customType<{ data: bigint; driverData: string }>({
  dataType: () => 'numeric(78, 0)',
  toDriver: (value) => value.toString(),
  fromDriver: (value) => BigInt(value),
})

/** An exact SIGNED integer in the same numeric(78,0), for running totals that go below zero. bigint in code. */
export const int = customType<{ data: bigint; driverData: string }>({
  dataType: () => 'numeric(78, 0)',
  toDriver: (value) => value.toString(),
  fromDriver: (value) => BigInt(value),
})

/** All times are stored in UTC. The web app shows the owner's local time, and New York time for market hours. */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

/** Solidity reverts on underflow. A JavaScript bigint just goes negative. The database refuses it. */
export const nonNegative = (name: string, column: AnyPgColumn) => check(name, sql`${column} >= 0`)

export const isAddress = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} ~ '^0x[0-9a-f]{40}$'`)

export const isHash32 = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} ~ '^0x[0-9a-f]{64}$'`)
