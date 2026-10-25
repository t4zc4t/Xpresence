import { cleanUrl, meta, seasonEpisode, text } from '../page';
import type { Adapter } from './index';

export const primevideo: Adapter = () => {
  const player = document.querySelector('.atvwebplayersdk-overlays-container, #dv-web-player');
  if (!player) return null;

  if (document.querySelector('.atvwebplayersdk-ad-timer, .atvwebplayersdk-adtimeindicator-text')) {
    return { ad: true };
  }

  const title = text('.atvwebplayersdk-title-text');
  // looks like "Season 1, Ep. 3 The episode name"
  const sub = text('.atvwebplayersdk-subtitle-text');
  const se = seasonEpisode(sub);
  const subtitle = sub?.replace(/^S(?:eason)?\s*\d+\s*,?\s*Ep(?:isode)?\.?\s*\d+\s*/i, '').trim() || undefined;

  return {
    kind: se.episode ? 'episode' : 'movie',
    title,
    subtitle: se.episode ? subtitle : undefined,
    ...se,
    poster: meta('og:image'),
    url: cleanUrl(),
  };
};
