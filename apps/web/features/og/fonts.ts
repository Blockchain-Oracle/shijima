import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The preview face, as Agari loads it (`features/landing/og/fonts.ts`). The shell's Sora comes through
 * `next/font/google` as WOFF2, which satori cannot read, so the OFL Sora SemiBold TTF is vendored beside this file
 * with its licence. Read from disk once per process: no request-time fetch.
 */
const SORA_SEMIBOLD = join(process.cwd(), 'features/og/fonts/Sora-SemiBold.ttf')

let sora: Promise<Buffer> | null = null

export async function ogFonts() {
  sora ??= readFile(SORA_SEMIBOLD)
  const data = await sora
  return [{ name: 'Sora', data, style: 'normal' as const, weight: 600 as const }]
}
