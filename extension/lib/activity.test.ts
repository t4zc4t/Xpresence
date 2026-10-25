import { describe, expect, it } from 'vitest';
import { buildActivity, sameActivity } from './activity';
import { cleanTitle, seasonEpisode } from './page';
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
    expect(a.assets).toBeUndefined();
    expect(a.buttons).toBeUndefined();
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
  });
});
