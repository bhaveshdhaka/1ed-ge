import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

/**
 * Render markdown (journal reflection drafts) to an HTML string, server-side.
 * Raw HTML in the source is escaped by default (no rehype-raw), which keeps
 * the preview safe. Used by the admin preview route only.
 */
export async function renderMarkdown(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(md || '')
  return String(file)
}
