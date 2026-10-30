import { FeedItem } from '@/types';

export function parseRssItems(xml: string, sourceName: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/^Press release - /, '').trim() || '';
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || '';
    const desc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ?.replace(/<[^>]*>/g, '')
      ?.replace(/&lt;[^&]*&gt;/g, '')
      ?.replace(/&amp;/g, '&')
      ?.replace(/Source :.*$/, '')
      ?.trim() || '';
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || '';
    const categories = [...block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/g)].map((m) => m[1]);
    const guid = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() || link;

    if (!title) continue;

    const parsedDate = pubDate ? new Date(pubDate) : new Date();
    const date = (Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate).toISOString().split('T')[0];

    let type: FeedItem['type'] = 'news';
    const catStr = categories.join(' ').toLowerCase();
    const titleLower = title.toLowerCase();
    const descLower = desc.toLowerCase();
    const combinedText = `${catStr} ${titleLower} ${descLower}`;
    if (combinedText.match(/legislat|regulation|directive|law|adopt|enact|entered into force/)) type = 'legislation';
    else if (combinedText.match(/proposal|draft|recommend|consult|initiative|strategy|roadmap|action plan/)) type = 'proposal';
    else if (combinedText.match(/statistic|eurostat|data|survey|report|figure|percent|growth|rate|index/)) type = 'statistic';

    items.push({
      id: guid,
      title,
      description: desc.slice(0, 300),
      date,
      type,
      relevanceScore: 0.8,
      sourceUrl: link,
      summary: '',
      source: sourceName,
    });
  }

  return items;
}
