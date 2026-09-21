/**
 * The database, for everything that reads or writes desks.
 *
 * Migrating and recreating a database are NOT here: they need a filesystem path, which a bundled web app
 * cannot give. Import them from '@desk/db/migrate' and '@desk/db/admin', which only a command or the worker does.
 */
export * from './client'
export * from './queries/actions'
export * from './queries/desks'
export * from './queries/engine'
export * from './queries/mandates'
export * from './queries/market'
export * from './queries/public'
export * from './queries/records'
export * from './queries/serv'
export * from './queries/wakes'
export * as schema from './schema'
