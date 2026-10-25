export type SiteId = 'netflix' | 'appletv' | 'youtube' | 'primevideo' | 'hotstar';

export interface Site {
  id: SiteId;
  name: string;
  // used for the permission request and script registration
  matches: string[];
  host: RegExp;
  domain: string;
}

export const SITES: Site[] = [
  {
    id: 'netflix',
    domain: 'netflix.com',
    name: 'Netflix',
    matches: ['https://www.netflix.com/*'],
    host: /(^|\.)netflix\.com$/,
  },
  {
    id: 'appletv',
    domain: 'tv.apple.com',
    name: 'Apple TV',
    matches: ['https://tv.apple.com/*'],
    host: /^tv\.apple\.com$/,
  },
  {
    id: 'youtube',
    domain: 'youtube.com',
    name: 'YouTube',
    matches: ['https://www.youtube.com/*', 'https://m.youtube.com/*'],
    host: /^(www|m)\.youtube\.com$/,
  },
  {
    id: 'primevideo',
    domain: 'primevideo.com',
    name: 'Prime Video',
    matches: ['https://www.primevideo.com/*'],
    host: /(^|\.)primevideo\.com$/,
  },
  {
    id: 'hotstar',
    domain: 'hotstar.com',
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

// fallback image when the page has no usable icon, Discord fetches it through its own proxy
export function siteLogo(site: Site): string {
  return `https://www.google.com/s2/favicons?domain=${site.domain}&sz=256`;
}
