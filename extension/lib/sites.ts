import { BUILTIN_SITES } from './builtin-sites';

export type SiteId = string;

export interface Site {
  id: SiteId;
  name: string;
  // used for the permission request and script registration
  matches: string[];
  host: RegExp;
  domain: string;
  // tile colour in the popup
  color?: string;
  // our own copy of the logo, only for sites that block Discord from loading theirs
  // give it a new name when the image changes, Discord caches by link
  logo?: string;
}

// sites kept only on this machine, in extension/local (never committed)
interface LocalSite {
  id: string;
  name: string;
  domain: string;
  matches: string[];
  color?: string;
}

const local = import.meta.glob<LocalSite>('../local/*/site.json', { eager: true, import: 'default' });

export const SITES: Site[] = [
  ...BUILTIN_SITES,
  ...Object.values(local).map((s) => ({
    ...s,
    host: new RegExp(`(^|\\.)${s.domain.replace(/\./g, '\\.')}$`),
  })),
];

export function siteById(id: string): Site | undefined {
  return SITES.find((s) => s.id === id);
}

export function siteForHost(host: string): Site | undefined {
  return SITES.find((s) => s.host.test(host));
}

// Discord loads images itself and a few sites block it, those use a logo copy from this repo
const TILES = 'https://raw.githubusercontent.com/t4zc4t/Xpresence/main/extension/public/sites';

export function hostedLogo(site: Site | undefined): string | undefined {
  const builtin = BUILTIN_SITES.find((s) => s.id === site?.id);
  return builtin?.logo ? `${TILES}/${builtin.logo}` : undefined;
}

// for sites whose page only has an .ico, which Discord can't show
export function siteLogo(site: Site): string {
  return `https://www.google.com/s2/favicons?domain=${site.domain}&sz=256`;
}
