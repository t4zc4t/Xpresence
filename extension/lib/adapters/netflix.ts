import { cleanUrl, seasonEpisode, text } from '../page';
import type { Adapter, Reading } from './index';

interface Art {
  url: string;
  w: number;
}

interface NetflixEpisode {
  id: number;
  seq: number;
  title: string;
  thumbs?: Art[];
  stills?: Art[];
}

interface NetflixVideo {
  id: number;
  type: 'show' | 'movie' | string;
  title: string;
  boxart?: Art[];
  seasons?: { seq: number; episodes: NetflixEpisode[] }[];
}

// the same metadata the player loads, it has episode numbers and artwork
const details = new Map<string, Reading | 'loading' | 'failed'>();

async function load(id: string) {
  details.set(id, 'loading');
  try {
    const res = await fetch(`/nq/website/memberapi/release/metadata?movieid=${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error(String(res.status));
    const v: NetflixVideo = (await res.json()).video;
    const box = pick(v.boxart);
    const titleUrl = `https://www.netflix.com/title/${v.id}`;

    if (v.type === 'show') {
      for (const season of v.seasons ?? []) {
        const ep = season.episodes.find((e) => String(e.id) === id);
        if (!ep) continue;
        details.set(id, {
          kind: 'episode',
          title: v.title,
          subtitle: ep.title,
          season: season.seq,
          episode: ep.seq,
          poster: pick(ep.thumbs) ?? pick(ep.stills) ?? box,
          url: titleUrl,
        });
        return;
      }
    }
    details.set(id, { kind: 'movie', title: v.title, poster: box, url: titleUrl });
  } catch {
    details.set(id, 'failed');
  }
}

// the smallest image that's still big enough for Discord
function pick(art?: Art[]): string | undefined {
  if (!art?.length) return undefined;
  const sorted = [...art].sort((a, b) => a.w - b.w);
  return (sorted.find((a) => a.w >= 300) ?? sorted.at(-1))?.url;
}

// the title overlay disappears when the controls hide, so remember it per video
let overlay: { id: string; reading: Reading } | undefined;

function fromOverlay(id: string): Reading | undefined {
  const box = document.querySelector('[data-uia="video-title"]');
  if (box) {
    const title = text('h4', box) ?? box.firstChild?.textContent?.trim();
    const spans = [...box.querySelectorAll('span')].map((s) => s.textContent?.trim() ?? '').filter(Boolean);
    const epText = spans.find((s) => /^(S\d+\s*:?\s*)?E\d+$/i.test(s));
    const subtitle = spans.find((s) => s !== epText);
    if (title) {
      const se = seasonEpisode(epText);
      overlay = {
        id,
        reading: { kind: se.episode ? 'episode' : 'movie', title, subtitle: se.episode ? subtitle : undefined, ...se },
      };
    }
  }
  return overlay?.id === id ? overlay.reading : undefined;
}

export const netflix: Adapter = () => {
  const id = location.pathname.match(/^\/watch\/(\d+)/)?.[1];
  if (!id) return null;

  const meta = details.get(id);
  if (meta === undefined) void load(id);
  if (meta && typeof meta === 'object') return meta;

  return { ...fromOverlay(id), url: cleanUrl() };
};
