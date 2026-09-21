# 05. News and market-data sources for the after-hours desk

Tested on Saturday 2026-09-19, about 18:00 UTC. A Saturday is the real use case, so the counts below are weekend counts.

Labels: VERIFIED means I ran it in this session or read the official doc or pricing page (cited). UNVERIFIED means I could not test it (no key) or could only find secondary sources.

## 1. Recommendation

- **Primary news source: Finnhub `company-news`.** Free, 60 calls per minute, ticker-scoped, returns unix timestamps, source name, URL and summary. Our load is about 240 calls per day. The limit allows 86,400. It was not live-tested because no key is set. Sign up and run the check in section 9 before building on it.
- **Fallback: Tavily news search.** Live-tested today. Use it only when Finnhub fails or returns nothing on-topic for a ticker that has actually drifted. It cannot be the hourly primary: the free plan is 1,000 credits per month and hourly polling of 10 tickers needs about 7,200.
- **Earnings calendar: Finnhub `calendar/earnings`.** Free on the same key. One call per day covers all tickers.
- **Macro calendar: skip for v1.** Finnhub's economic calendar is premium only. US macro data is not released on weekends anyway. Hardcode the two remaining 2026 Fed meetings as context.
- **Optional small add: SEC EDGAR 8-K check.** Public, no key, no licence risk. One call per stock ticker after Friday 22:00 ET catches after-close filings, which are a real cause of weekend gaps.
- **Do not ship Google News RSS or Yahoo Finance RSS.** Google was the best technical result today, but the feed's own licence line forbids this use. Yahoo is simply weak.

Blunt licensing summary: no free source here gives a clean right to redistribute headlines inside a commercial product. Feeding headlines to the LLM is internal use and is fine everywhere. Showing them to users is the grey part. See section 8.

## 2. Live test results (VERIFIED, run today)

### 2.1 Yahoo Finance RSS per ticker

`GET https://feeds.finance.yahoo.com/rss/2.0/headline?s=NVDA&region=US&lang=en-US`, no key.

```
YAHOO NVDA  http=200 time=0.80s size=12569  items=20
YAHOO SPY   http=200 time=0.94s size=14763  items=20
```

Fields per item: `title`, `description`, `link`, `pubDate`, `guid`. There is no source field. The publisher has to be read from the link domain.

The feed is capped at about 20 items and most of them are not about the ticker. NVDA sample, newest first:

```
Sat 17:48 | finance.yahoo.com | Anthropic Reportedly Delays IPO; OpenAI Expects Massive Cash Burn
Sat 17:47 | fool.com          | The Unexpected Rival Threatening to Shake Up CoreWeave's Market
Sat 17:22 | fool.com          | Warren Buffett Is No Longer Berkshire's Chairman. ...
Sat 17:07 | thestreet.com     | Huang just doubled his chip forecast and blocked a regulator
Sat 16:50 | fool.com          | From Hustle to Hypervigilance: Is Fear of Running Out of Money ...
```

All 10 tickers. "span" is the time between the oldest and newest item. "rel" is how many items mention the company or ticker in title or description.

```
ticker | YAHOO                              | GOOGLE NEWS RSS (intitle query, when:2d)
NVDA   | n=20 span= 3.6h rel= 3/20  0.98s   | n=100 48h=100 rel= 99/100 1.49s
AAPL   | n=18 span=20.6h rel=13/18  1.06s   | n= 98 48h= 98 rel= 96/98  1.53s
TSLA   | n=17 span=23.7h rel=10/17  0.96s   | n=100 48h=100 rel=100/100 1.44s
MSFT   | n=20 span=20.3h rel= 2/20  1.03s   | n=100 48h=100 rel= 98/100 1.48s
SPY    | n=20 span=25.1h rel= 5/20  1.46s   | n=100 48h=100 rel= 80/100 1.39s
QQQ    | n=20 span=30.0h rel= 9/20  2.02s   | n=100 48h=100 rel= 93/100 2.06s
AMZN   | n= 6 span= 7.4h rel= 2/6   0.65s   | n=100 48h=100 rel=100/100 1.33s
META   | n=18 span=22.7h rel= 8/18  1.15s   | n= 70 48h= 70 rel= 59/70  1.23s
GOOGL  | n=19 span=20.3h rel= 5/19  1.66s   | n=100 48h=100 rel= 86/100 1.74s
AMD    | n=20 span=28.5h rel=11/20  1.37s   | n=100 48h=100 rel= 96/100 1.34s
```

Verdict on Yahoo: reject. The NVDA window covered only 3.6 hours, so a cold start on Saturday cannot see Friday night. Only 3 of 20 NVDA items and 2 of 20 MSFT items were on-topic. The feed's terms could not be read from an official Yahoo page (the old developer host no longer resolves). Secondary sources say personal, non-commercial use only. UNVERIFIED.

### 2.2 Google News RSS search per ticker

`GET https://news.google.com/rss/search?q=intitle:Nvidia+OR+intitle:NVDA+when:2d&hl=en-US&gl=US&ceid=US:en`, no key.

```
GOOGLE NVDA http=200 time=1.60s items=100  last48h=100  distinct sources=65
GOOGLE SPY  http=200 time=1.19s items=100  last48h=100  distinct sources=42
```

Fields per item: `title` (publisher name is appended), `link`, `pubDate`, `source` with a `url` attribute holding the publisher domain. NVDA sample:

```
Sat 17:57 | TechPowerUp     | AMD Claims EPYC "Venice" Beats NVIDIA Vera by 2.24x in New White Paper
Sat 16:22 | GuruFocus       | NVIDIA Executives Sell Shares for Tax Obligations Amid AI Discus
Sat 14:49 | thecooldown.com | Trump calls AI danger talk a 'hoax' in phone call to Nvidia CEO
Sat 12:30 | Benzinga        | Intel, Apple, Nvidia and More: 5 Stocks Investors Couldn't Stop Buzzing About
```

Query wording matters. The naive query `"SPY" OR "S&P 500"` returned a MovieWeb article about spy thrillers as its top item. `"S&P 500" OR "Wall Street" stocks` fixed it (80 of 100 on-topic).

Two real problems:

1. Links are opaque Google redirect URLs (`news.google.com/rss/articles/CBMi...`). They open for a person clicking. They are not the publisher URL, so URL-based dedup against other sources does not work.
2. The feed carries this licence line, copied from today's response: "This XML feed is made available solely for the purpose of rendering Google News results within a personal feed reader for personal, non-commercial use. Any other use of the feed is expressly prohibited."

Verdict: best coverage and relevance of anything tested, and prohibited by its own terms. It is also an undocumented endpoint with no published rate limit, so blocking of server IPs is possible (UNVERIFIED). Use it as a development cross-check only. Do not ship it.

### 2.3 Tavily news search

`POST https://api.tavily.com/search` with `Authorization: Bearer $TAVILY_API_KEY`.

Test A, as specified: `{"query":"NVDA Nvidia stock news","topic":"news","days":3,"max_results":10}`

```
TAVILY NVDA http=200 time=3.19s results=7
TAVILY SPY  http=200 time=2.05s results=9
top-level keys: query, follow_up_questions, answer, images, results, response_time, request_id
result keys:    url, title, content, score, published_date, raw_content, id
```

The `days: 3` filter leaks. On a Sep 19 query, NVDA results included items dated Sep 15 and Sep 16. SPY included Sep 13. Only 3 of 7 NVDA items were inside 48 hours, and two of those were the same Motley Fool article on two domains. Always filter on `published_date` yourself.

Test B: `{"query":"Nvidia NVDA","topic":"news","time_range":"day","max_results":10}`

```
http=200 time=1.80s results=9, 8 of 9 dated Sat 19 Sep, 1 dated Fri 18 Sep 20:00
Sat 16:00 | gurufocus.com   | NVIDIA Executives Sell Shares for Tax Obligations Amid AI Discus
Sat 14:43 | finbold.com     | AI sets Nvidia stock price for October 1, 2026
Sat 12:30 | tradingview.com | Intel, Apple, Nvidia and More: 5 Stocks Investors Couldn't Stop Buzzing About
```

`time_range: "day"` works much better than `days`. Timestamps are full RFC 1123 strings, though some are rounded to the hour or to midnight. There is no source field, so derive it from the URL host. `content` is a usable summary.

Cost, from the official credits page: 1,000 free credits per month, basic search costs 1 credit, pay as you go is $0.008 per credit, and the $30 Project plan is the cheapest monthly plan. The key in this shell is on the Researcher plan with 449 of 1,000 credits already used this month (read from `GET /usage`).

### 2.4 Firecrawl search

`POST https://api.firecrawl.dev/v2/search` with `{"query":"...","sources":["news"],"tbs":"qdr:d","limit":10}`.

```
FIRECRAWL NVDA http=200 time=3.11s results=10  keys: title, url, snippet, date, imageUrl, position
FIRECRAWL SPY  http=200 time=1.37s results=0   (query "SPY S&P 500 ETF stock market news")
FIRECRAWL SPY  http=200 time=2.64s results=10  (retry with query "S&P 500 stock market"), creditsUsed=2
```

Relevance was good (Reuters, WSJ, Barron's and MarketWatch for the S&P query). The blocker is the `date` field. It is a relative string such as "22 hours ago" or "3 hours ago", with no absolute timestamp. The agent must reason about whether a headline came before or after a price move, so this disqualifies Firecrawl as a feed. A longer query also returned zero results with no error. Cost is 2 credits per 10 results, with 1,000 free credits per month (official pricing page).

Verdict: reject as a news feed. Keep it for scraping a single article body if that is ever needed.

### 2.5 SEC EDGAR submissions

`GET https://data.sec.gov/submissions/CIK0001045810.json` (NVDA), no key. A descriptive `User-Agent` header was sent.

```
http=200 time=0.85s size=26053 (gzip)
8-K filed 2026-09-03 accepted 2026-09-03T12:03:56Z Thu items 8.01
8-K filed 2026-08-26 accepted 2026-08-26T20:21:19Z Wed items 2.02,9.01   (earnings release)
8-K filed 2026-08-17 accepted 2026-08-17T12:41:33Z Mon items 1.01,2.03,7.01
acceptance weekday histogram, last 1000 filings (UTC): Mon 152, Tue 211, Wed 193, Thu 133, Fri 248, Sat 63, Sun 0
UTC-Saturday acceptances by hour: 00h=40, 01h=15, 02h=8. Forms: 59 Form 4, one 10-Q, 3 others
```

Reading: every "Saturday" acceptance falls between 00:00 and 02:59 UTC, which is Friday 20:00 to 22:00 Eastern. There are zero Sunday acceptances. EDGAR does not publish new filings over the weekend. The useful window is Friday 16:00 to 22:00 ET, when companies drop 8-Ks after the close. SPY and QQQ are funds, so this adds nothing for them.

Official facts (SEC developer pages): no key needed, the submissions API updates with "a typical processing delay of less than a second", and the limit is "no more than 10 requests per second". The 8-K `items` codes are useful evidence: 2.02 is results, 5.02 is an officer change, 1.01 is a material agreement.

Verdict: not a news source. It is a cheap, licence-free signal for "explained". One fetch per stock ticker after Friday 22:00 ET, cached until Monday 06:00 ET. That is 8 calls per weekend.

## 3. Providers evaluated from official docs (no key, so not run)

| Provider | Free tier | Fits 240 calls per day | Verdict | Status |
| --- | --- | --- | --- | --- |
| Finnhub `company-news` | $0, 60 calls per minute, plus a 30 per second cap. 1 year of history and new updates. North American companies only. | Yes, with huge headroom | **Primary** | VERIFIED from docs and pricing page. Weekend volume UNVERIFIED. |
| Finnhub `calendar/earnings` | Free: "1 month of historical earnings and new updates" | Yes | **Earnings source** | VERIFIED from docs |
| Finnhub `calendar/economic` | "Premium Access Required" | n/a | Skip | VERIFIED from docs |
| Massive (formerly Polygon) `GET /v2/reference/news` | $0 Stocks Basic, 5 calls per minute, "Individual use". News is "Included in all Stocks plans", "Updated hourly". | Yes, if calls are spaced | Reasonable second API if Finnhub disappoints. Returns `publisher.name`, `published_utc`, `article_url`, `description` and per-ticker sentiment. | VERIFIED from docs and pricing. Not run. |
| Marketaux `GET /v1/news/all` | $0: 100 requests per day and **3 articles per request** | No | Reject on the free plan. The $29 Basic plan (2,500 per day, 20 per request) would fit. | VERIFIED from pricing and docs. Display terms UNVERIFIED. |
| Alpha Vantage `NEWS_SENTIMENT` | **25 requests per day** | No | Reject. Cheapest paid plan is $49.99 per month. | VERIFIED from pricing page |
| NewsAPI | 100 per day, **articles delayed 24 hours**, development only and "cannot be used in a staging or production environment" | No | Reject. Next plan is $449 per month. | VERIFIED from pricing page |
| Tiingo news | News is **not in the free plan**. Power plan is $30 per month, or $50 for internal commercial use. Licence is internal use only, so no display to others. | No | Reject | VERIFIED from pricing page |
| Benzinga direct | Enterprise sales. A free Basic tier exists on AWS Marketplace (headline, teaser, link). Secondary sources say it is capped at 25 requests per day. | Probably not | Reject for v1 | UNVERIFIED, secondary sources only |

Not on the brief but worth one line: Alpaca's news API is Benzinga-sourced ("All news data is currently provided directly by Benzinga", official docs). Whether it is free and its rate limits are UNVERIFIED.

## 4. Decision 1: primary and fallback, exact calls

### Primary: Finnhub company news

```
GET https://finnhub.io/api/v1/company-news?symbol=NVDA&from=2026-09-16&to=2026-09-19
Header: X-Finnhub-Token: <key>      (or ?token=<key>)
```

- `symbol`, `from` and `to` are all required. Dates are `YYYY-MM-DD`, so filter to 72 hours yourself using `datetime`.
- Response is a JSON array of `{category, datetime (unix seconds), headline, id, image, related, source, summary, url}`.
- Limits: 60 calls per minute on the free plan, 30 per second across all plans, HTTP 429 when exceeded.
- SPY and QQQ: the docs say this endpoint is "only available for North American companies", so ETF coverage is UNVERIFIED. If it comes back thin, use market news for those two: `GET /api/v1/news?category=general` (free, same response shape, supports `minId`).
- UNVERIFIED from memory, check on first run: Finnhub `url` values are often `finnhub.io/api/news?id=...` redirects instead of publisher URLs. If so, dedup on a normalized headline hash as well as the URL.

### Fallback: Tavily

```
POST https://api.tavily.com/search
Header: Authorization: Bearer <key>
Body: {"query":"Nvidia NVDA","topic":"news","time_range":"day","max_results":10,"search_depth":"basic"}
```

Use `time_range: "day"`, or `"week"` plus your own date filter. Do not rely on `days`, which leaked old items in testing. Costs 1 credit per call. Budget it: call only when the ticker has drifted past the threshold **and** Finnhub failed or returned zero on-topic items in the last 24 hours. That is a few dozen calls per weekend, which fits the free plan.

### Normalized shape and minimal TypeScript

```ts
export type NewsItem = {
  ticker: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string; // ISO 8601, UTC
  summary?: string;
};

// Strip tags and control characters, collapse whitespace, cap length.
const clean = (s: string, max: number) =>
  (s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function finnhubNews(ticker: string, hours = 72): Promise<NewsItem[]> {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 3_600_000);
  const res = await fetch(
    `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${day(from)}&to=${day(to)}`,
    { headers: { "X-Finnhub-Token": process.env.FINNHUB_API_KEY! }, signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`finnhub ${res.status}`);
  const rows = (await res.json()) as Array<{
    datetime: number; headline: string; source: string; url: string; summary?: string;
  }>;
  return rows
    .filter((r) => r.datetime * 1000 >= from.getTime())
    .map((r) => ({
      ticker,
      headline: clean(r.headline, 200),
      source: clean(r.source, 60),
      url: r.url,
      publishedAt: new Date(r.datetime * 1000).toISOString(),
      summary: r.summary ? clean(r.summary, 300) : undefined,
    }));
}

export async function tavilyNews(ticker: string, company: string, hours = 72): Promise<NewsItem[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({
      query: `${company} ${ticker}`, topic: "news", time_range: "week", max_results: 10, search_depth: "basic",
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const { results } = (await res.json()) as {
    results: Array<{ url: string; title: string; content: string; published_date?: string }>;
  };
  const cutoff = Date.now() - hours * 3_600_000;
  return results
    .filter((r) => r.published_date && Date.parse(r.published_date) >= cutoff) // the API date filter leaks
    .map((r) => ({
      ticker,
      headline: clean(r.title, 200),
      source: new URL(r.url).hostname.replace(/^www\./, ""),
      url: r.url,
      publishedAt: new Date(r.published_date!).toISOString(),
      summary: clean(r.content, 300),
    }));
}

export async function getNews(ticker: string, company: string): Promise<NewsItem[]> {
  try {
    const items = await finnhubNews(ticker);
    if (items.length > 0) return items;
  } catch { /* fall through to the fallback */ }
  return tavilyNews(ticker, company);
}
```

One step is still needed before the LLM sees anything: a relevance filter. Yahoo showed that a "ticker feed" can be 85 percent off-topic, and Finnhub pulls from similar publishers. Keep items whose headline or summary mentions the company name or ticker, sort newest first, and send at most 8 per ticker.

## 5. Decision 2: earnings calendar

Use Finnhub, same key, no extra integration:

```
GET https://finnhub.io/api/v1/calendar/earnings?from=2026-09-19&to=2026-10-10
```

The response is `{ earningsCalendar: [{ date, hour (bmo | amc | dmh), symbol, epsEstimate, epsActual, revenueEstimate, revenueActual, quarter, year }] }`. The free tier is documented as "1 month of historical earnings and new updates". Call it once per day with no symbol, filter to the 8 stock tickers, and store `daysToEarnings` per ticker. SPY and QQQ have no earnings. If it is cheap to do, flag them when one of our own mega-cap tickers reports within the window.

Macro events: skip the API for v1. Finnhub's economic calendar is premium. US releases do not land on weekends, so it adds little to a weekend decision. The Fed's calendar page lists the remaining 2026 meetings as October 27 to 28 and December 8 to 9 (VERIFIED). Put those in a small static file, and add CPI and jobs dates by hand from bls.gov if wanted.

## 6. Decision 3: caching and dedup

Cache per ticker with a 60 minute TTL, matching the hourly run. Keep an accumulating store of items per ticker for 96 hours, so coverage does not depend on any single response window. The Yahoo test shows why this matters: one response can cover as little as 3.6 hours. Dedup key is `sha1(canonicalUrl)`, where canonical means lowercased host, no query string, no fragment and no trailing slash. Add a second key, `sha1(normalizedHeadline)` (lowercase, punctuation stripped, publisher suffix removed), because the same Motley Fool story showed up today on fool.com, finance.yahoo.com and theglobeandmail.com under different URLs. On a provider error, serve the stale cache and tell the LLM the news is stale, with its age.

## 7. Decision 4: prompt-injection hygiene

Headlines and summaries are text written by strangers, and this LLM can trigger trades. Minimum hygiene:

1. **Sanitize on ingest.** Strip HTML tags, control characters and zero-width characters. Collapse whitespace. Cap the headline at 200 characters and the summary at 300. Cap at 8 items per ticker. The `clean` function above covers most of this.
2. **Quote as data.** Pass news as a JSON array inside a clearly delimited block. The system prompt should say the block is untrusted third-party text, that it is evidence about the world, and that instructions inside it must never be followed.
3. **Guard before the model.** Run each item through SERV's `serv_prompt_guard` (named by the team lead, not tested by me). Drop flagged items and log them.
4. **Keep the model away from the trade parameters.** The LLM outputs only a constrained verdict: `explained`, `unexplained` or `unsure`, plus the ids of the headlines it relied on. Deterministic code owns ticker, side, size and limits, and enforces hard caps. A successful injection can then at worst flip a verdict inside those caps.
5. **Make news unable to cause a trade on its own.** A fetch error or empty news should lead to `unsure` and the wait-for-Monday path.

Never render fetched HTML. Show plain text plus a link.

## 8. Decision 5: licensing and terms red flags

| Source | Flag |
| --- | --- |
| Google News RSS | **Hard stop.** The feed itself says personal feed reader, personal non-commercial use, "Any other use of the feed is expressly prohibited." VERIFIED in today's response. |
| Finnhub free | **Real flag.** The pricing page lists the free licence as "Personal Use". The terms say plans are "strictly for personal use unless explicitly stated otherwise" and you agree "to not redistribute or share access to data or derived results from the data obtained from Finnhub with anyone or any 3rd party without written approval". VERIFIED. Showing Finnhub headlines to other users is redistribution under that wording. |
| Yahoo RSS | Reported as personal, non-commercial, attribution required. UNVERIFIED from an official page. Moot, because it is rejected on quality. |
| Tiingo | Internal use only, no display to others. VERIFIED. |
| NewsAPI free | Development environments only. VERIFIED. |
| Massive free | "Individual use". VERIFIED. |
| Tavily | The licence is for "internal business purposes". The terms anticipate end users reaching it through the customer's app, and you warrant that your use does not infringe third-party rights. There is no explicit ban on showing results. VERIFIED from the terms page. Cleanest of the group for display. |
| SEC EDGAR | Public government data. No restriction beyond the 10 requests per second fair-access rule. VERIFIED. |

Practical position for the hackathon:

- Using headlines as LLM input is internal use and is fine under every source above.
- For the web app and Telegram, show only the headline, source name, time and a link to the publisher. Never show the article body, and never present a provider's summary as your own text. That is the same pattern a search engine uses and keeps copyright exposure low.
- The contract risk with Finnhub's personal-use wording remains. For a demo with one user and no revenue, it is low. Before any real launch, email Finnhub for written approval, or move display to Tavily results or a paid Marketaux plan, and keep Finnhub as LLM input only.
- A safe default that costs nothing: have the agent cite the 1 to 3 headlines it relied on, with links, and not show a full news feed.

## 9. First thing to do with a Finnhub key (2 minutes)

Run this on a Saturday or Sunday. If NVDA returns fewer than about 10 items from the last 48 hours, or SPY returns nothing, swap Massive in as the primary for the affected tickers.

```bash
for T in NVDA SPY; do
  curl -s "https://finnhub.io/api/v1/company-news?symbol=$T&from=$(date -u -v-3d +%F)&to=$(date -u +%F)" \
    -H "X-Finnhub-Token: $FINNHUB_API_KEY" \
  | python3 -c "import sys,json,time; d=json.load(sys.stdin); r=[x for x in d if x['datetime']>time.time()-172800]; print('$T total',len(d),'last48h',len(r)); [print(' ',time.strftime('%a %H:%M',time.gmtime(x['datetime'])),'|',x['source'],'|',x['headline'][:80],'|',x['url'][:50]) for x in r[:8]]"
done
```

## 10. Sources

- Finnhub docs, company news, market news, earnings calendar, economic calendar, rate limits: https://finnhub.io/docs/api/company-news
- Finnhub pricing: https://finnhub.io/pricing
- Finnhub terms: https://finnhub.io/terms-of-service
- Tavily credits and pricing: https://docs.tavily.com/documentation/api-credits
- Tavily terms: https://www.tavily.com/terms
- Firecrawl pricing: https://www.firecrawl.dev/pricing
- Marketaux pricing and docs: https://www.marketaux.com/pricing and https://www.marketaux.com/documentation
- Alpha Vantage premium page, states the free limit: https://www.alphavantage.co/premium/
- NewsAPI pricing: https://newsapi.org/pricing
- Tiingo pricing: https://www.tiingo.com/about/pricing
- Massive pricing and news docs: https://massive.com/pricing and https://massive.com/docs/rest/stocks/news
- Alpaca news docs: https://docs.alpaca.markets/docs/historical-news-data
- SEC EDGAR APIs and fair access: https://www.sec.gov/search-filings/edgar-application-programming-interfaces and https://www.sec.gov/about/developer-resources
- Fed meeting calendar: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
- Benzinga, secondary only: https://aws.amazon.com/marketplace/pp/prodview-xwgvhwowjmw3g
