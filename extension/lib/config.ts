// Discord application the activity is shown under (application IDs are public)
export const DISCORD_CLIENT_ID = '1563761482485735455';

// must match HOST_NAME in the bridge
export const BRIDGE_HOST = 'com.xpresence.bridge';

export const RELEASES_URL = 'https://github.com/t4zc4t/Xpresence/releases/latest';
export const LATEST_API = 'https://api.github.com/repos/t4zc4t/Xpresence/releases/latest';

// the bridge this build expects, older ones get an update prompt
export const BRIDGE_VERSION = '0.3.0';

export function bridgeDownload(): { label: string; url: string }[] {
  const base = `${RELEASES_URL}/download`;
  const p = (navigator.userAgent || '').toLowerCase();
  if (p.includes('windows')) return [{ label: 'Download for Windows', url: `${base}/xpresence-bridge-windows-x64.exe` }];
  if (p.includes('mac')) {
    return [
      { label: 'Download for Mac (Apple chip)', url: `${base}/xpresence-bridge-macos-arm64` },
      { label: 'Intel Mac', url: `${base}/xpresence-bridge-macos-x64` },
    ];
  }
  return [{ label: 'Download for Linux', url: `${base}/xpresence-bridge-linux-x64` }];
}

export function olderThan(v: string | undefined, want: string): boolean {
  if (!v) return false;
  const a = v.split('.').map(Number);
  const b = want.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}
