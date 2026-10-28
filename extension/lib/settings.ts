import { browser } from 'wxt/browser';
import { SITES, type SiteId } from './sites';

export interface SiteSettings {
  on: boolean;
  // share "Watching Netflix" without the show name
  hideTitle: boolean;
}

export interface Settings {
  enabled: boolean;
  sites: Record<SiteId, SiteSettings>;
  buttons: boolean;
  // keep showing a paused title for this many minutes, 0 clears right away
  pausedMinutes: number;
  snoozeUntil: number;
  // titles that are never shared by name
  blocklist: string[];
  // desktop apps read by the helper (Windows only)
  apps: { appletv: boolean };
}

export const DEFAULTS: Settings = {
  enabled: true,
  sites: Object.fromEntries(SITES.map((s) => [s.id, { on: false, hideTitle: false }])) as Record<
    SiteId,
    SiteSettings
  >,
  buttons: true,
  pausedMinutes: 5,
  snoozeUntil: 0,
  blocklist: [],
  apps: { appletv: false },
};

export function merge(saved: Partial<Settings> | undefined): Settings {
  const s = saved ?? {};
  const sites = { ...DEFAULTS.sites };
  for (const site of SITES) {
    sites[site.id] = { on: false, hideTitle: false, ...s.sites?.[site.id] };
  }
  return { ...DEFAULTS, ...s, sites };
}

export function siteConf(s: Settings, id: SiteId): SiteSettings {
  return (s.sites[id] ??= { on: false, hideTitle: false });
}

export async function getSettings(): Promise<Settings> {
  const { settings } = await browser.storage.sync.get('settings');
  return merge(settings as Partial<Settings> | undefined);
}

export async function saveSettings(change: (s: Settings) => void): Promise<Settings> {
  const s = await getSettings();
  change(s);
  await browser.storage.sync.set({ settings: s });
  return s;
}

export function isBlocked(title: string, blocklist: string[]): boolean {
  const t = title.toLowerCase();
  return blocklist.some((b) => b.trim() && t.includes(b.trim().toLowerCase()));
}
