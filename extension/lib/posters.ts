import { browser } from 'wxt/browser';

// the Apple TV app only gives us a window title, so the poster is looked up in Apple's own catalogue
export const POSTER_ORIGIN = 'https://itunes.apple.com/*';

const cache = new Map<string, string | null>();

const plain = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

function country(): string {
  const region = navigator.language.split('-')[1];
  return region && /^[a-z]{2}$/i.test(region) ? region.toLowerCase() : 'us';
}

async function search(title: string, query: string): Promise<string | undefined> {
  const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(title)}&country=${country()}&limit=5&${query}`);
  if (!res.ok) return undefined;
  const { results = [] } = (await res.json()) as { results?: Record<string, string>[] };
  const want = plain(title);
  // only a close name match, so a live match or an unknown title keeps the plain logo
  const hit = results.find((r) => {
    const name = plain(r.trackName ?? r.collectionName ?? r.artistName ?? '');
    return name && (name === want || name.startsWith(want) || want.startsWith(name));
  });
  return hit?.artworkUrl100?.replace(/\/\d+x\d+(bb)?\./, '/600x600bb.');
}

export async function posterFor(title: string): Promise<string | undefined> {
  if (cache.has(title)) return cache.get(title) ?? undefined;
  if (!(await browser.permissions.contains({ origins: [POSTER_ORIGIN] }))) return undefined;
  let url: string | undefined;
  try {
    url = (await search(title, 'media=movie&entity=movie')) ?? (await search(title, 'media=tvShow&entity=tvSeason'));
  } catch {
    return undefined; // offline, try again next time
  }
  cache.set(title, url ?? null);
  return url;
}
