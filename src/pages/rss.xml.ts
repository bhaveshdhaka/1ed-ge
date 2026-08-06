import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { fmtDay } from '../lib/dates'

export async function GET(context: { site: URL }) {
  const journal = (await getCollection('journal')).sort((a, b) =>
    b.data.date.localeCompare(a.data.date),
  )
  return rss({
    title: '1ed.ge — public trading journal',
    description: 'A two-year public trading experiment. Every trade, every account, every R.',
    site: context.site,
    items: journal.map((j) => ({
      title: j.data.day ?? j.data.date,
      pubDate: new Date(j.data.date + 'T00:00:00Z'),
      description: j.data.summary,
      link: `/day/${fmtDay(j.data.date)}`,
    })),
    customData: '<language>en-us</language>',
  })
}
