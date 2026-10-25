# Xpresence

Xpresence shows what I'm watching in the browser on my Discord profile, like PreMiD does, but lighter and with more control over what gets shared.

It has two parts. The extension reads what's playing on the sites I switch on, and a tiny bridge app passes that to the Discord desktop app. The bridge isn't a tray app that runs all the time, the browser starts it only when something is playing and it closes when the browser closes, which also clears the status right away instead of leaving it stuck.

## Sites

Netflix, Apple TV, YouTube, Prime Video and JioHotstar for now. Each one is off until I switch it on in the popup, and the extension only asks for access to a site at that point.

## What I can control

Every site has its own switch, and a "hide title" option that shows "Watching Netflix" without the name of the show. There's also a private titles list for specific shows I never want shared by name, a snooze for an hour or until midnight, and a setting for how long a paused title stays on my profile. Incognito tabs are never shared.

The popup shows a live preview of the card Discord will show, plus whether the bridge and Discord are connected, so if something isn't working it says which part.

## Install

1. Download the bridge for your system from the [latest release](https://github.com/t4zc4t/Xpresence/releases/latest) and run it once. It copies itself to your app data folder and registers with Brave, Chrome, Edge and Chromium.
2. Load the extension. For now that means downloading `xpresence-extension.zip` from the same release, unzipping it, and using "Load unpacked" on the extensions page with developer mode on.
3. Open the popup and switch on the sites you want.

To remove the bridge later, run `xpresence-bridge uninstall`.

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
