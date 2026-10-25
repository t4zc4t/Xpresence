import type { Site } from './sites';

export const BUILTIN_SITES: Site[] = [
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
