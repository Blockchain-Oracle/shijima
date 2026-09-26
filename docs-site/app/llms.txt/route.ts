import { source } from '@/lib/source';
import { site } from '@/lib/site';
export const dynamic = 'force-static';

export function GET() {
  const start = ['/start/what-is-shijima', '/agent/how-it-decides', '/architecture/overview'];
  const pages = source.getPages();
  const priority = start.flatMap(url => pages.filter(page => page.url === url));
  const entry = (page: (typeof pages)[number]) => {
    const raw = `${site.docs}/raw/${page.slugs.join('/')}`;
    return `- [${page.data.title}](${site.docs}${page.url}): ${page.data.description || ''} [Markdown](${raw})`;
  };
  const text = `# Shijima Docs

> Shijima gives each person an AI agent that keeps a basket of US Stock Tokens on plan around the clock on Robinhood Chain mainnet (chain 4663). It runs on OpenServ and decides timing with SERV Reasoning. Reviewed ${site.reviewed}.

## Start here

${priority.map(entry).join('\n')}

## All guides

${pages.filter(page => !start.includes(page.url)).map(entry).join('\n')}

## Complete export

- [Full documentation text](${site.docs}/llms-full.txt)
- [Source code](${site.source})
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
