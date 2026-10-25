export type SiteId = 'netflix' | 'appletv' | 'youtube' | 'primevideo' | 'hotstar';

export interface Site {
  id: SiteId;
  name: string;
  // used for the permission request and script registration
  matches: string[];
  host: RegExp;
}

export const SITES: Site[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    matches: ['https://www.netflix.com/*'],
    host: /(^|\.)netflix\.com$/,
  },
  {
    id: 'appletv',
    name: 'Apple TV',
    matches: ['https://tv.apple.com/*'],
    host: /^tv\.apple\.com$/,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    matches: ['https://www.youtube.com/*', 'https://m.youtube.com/*'],
    host: /^(www|m)\.youtube\.com$/,
  },
  {
    id: 'primevideo',
    name: 'Prime Video',
    matches: ['https://www.primevideo.com/*'],
    host: /(^|\.)primevideo\.com$/,
  },
  {
    id: 'hotstar',
    name: 'JioHotstar',
    matches: ['https://www.hotstar.com/*', 'https://www.jiohotstar.com/*'],
    host: /(^|\.)(jio)?hotstar\.com$/,
  },
];

export const ALL_MATCHES = SITES.flatMap((s) => s.matches);

export function siteById(id: string): Site | undefined {
  return SITES.find((s) => s.id === id);
}

export function siteForHost(host: string): Site | undefined {
  return SITES.find((s) => s.host.test(host));
}
