export type ChatToken = { symbol: string; name: string; price: number | null; at: string | null }

/** Whole symbols and full company names only: 'meta' must not match 'metaverse'. */
export function matchingChatTokens(tokens: ChatToken[], text: string): ChatToken[] {
  const words = text
    .toUpperCase()
    .replace(/[^A-Z0-9&]+/g, ' ')
    .trim()
  const padded = ` ${words} `
  return tokens
    .filter(
      (t) =>
        padded.includes(` ${t.symbol.toUpperCase()} `) ||
        padded.includes(
          ` ${t.name
            .toUpperCase()
            .replace(/[^A-Z0-9&]+/g, ' ')
            .trim()} `,
        ),
    )
    .slice(0, 4)
}
