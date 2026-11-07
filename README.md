# Xpresence

Xpresence shows what you're watching in the browser on your Discord profile, staying light on system resources while giving you full control over what actually gets shared.

It works in two parts: the browser extension reads what's playing on the sites you turn on, and a tiny helper app (the bridge) passes that along to the Discord desktop app. The bridge isn't a tray app running in the background all day. The browser only starts it when something is playing and closes it when you close the browser, which also clears your status right away instead of leaving it stuck.

## Sites

Netflix, Apple TV, YouTube, Prime Video, JioHotstar, Lunar (anime), Twitch, Kick, and DAZN are supported for now. Live streams show how long the stream has been running. On Windows, it can also pick up what's playing in the native Apple TV app through an option in Settings (as long as the browser is open).

Every site is off by default until you switch it on in the popup, and the extension only asks for access to a site when you enable it.

## What you can control

Every site has its own toggle, plus a "hide title" option that just shows "Watching Netflix" without giving away the name of the show. There's also a private titles list for specific shows you never want shared by name, a snooze timer (for an hour or until midnight), and a setting for how long a paused video stays on your profile before clearing. Incognito tabs are never shared.

The popup gives you a live preview of the exact card Discord will display, along with the connection status for both the bridge and Discord, so if something isn't working you can see right away which part is holding things up.

## Install

1. Load the extension. For now, download `xpresence-extension.zip` from the [latest release](https://github.com/t4zc4t/Xpresence/releases/latest), unzip it, and click **Load unpacked** on your browser's extensions page with developer mode turned on.
2. A setup page will open with a download button for the helper app. Run the helper once. It copies itself to your app data folder, registers with Brave, Chrome, Edge, and Chromium, and ticks itself off on the setup page.
3. Switch on the sites you want right there, or anytime later from the popup.

## Updating

The popup checks GitHub once a day and shows a note when a new version is out. To update, download the new `xpresence-extension.zip`, unzip it over the old folder, and hit reload on the extensions page. Your settings will stay as they are.

## Removing it

In the popup, go to **Settings**. **Remove helper app** takes the bridge off your computer, and **Remove Xpresence** does that before removing the extension too.

If you already removed the extension, you can run the helper from your app data folder (`%LOCALAPPDATA%\Xpresence` on Windows) with `xpresence-bridge uninstall`, or just download the helper again and run `xpresence-bridge uninstall`.

## Building it yourself

The extension uses WXT and TypeScript:

```bash
cd extension
npm install
npm run build
```

The bridge is written in Rust with no dependencies apart from `serde_json`:

```bash
cd bridge
cargo build --release
```

## License

MIT
