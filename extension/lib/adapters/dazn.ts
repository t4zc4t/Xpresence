import { cleanTitle, cleanUrl, mainVideo, meta, mediaSession } from '../page';
import type { Adapter } from './index';

// DAZN's player fills in the media session like most players, so lean on that
export const dazn: Adapter = () => {
  const video = mainVideo();
  if (!video) return null;

  const session = mediaSession();
  let page = cleanTitle(meta('og:title') ?? document.title, 'DAZN');
  if (page && /^dazn$/i.test(page)) page = undefined;

  const title = session?.title ?? page;
  if (!title) return null;

  return {
    kind: Number.isFinite(video.duration) ? 'video' : 'live',
    title,
    // usually the competition, like "Serie A"
    subtitle: session?.artist || session?.album || (page !== title ? page : undefined),
    poster: session?.artwork ?? meta('og:image'),
    url: cleanUrl(),
  };
};
