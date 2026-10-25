import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { ADAPTERS } from '@/lib/adapters';
import { cleanTitle, cleanUrl, mainVideo, mediaSession, siteIcon } from '@/lib/page';
import { siteForHost } from '@/lib/sites';
import type { ContentMessage, Media } from '@/lib/types';

// how often we re-send an unchanged state, so a restarted background still knows
const HEARTBEAT = 30_000;

export default defineContentScript({
  // registered by the background only for the sites that are switched on
  registration: 'runtime',

  main(ctx) {
    const g = globalThis as { __xpresence?: boolean };
    if (g.__xpresence || browser.extension.inIncognitoContext) return;
    g.__xpresence = true;

    const site = siteForHost(location.hostname);
    if (!site) return;
    const adapter = ADAPTERS[site.id];

    let last: Media | null = null;
    let lastKey = '';
    let sentAt = 0;

    const send = (msg: ContentMessage) => {
      browser.runtime.sendMessage(msg).catch(() => {});
    };

    const read = (): Media | null => {
      const video = mainVideo();
      if (!video) return null;
      const r = adapter();
      if (!r) return null;
      if (r.ad) return last;

      const session = mediaSession();
      const title = r.title ?? session?.title ?? cleanTitle(document.title, site.name);
      if (!title) return null;

      return {
        site: site.id,
        kind: r.kind ?? 'video',
        title,
        subtitle: r.subtitle,
        season: r.season,
        episode: r.episode,
        playing: !video.paused && !video.ended,
        position: Number.isFinite(video.currentTime) ? video.currentTime : undefined,
        duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined,
        poster: r.poster ?? session?.artwork,
        siteIcon: siteIcon(),
        url: r.url ?? cleanUrl(),
      };
    };

    const tick = () => {
      const m = read();
      const now = Date.now();

      if (!m) {
        if (last) send({ type: 'gone' });
        last = null;
        lastKey = '';
        return;
      }

      const key = JSON.stringify({ ...m, position: undefined });
      // where the video should be if nobody seeked
      const expected =
        last?.position != null ? last.position + (last.playing ? (now - sentAt) / 1000 : 0) : undefined;
      const seeked = m.position != null && expected != null && Math.abs(m.position - expected) > 3;

      if (key !== lastKey || seeked || now - sentAt > HEARTBEAT) {
        send({ type: 'media', media: m });
        last = m;
        lastKey = key;
        sentAt = now;
      }
    };

    // react quickly to play/pause/seek, poll for everything else
    let soon: ReturnType<typeof setTimeout> | undefined;
    const tickSoon = () => {
      clearTimeout(soon);
      soon = setTimeout(tick, 250);
    };
    for (const ev of ['play', 'pause', 'seeked', 'ended', 'loadedmetadata', 'emptied']) {
      document.addEventListener(ev, tickSoon, { capture: true, signal: ctx.signal });
    }
    ctx.setInterval(tick, 2000);
    tick();

    window.addEventListener('pagehide', () => send({ type: 'gone' }), { signal: ctx.signal });
  },
});
