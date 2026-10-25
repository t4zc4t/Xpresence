import { cleanTitle, cleanUrl, meta, mediaSession, seasonEpisode } from '../page';
import type { Adapter } from './index';

export const appletv: Adapter = () => {
  // the web player sits on top of the show page, so the page meta still describes it
  const session = mediaSession();
  const pageTitle = cleanTitle(meta('og:title') ?? document.title, 'Apple TV\\+?');

  // the session usually has the show as artist/album and the episode as title
  const show = session?.album ?? session?.artist;
  const se = seasonEpisode(session?.title);
  const episodePage = /\/episode\//.test(location.pathname) || !!se.episode || !!show;

  return {
    kind: episodePage ? 'episode' : 'movie',
    title: show ?? pageTitle ?? session?.title,
    subtitle: show ? session?.title : undefined,
    ...se,
    poster: session?.artwork ?? meta('og:image'),
    url: cleanUrl(),
  };
};
