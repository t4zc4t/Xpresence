import { clockToSeconds, cleanUrl, meta, mediaSession, text } from '../page';
import type { Adapter } from './index';

// first path parts that aren't channel names
const NOT_CHANNELS = new Set([
  'directory', 'videos', 'settings', 'downloads', 'search', 'subscriptions', 'inventory', 'drops', 'wallet',
  'following', 'jobs', 'store', 'turbo', 'prime', 'friends', 'messages', 'payments', 'u', 'team', 'moderator',
  'popout', 'embed', 'login', 'signup', 'p',
]);

// channel pictures come in a few sizes, Discord looks better with the big one
function bigAvatar(url: string | undefined): string | undefined {
  return url?.replace(/-\d+x\d+\.(png|jpe?g|webp)$/i, '-300x300.$1');
}

export const twitch: Adapter = () => {
  if (document.querySelector('[data-a-target="video-ad-label"], [data-a-target="video-ad-countdown"]')) {
    return { ad: true };
  }

  const parts = location.pathname.split('/').filter(Boolean);
  const session = mediaSession();
  const channel = text('h1') ?? session?.artist;
  const avatar = bigAvatar(session?.artwork ?? meta('og:image'));

  // past broadcasts
  if (parts[0] === 'videos' && parts[1]) {
    return {
      kind: 'video',
      title: session?.title ?? text('[data-a-target="stream-title"]'),
      subtitle: channel,
      poster: avatar,
      url: `https://www.twitch.tv/videos/${parts[1]}`,
    };
  }

  // clips, on the channel or on clips.twitch.tv
  if (parts[1] === 'clip' || location.hostname === 'clips.twitch.tv') {
    return {
      kind: 'video',
      title: session?.title,
      subtitle: channel ? `Clip · ${channel}` : 'Clip',
      poster: avatar,
      url: cleanUrl(),
    };
  }

  const name = parts[0];
  if (parts.length !== 1 || !name || NOT_CHANNELS.has(name.toLowerCase())) return null;

  const uptime = clockToSeconds(text('.live-time'));
  const live = uptime != null || !!document.querySelector('.live-indicator-container');
  // offline channels sometimes play an old video, show that instead
  if (!live) return session?.title ? { kind: 'video', title: session.title, subtitle: channel, poster: avatar } : null;

  return {
    kind: 'live',
    title: channel ?? name,
    subtitle: text('[data-a-target="stream-game-link"]'),
    caption: text('[data-a-target="stream-title"]') ?? session?.title,
    poster: avatar,
    startedAt: uptime != null ? Date.now() - uptime * 1000 : undefined,
    url: `https://www.twitch.tv/${name}`,
  };
};
