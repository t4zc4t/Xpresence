import { cleanUrl, seasonEpisode, text } from '../page';
import type { Adapter, Reading } from './index';

// the title overlay disappears when the controls hide, so remember it per video
let cache: { path: string; reading: Reading } | undefined;

export const netflix: Adapter = () => {
  const path = location.pathname;
  if (!path.startsWith('/watch/')) return null;

  const box = document.querySelector('[data-uia="video-title"]');
  if (box) {
    const title = text('h4', box) ?? box.firstChild?.textContent?.trim();
    const spans = [...box.querySelectorAll('span')].map((s) => s.textContent?.trim() ?? '').filter(Boolean);
    const epText = spans.find((s) => /^(S\d+\s*:?\s*)?E\d+$/i.test(s));
    const subtitle = spans.find((s) => s !== epText);
    if (title) {
      const se = seasonEpisode(epText);
      cache = {
        path,
        reading: {
          kind: se.episode ? 'episode' : 'movie',
          title,
          subtitle: se.episode ? subtitle : undefined,
          ...se,
          url: cleanUrl(),
        },
      };
    }
  }

  if (cache?.path === path) return cache.reading;
  return { url: cleanUrl() };
};
