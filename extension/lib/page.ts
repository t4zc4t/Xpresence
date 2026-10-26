// Small DOM helpers the site adapters share. Only runs inside content scripts.

export function text(selector: string, root: ParentNode = document): string | undefined {
  const t = root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  return t || undefined;
}

export function meta(name: string): string | undefined {
  const el = document.querySelector<HTMLMetaElement>(`meta[property="${name}"], meta[name="${name}"]`);
  return el?.content?.trim() || undefined;
}

// live players often report a huge or infinite length, and some (DAZN) count from 1970
export function isEndless(v: HTMLVideoElement): boolean {
  return !Number.isFinite(v.duration) || v.duration > 7 * 86400 || v.currentTime > 1e8;
}

// the main video on the page: playing first, then the biggest one
export function mainVideo(): HTMLVideoElement | undefined {
  const videos = [...document.querySelectorAll('video')].filter((v) => v.readyState > 0);
  if (!videos.length) return undefined;
  const area = (v: HTMLVideoElement) => v.clientWidth * v.clientHeight;
  return videos.sort((a, b) => Number(!b.paused) - Number(!a.paused) || area(b) - area(a))[0];
}

export interface SessionInfo {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
}

// lots of players publish this for the OS media controls
export function mediaSession(): SessionInfo | undefined {
  const m = navigator.mediaSession?.metadata;
  if (!m || !m.title) return undefined;
  const art = [...(m.artwork ?? [])].sort((a, b) => size(b.sizes) - size(a.sizes))[0];
  return {
    title: m.title || undefined,
    artist: m.artist || undefined,
    album: m.album || undefined,
    artwork: art ? absolute(art.src) : undefined,
  };
}

function size(sizes?: string): number {
  const n = sizes?.match(/(\d+)x(\d+)/);
  return n ? Number(n[1]) * Number(n[2]) : 0;
}

export function absolute(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, location.href).href;
  } catch {
    return undefined;
  }
}

export function siteIcon(): string | undefined {
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel~="apple-touch-icon"]')];
  const best = links
    .filter((l) => l.href && !l.href.endsWith('.ico') && !l.href.startsWith('data:'))
    .sort((a, b) => size(b.sizes?.value) - size(a.sizes?.value) || Number(b.rel.includes('apple')) - Number(a.rel.includes('apple')))[0];
  return absolute(best?.href);
}

// "S2 E5", "S2:E5", "Season 2, Ep. 5", "Season 2 Episode 5"
export function seasonEpisode(t: string | undefined): { season?: number; episode?: number } {
  if (!t) return {};
  const both = t.match(/S(?:eason)?\s*(\d+)\s*[,:·.\-]?\s*E(?:p(?:isode)?)?\.?\s*(\d+)/i);
  if (both) return { season: Number(both[1]), episode: Number(both[2]) };
  const ep = t.match(/\bE(?:p(?:isode)?)?\.?\s*(\d+)\b/i);
  return ep ? { episode: Number(ep[1]) } : {};
}

// "1:02:03" or "12:34" to seconds
export function clockToSeconds(t: string | undefined): number | undefined {
  const m = t?.match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// strip things like " | Netflix" or " - Apple TV" from page titles
export function cleanTitle(t: string | undefined, ...brands: string[]): string | undefined {
  if (!t) return undefined;
  // some sites put invisible direction marks in their titles
  let out = t.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();
  for (const b of brands) {
    out = out.replace(new RegExp(`\\s*[-|–—:]\\s*(watch\\s+)?${b}.*$`, 'i'), '');
    out = out.replace(new RegExp(`^${b}\\s*[-|–—:]\\s*`, 'i'), '');
  }
  out = out.replace(/^watch\s+/i, '').trim();
  return out || undefined;
}

export function cleanUrl(keep: string[] = []): string {
  const u = new URL(location.href);
  const params = new URLSearchParams();
  for (const k of keep) {
    const v = u.searchParams.get(k);
    if (v) params.set(k, v);
  }
  u.search = params.toString();
  u.hash = '';
  return u.href;
}
