import { browser } from 'wxt/browser';

// the Apple TV app only gives us a window title, so we look it up on Apple TV's own search page,
// which has art for films, shows and live matches alike
export const POSTER_ORIGIN = 'https://tv.apple.com/*';

interface Item {
  title?: string;
  artwork?: { template?: string; width?: number; height?: number };
}

const cache = new Map<string, string | null>();

const words = (t: string) => t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

// "Miami vs. Cincinnati" matches "Inter Miami vs. FC Cincinnati", and "F1" matches "F1 The Movie"
export function sameTitle(a: string, b: string): boolean {
  const x = new Set(words(a));
  const y = new Set(words(b));
  if (!x.size || !y.size) return false;
  const inside = (p: Set<string>, q: Set<string>) => [...p].every((w) => q.has(w));
  return inside(x, y) || inside(y, x);
}

function storefront(): string {
  const region = navigator.language.split('-')[1];
  return region && /^[a-z]{2}$/i.test(region) ? region.toLowerCase() : 'us';
}

export function findArt(data: unknown, title: string): string | undefined {
  const items: Item[] = [];
  const walk = (o: unknown) => {
    if (!o || typeof o !== 'object' || items.length > 40) return;
    const it = o as Item;
    if (typeof it.title === 'string' && it.artwork?.template) items.push(it);
    else for (const v of Object.values(o)) walk(v);
  };
  walk(data);
  const hit = items.find((i) => sameTitle(i.title!, title));
  const art = hit?.artwork;
  if (!art?.template) return undefined;
  const w = 600;
  const h = art.width && art.height ? Math.round((w * art.height) / art.width) : 900;
  return art.template.replace('{w}', String(w)).replace('{h}', String(h)).replace('{f}', 'jpg');
}

export async function posterFor(title: string): Promise<string | undefined> {
  if (cache.has(title)) return cache.get(title) ?? undefined;
  if (!(await browser.permissions.contains({ origins: [POSTER_ORIGIN] }))) return undefined;
  let url: string | undefined;
  try {
    const res = await fetch(`https://tv.apple.com/${storefront()}/search?term=${encodeURIComponent(title)}`);
    if (!res.ok) return undefined;
    const html = await res.text();
    const json = html.match(/<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    url = json ? findArt(JSON.parse(json), title) : undefined;
  } catch {
    return undefined; // offline or the page changed, try again next time
  }
  cache.set(title, url ?? null);
  return url;
}
