import { source } from '@/lib/source';
import { guideMarkdown } from '@/lib/llms';
import { site } from '@/lib/site';
export const dynamic = 'force-static';

export async function GET() {
  const pages = await Promise.all(source.getPages().map(guideMarkdown));
  const intro = `# Shijima Docs: full text\n\nDocumentation origin: ${site.docs}\nApplication origin: ${site.app}\nApplication source revision: ${site.revision}\nReviewed: ${site.reviewed}\n\nEach guide includes its canonical URL. Resolve relative documentation links against the docs origin; AppLink components refer to the application origin.\n\n`;
  return new Response(intro + pages.join('\n\n---\n\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
