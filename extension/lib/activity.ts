// Turns what a tab is playing into a Discord activity payload.

import { siteById } from './sites';
import { isBlocked, type Settings } from './settings';
import type { Media } from './types';

const WATCHING = 3;
// member list shows the details line instead of the app name
const SHOW_DETAILS = 2;

export interface Activity {
  type: number;
  status_display_type: number;
  details: string;
  state?: string;
  timestamps?: { start?: number; end?: number };
  assets?: { large_image?: string; large_text?: string; small_image?: string; small_text?: string };
  buttons?: { label: string; url: string }[];
}

// Discord wants 2 to 128 characters for text fields
function fit(text: string | undefined, max = 128): string | undefined {
  if (!text) return undefined;
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 2) return t.length ? `${t} ` : undefined;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function https(url: string | undefined): string | undefined {
  return url && /^https:\/\//.test(url) && url.length <= 300 ? url : undefined;
}

export function episodeLine(m: Media): string | undefined {
  const parts: string[] = [];
  if (m.season && m.episode) parts.push(`S${m.season} · E${m.episode}`);
  else if (m.episode) parts.push(`E${m.episode}`);
  if (m.subtitle) parts.push(m.subtitle);
  return parts.length ? parts.join(' · ') : undefined;
}

export function shouldHide(m: Media, settings: Settings): boolean {
  return settings.sites[m.site]?.hideTitle || isBlocked(m.title, settings.blocklist);
}

export function buildActivity(m: Media, settings: Settings, now = Date.now()): Activity {
  const site = siteById(m.site);
  const siteName = site?.name ?? 'the web';
  const icon = https(m.siteIcon);

  if (shouldHide(m, settings)) {
    return {
      type: WATCHING,
      status_display_type: SHOW_DETAILS,
      details: siteName,
      state: m.playing ? 'Watching something' : 'Paused',
      assets: icon ? { large_image: icon, large_text: siteName } : undefined,
    };
  }

  let state: string | undefined;
  if (m.kind === 'live') state = m.subtitle ? `Live · ${m.subtitle}` : 'Live';
  else state = episodeLine(m);
  if (!m.playing) state = state ? `Paused · ${state}` : 'Paused';

  const a: Activity = {
    type: WATCHING,
    status_display_type: SHOW_DETAILS,
    details: fit(m.title) ?? siteName,
    state: fit(state),
  };

  if (m.playing && m.kind !== 'live' && m.duration && Number.isFinite(m.duration) && m.position != null) {
    const start = Math.round(now - m.position * 1000);
    a.timestamps = { start, end: Math.round(start + m.duration * 1000) };
  } else if (m.playing && m.kind === 'live') {
    a.timestamps = { start: Math.round(now - (m.position ?? 0) * 1000) };
  }

  const poster = https(m.poster);
  const large = poster ?? icon;
  if (large) {
    a.assets = {
      large_image: large,
      large_text: fit(poster ? m.title : siteName),
      small_image: poster && icon ? icon : undefined,
      small_text: poster && icon ? siteName : undefined,
    };
  }

  const url = https(m.url);
  if (settings.buttons && url && url.length <= 512) {
    a.buttons = [{ label: fit(`Watch on ${siteName}`, 32)!, url }];
  }

  return a;
}

// same card apart from timestamps that moved less than a few seconds
export function sameActivity(a: Activity | null, b: Activity | null, slackMs = 4000): boolean {
  if (!a || !b) return a === b;
  const { timestamps: ta, ...ra } = a;
  const { timestamps: tb, ...rb } = b;
  if (JSON.stringify(ra) !== JSON.stringify(rb)) return false;
  if (!ta || !tb) return !ta && !tb;
  return Math.abs((ta.start ?? 0) - (tb.start ?? 0)) < slackMs && Math.abs((ta.end ?? 0) - (tb.end ?? 0)) < slackMs;
}
