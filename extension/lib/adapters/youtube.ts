import { mediaSession, text } from '../page';
import type { Adapter } from './index';

function videoId(): string | undefined {
  const u = new URL(location.href);
  if (u.pathname === '/watch') return u.searchParams.get('v') ?? undefined;
  const m = u.pathname.match(/^\/(shorts|live)\/([\w-]{6,})/);
  return m?.[2];
}

export const youtube: Adapter = () => {
  const id = videoId();
  if (!id) return null;

  const player = document.querySelector('#movie_player, #player-container-id');
  if (player?.classList.contains('ad-showing') || player?.classList.contains('ad-interrupting')) {
    return { ad: true };
  }

  const session = mediaSession();
  const title =
    text('h1.ytd-watch-metadata yt-formatted-string') ?? text('h1.ytd-watch-metadata') ?? session?.title;
  const channel =
    text('ytd-watch-metadata #owner #channel-name a') ?? text('#owner #channel-name a') ?? session?.artist;
  const live =
    !!document.querySelector('.ytp-live-badge:not([disabled])') &&
    getComputedStyle(document.querySelector('.ytp-live-badge')!).display !== 'none';

  return {
    kind: live ? 'live' : 'video',
    title,
    subtitle: channel,
    poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
  };
};
