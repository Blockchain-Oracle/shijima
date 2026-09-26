import { loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { icons } from 'lucide-react';
import { createElement } from 'react';
import { z } from 'zod';
import { Logo } from '@/components/logo';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema.extend({ sources: z.array(z.string()).optional() }),
    postprocess: { includeProcessedMarkdown: true },
  },
  meta: { schema: metaSchema },
});
/** A section's `icon` is a Lucide name, or `logo:<name>` for a partner's real logo (the OpenServ section). */
function icon(name: string | undefined) {
  if (!name) return undefined;
  if (name.startsWith('logo:')) return createElement(Logo, { name: name.slice(5) as never, size: 16, label: true });
  const Icon = icons[name as keyof typeof icons];
  return Icon ? createElement(Icon) : undefined;
}

export const source = loader({ baseUrl: '/', source: docs.toFumadocsSource(), icon });
