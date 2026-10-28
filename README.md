# Xpresence

Xpresence shows what I'm watching in the browser on my Discord profile, like PreMiD does, but lighter and with more control over what gets shared.

It has two parts. The extension reads what's playing on the sites I switch on, and a tiny helper app (the bridge) passes that to the Discord desktop app. The bridge isn't a tray app that runs all the time, the browser starts it only when something is playing and it closes when the browser closes, which also clears the status right away instead of leaving it stuck.

## Sites

Netflix, Apple TV, YouTube, Prime Video, JioHotstar, Lunar (anime), Twitch, Kick and DAZN for now. Live streams show how long the stream has been running. On Windows it can also show what plays in the Apple TV app, an option in Settings that only works while the browser is open. Each one is off until I switch it on in the popup, and the extension only asks for access to a site at that point.

## What I can control

Every site has its own switch, and a "hide title" option that shows "Watching Netflix" without the name of the show. There's also a private titles list for specific shows I never want shared by name, a snooze for an hour or until midnight, and a setting for how long a paused title stays on my profile. Incognito tabs are never shared.

The popup shows a live preview of the card Discord will show, plus whether the bridge and Discord are connected, so if something isn't working it says which part.

## Install

1. Load the extension. For now that means downloading `xpresence-extension.zip` from the [latest release](https://github.com/t4zc4t/Xpresence/releases/latest), unzipping it, and using "Load unpacked" on the extensions page with developer mode on.
2. A setup page opens with a download button for the helper app. Open the helper once, it copies itself to your app data folder and registers with Brave, Chrome, Edge and Chromium, and the setup page ticks itself off.
3. Switch on the sites you want, right there or later from the popup.

## Updating

The popup checks GitHub once a day and shows a note when a new version is out. To update, download the new `xpresence-extension.zip`, unzip it over the old folder, and click reload on the extensions page. Your settings stay as they are.

## Removing it

In the popup, go to Settings. "Remove helper app" takes the bridge off your computer, and "Remove Xpresence" does that and then removes the extension too.

If the extension is already gone, run the helper from your app data folder (`%LOCALAPPDATA%\Xpresence` on Windows) with `xpresence-bridge uninstall`, or just download it again and run `xpresence-bridge uninstall`.

## Building it yourself

The extension uses WXT and TypeScript:

```
cd extension
npm install
npm run build
```

The bridge is Rust with no dependencies apart from serde_json:

```
cd bridge
cargo build --release
```

## License

MIT
