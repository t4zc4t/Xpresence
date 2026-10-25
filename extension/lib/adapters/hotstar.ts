import { cleanTitle, cleanUrl, meta, mediaSession, seasonEpisode } from '../page';
import type { Adapter } from './index';

export const hotstar: Adapter = () => {
  // player pages end in /watch
  if (!/\/watch(\/|$)/.test(location.pathname)) return null;

  const session = mediaSession();
  const pageTitle = cleanTitle(meta('og:title') ?? document.title, 'JioHotstar', 'Hotstar', 'Disney\\+ Hotstar');
  const raw = session?.title ?? pageTitle;
  const se = seasonEpisode(`${raw ?? ''} ${session?.artist ?? ''}`);
  const live = /\/live\b/.test(location.pathname) || !!document.querySelector('[class*="live-badge" i], [data-testid*="live" i]');

  return {
    kind: live ? 'live' : se.episode ? 'episode' : 'movie',
    title: session?.artist && se.episode ? session.artist : raw,
    subtitle: session?.artist && se.episode ? session.title : undefined,
    ...se,
    poster: session?.artwork ?? meta('og:image'),
    url: cleanUrl(),
  };
};
