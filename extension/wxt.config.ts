import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'wxt';
import { BUILTIN_SITES } from './lib/builtin-sites';

// sites kept only on this machine also need their permissions in the manifest
function localMatches(): string[] {
  if (!existsSync('local')) return [];
  return readdirSync('local', { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`local/${d.name}/site.json`))
    .flatMap((d) => JSON.parse(readFileSync(`local/${d.name}/site.json`, 'utf8')).matches as string[]);
}

const ALL_MATCHES = [...BUILTIN_SITES.flatMap((s) => s.matches), ...localMatches()];

export default defineConfig({
  imports: false,
  manifest: {
    name: 'Xpresence',
    description: "Show what you're watching on Discord, with per-site control",
    // keeps the unpacked extension ID stable so the bridge can allow it
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkv6NHAgjJ+PDZ2TsoBEHDUrtjSFv2WLaFBgLalZ1i0rr68Kxp+nV9PG/piODtqlhkWVsear/MfAmFZbUOmI+HHYsjBRWVGDbBTsl36mwbhKnQE+93vlC7wDRLdROZUtien9nvNZUSKdyOi7E2K/IfaEYrQpl4qdnf+h/YIQmj6q/Bl+/kiWJ6NoKJVP1B4jAkidQnGCeJHiW4/bKU3er479hYMCcvinW08OvHuF3O8tTTn0s2+CcYB5lU9mF1WmRDtB8nGtSCA8wha4WGf+AyaFRoIWoXVOWFsb+AckFWntxRiUp/1osBPTp5B+8cwXmhcdQXGxvskSEgo5J5Jge9QIDAQAB',
    permissions: ['storage', 'nativeMessaging', 'scripting', 'alarms'],
    // asked for one site at a time, only when it's switched on
    optional_host_permissions: ALL_MATCHES,
    incognito: 'not_allowed',
    minimum_chrome_version: '120',
  },
});
