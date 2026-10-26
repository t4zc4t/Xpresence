import { cleanTitle, cleanUrl, mainVideo, meta, text } from '../page';
import type { Adapter } from './index';

const NOT_CHANNELS = new Set([
  'browse', 'following', 'category', 'categories', 'drops', 'search', 'settings', 'dashboard', 'subscriptions',
  'community-guidelines', 'privacy-policy', 'terms-of-service', 'help', 'login', 'signup', 'video', 'events',
]);

interface ChannelInfo {
  startedAt?: number;
  picture?: string;
}

// the page's own channel data, fetched once per channel
const channels = new Map<string, ChannelInfo | 'loading'>();

async function load(slug: string) {
  channels.set(slug, 'loading');
  try {
    const res = await fetch(`/api/v2/channels/${slug}`, { credentials: 'include' });
    if (!res.ok) throw new Error(String(res.status));
    const c = await res.json();
    // start_time is UTC without a zone, like "2026-10-25 22:46:20"
    const start = c.livestream?.start_time ? Date.parse(`${c.livestream.start_time.replace(' ', 'T')}Z`) : NaN;
    channels.set(slug, { startedAt: Number.isFinite(start) ? start : undefined, picture: c.user?.profile_pic });
  } catch {
    channels.set(slug, {});
  }
}

export const kick: Adapter = () => {
  const parts = location.pathname.split('/').filter(Boolean);
  const slug = parts[0];
  if (!slug || NOT_CHANNELS.has(slug.toLowerCase())) return null;

  const channel = text('h1') ?? slug;
  const streamTitle = text('[data-testid="livestream-title"]');
  const category = text('a[href^="/category/"]');
  const picture = meta('og:image');

  // past broadcasts and clips
  if (parts[1] === 'videos' || parts[1] === 'clips') {
    return {
      kind: 'video',
      title: streamTitle ?? cleanTitle(document.title, 'KICK'),
      subtitle: parts[1] === 'clips' ? `Clip · ${channel}` : channel,
      poster: picture,
      url: cleanUrl(),
    };
  }
  if (parts.length !== 1) return null;

  const info = channels.get(slug);
  if (info === undefined) void load(slug);
  const known = typeof info === 'object' ? info : undefined;

  // live players report no fixed length
  const live = !Number.isFinite(mainVideo()?.duration ?? NaN);

  return {
    kind: live ? 'live' : 'video',
    title: channel,
    subtitle: category,
    caption: streamTitle,
    poster: known?.picture ?? picture,
    startedAt: live ? known?.startedAt : undefined,
    url: `https://kick.com/${slug}`,
  };
};
