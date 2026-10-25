import { meta, text } from '../page';
import type { Adapter } from './index';

// pulls the real image out of a /_next/image?url=... link
function original(img: HTMLImageElement | undefined): string | undefined {
  if (!img) return undefined;
  try {
    const u = new URL(img.currentSrc || img.src, location.href);
    const inner = u.searchParams.get('url');
    return inner ? new URL(inner, location.href).href : u.href;
  } catch {
    return undefined;
  }
}

const images = () => [...document.querySelectorAll('img')];

// episode pages look like /anime/<anilist id>/<season>/<episode>
export const lunar: Adapter = () => {
  const m = location.pathname.match(/^\/anime\/(\d+)\/(\d+)\/(\d+)/);
  if (!m) return null;
  const [, showId, season, episode] = m;

  const show = text('h1') ?? meta('og:title')?.split(/\s+[—-]\s+Episode/i)[0];
  const epTitle = text('h2');

  // the current episode's still sits in the header, the show cover comes from AniList
  const still = original(images().find((i) => /thetvdb\.com/.test(decodeURIComponent(i.src))));
  const cover = original(
    images().find((i) => new RegExp(`anilist\\.co/.+/b?x?${showId}-`).test(decodeURIComponent(i.src))),
  )?.replace('/cover/medium/', '/cover/large/');

  return {
    kind: 'episode',
    title: show,
    subtitle: epTitle && epTitle !== show ? epTitle : undefined,
    season: Number(season),
    episode: Number(episode),
    poster: still ?? cover,
    url: `https://lunarx.to/anime/${showId}/${season}/${episode}`,
  };
};
