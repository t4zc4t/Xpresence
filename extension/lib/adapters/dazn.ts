import { cleanUrl, isEndless, mainVideo, meta, mediaSession } from '../page';
import type { Adapter } from './index';

// competition logos come from DAZN's image service, ask it for a bigger png
function bigLogo(): string | undefined {
  const img = [...document.querySelectorAll('img')].find((i) =>
    /^https:\/\/image\.discovery\.indazn\.com\/.+\/v3\/.+\/fill\//.test(i.src),
  );
  return img?.src.replace(/\/fill\/(.+?)\/\d+\/\d+\/\d+\/(webp|png|jpe?g)\/image.*$/, '/fill/$1/80/512/512/png/image');
}

export const dazn: Adapter = () => {
  const video = mainVideo();
  if (!video || !/\/(fixture|home|player)\//.test(location.pathname)) return null;

  // titles look like "DAZN | Football | Ballon d'Or 2026 Ceremony"
  const parts = document.title
    .split('|')
    .map((p) => p.trim())
    .filter((p) => p && !/^dazn$/i.test(p));
  const session = mediaSession();
  const title = session?.title ?? parts.at(-1);
  if (!title) return null;
  const sport = parts.length > 1 ? parts[0] : undefined;

  return {
    kind: isEndless(video) ? 'live' : 'video',
    title,
    subtitle: session?.artist || sport,
    poster: session?.artwork ?? bigLogo() ?? meta('og:image'),
    url: cleanUrl(),
  };
};
