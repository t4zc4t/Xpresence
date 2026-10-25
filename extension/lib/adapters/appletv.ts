import { cleanTitle, cleanUrl, meta, mediaSession, seasonEpisode } from '../page';
import type { Adapter } from './index';

export const appletv: Adapter = () => {
  // clips and trailers play in an overlay, so the page title can be anything,
  // the player's own media session is the reliable source
  const session = mediaSession();
  let page = cleanTitle(meta('og:title') ?? document.title, 'Watch Live', 'Apple TV\\+?');
  if (page && /^apple tv\+?$/i.test(page)) page = undefined;

  // episodes come with the show as artist or album
  const show = session?.album ?? session?.artist;
  if (session?.title && show) {
    return {
      kind: 'episode',
      title: show,
      subtitle: session.title,
      ...seasonEpisode(session.title),
      poster: session.artwork ?? meta('og:image'),
      url: cleanUrl(),
    };
  }

  const title = session?.title ?? page;
  const movie = /\/movie\//.test(location.pathname);
  return {
    kind: movie ? 'movie' : 'video',
    title,
    // e.g. the event a highlight belongs to
    subtitle: page && page !== title ? page : undefined,
    poster: session?.artwork ?? meta('og:image'),
    url: cleanUrl(),
  };
};
