import { describe, expect, it } from 'vitest';
import { basicActivity, buildActivity, sameActivity } from './activity';
import { cleanTitle, clockToSeconds, seasonEpisode } from './page';
import { DEFAULTS, merge } from './settings';
import type { Media } from './types';

const show: Media = {
  site: 'netflix',
  kind: 'episode',
  title: 'Severance',
  subtitle: 'Who Is Alive?',
  season: 2,
  episode: 5,
  playing: true,
  position: 60,
  duration: 3000,
  siteIcon: 'https://www.netflix.com/icon.png',
  url: 'https://www.netflix.com/watch/81234567',
};

const settings = merge({ sites: { ...DEFAULTS.sites, netflix: { on: true, hideTitle: false } } });

describe('buildActivity', () => {
  it('builds a watching card with progress', () => {
    const a = buildActivity(show, settings, 1_000_000);
    expect(a.type).toBe(3);
    expect(a.name).toBe('Netflix');
    expect(a.details_url).toBe(show.url);
    expect(a.details).toBe('Severance');
    expect(a.state).toBe('S2 · E5 · Who Is Alive?');
    expect(a.timestamps).toEqual({ start: 940_000, end: 3_940_000 });
    expect(a.buttons).toEqual([{ label: 'Watch on Netflix', url: show.url }]);
  });

  it('drops the progress and says paused', () => {
    const a = buildActivity({ ...show, playing: false }, settings);
    expect(a.timestamps).toBeUndefined();
    expect(a.state).toBe('Paused · S2 · E5 · Who Is Alive?');
  });

  it('hides the title when asked', () => {
    const s = merge({ sites: { ...DEFAULTS.sites, netflix: { on: true, hideTitle: true } } });
    const a = buildActivity(show, s);
    expect(a.details).toBe('Netflix');
    expect(JSON.stringify(a)).not.toContain('Severance');
    expect(a.buttons).toBeUndefined();
  });

  it('hides titles on the private list', () => {
    const s = merge({ ...settings, blocklist: ['severance'] });
    expect(buildActivity(show, s).details).toBe('Netflix');
  });

  it('keeps text inside Discord limits', () => {
    const a = buildActivity({ ...show, title: 'x'.repeat(300), subtitle: undefined, season: undefined, episode: undefined }, settings);
    expect(a.details.length).toBe(128);
    expect(a.state).toBeUndefined();
  });

  it('ignores non https images and links', () => {
    const a = buildActivity({ ...show, poster: 'http://x.test/a.jpg', siteIcon: undefined, url: 'javascript:alert(1)' }, settings);
    expect(a.assets?.large_image).toBe('https://raw.githubusercontent.com/t4zc4t/Xpresence/main/extension/public/sites/netflix.png');
    expect(a.details_url).toBeUndefined();
    expect(a.buttons).toBeUndefined();
  });

  it('can drop the newer fields', () => {
    const a = basicActivity(buildActivity({ ...show, poster: 'https://x.test/p.jpg' }, settings));
    expect(a.name).toBeUndefined();
    expect(a.details_url).toBeUndefined();
    expect(a.assets?.large_url).toBeUndefined();
    expect(a.assets?.large_image).toBe('https://x.test/p.jpg');
  });
});

describe('live streams', () => {
  const stream: Media = {
    site: 'twitch',
    kind: 'live',
    title: 'Caedrel',
    subtitle: 'League of Legends',
    caption: 'WORLDS 2026 SWISS STAGE',
    playing: true,
    position: 3600,
    poster: 'https://static-cdn.jtvnw.net/a-300x300.png',
    url: 'https://www.twitch.tv/caedrel',
  };
  const s = merge({ sites: { ...DEFAULTS.sites, twitch: { on: true, hideTitle: false } } });

  it('counts up from when the stream started', () => {
    const a = buildActivity(stream, s, 10_000_000);
    expect(a.name).toBe('Twitch');
    expect(a.state).toBe('Live · League of Legends');
    expect(a.timestamps).toEqual({ start: 6_400_000 });
    expect(a.assets?.large_text).toBe('WORLDS 2026 SWISS STAGE');
  });

  it('shows the sport for DAZN events', () => {
    const a = buildActivity(
      { ...stream, site: 'dazn', title: "Ballon d'Or 2026 Ceremony", subtitle: 'Football', caption: undefined },
      merge({ sites: { ...DEFAULTS.sites, dazn: { on: true, hideTitle: false } } }),
      10_000_000,
    );
    expect(a.name).toBe('DAZN');
    expect(a.details).toBe("Ballon d'Or 2026 Ceremony");
    expect(a.state).toBe('Live · Football');
    expect(a.assets?.small_image).toContain('/sites/dazn-2.png');
  });

  it('reads uptime clocks', () => {
    expect(clockToSeconds('5:14:115:14:11 since live stream started')).toBe(5 * 3600 + 14 * 60 + 11);
    expect(clockToSeconds('12:34')).toBe(754);
    expect(clockToSeconds('soon')).toBeUndefined();
  });
});

describe('sameActivity', () => {
  it('treats small timestamp drift as the same card', () => {
    const a = buildActivity(show, settings, 1_000_000);
    const b = buildActivity({ ...show, position: 62 }, settings, 1_002_500);
    expect(sameActivity(a, b)).toBe(true);
  });

  it('notices a seek', () => {
    const a = buildActivity(show, settings, 1_000_000);
    const b = buildActivity({ ...show, position: 600 }, settings, 1_000_000);
    expect(sameActivity(a, b)).toBe(false);
  });
});

describe('page helpers', () => {
  it('reads season and episode', () => {
    expect(seasonEpisode('S2:E5')).toEqual({ season: 2, episode: 5 });
    expect(seasonEpisode('Season 1, Ep. 3 Pilot')).toEqual({ season: 1, episode: 3 });
    expect(seasonEpisode('E7')).toEqual({ episode: 7 });
    expect(seasonEpisode('The Batman')).toEqual({});
  });

  it('cleans page titles', () => {
    expect(cleanTitle('Severance | Apple TV+', 'Apple TV\\+?')).toBe('Severance');
    expect(cleanTitle('Watch Panchayat - JioHotstar', 'JioHotstar')).toBe('Panchayat');
    expect(cleanTitle('\u200eF1 Weekend Warm-Up - Watch Live - Apple TV', 'Watch Live', 'Apple TV\\+?')).toBe('F1 Weekend Warm-Up');
  });
});
