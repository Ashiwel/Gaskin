# Running Gaskin anywhere

Gaskin is one file, `index.html`, of a few megabytes. It runs in any modern browser, needs no installation and works with no internet once open. This guide covers running it from a USB stick or hard drive on each kind of device, what works on each, and the limits.

## Where records are kept

Gaskin chooses one of three places automatically and shows a line such as "Saved to USB stick GASKIN at 14:02".

- **A folder you choose.** On Chrome, Edge or Opera on a computer, Gaskin can write straight into a folder, including one on a USB stick. It saves `gaskin-data.json` after every change and keeps the last ten copies in `backups/`, at most one an hour. The browser remembers the folder and asks again for permission on each new start; press "Reconnect".
- **This browser.** Records are kept in the browser's own storage (IndexedDB, or localStorage if that fails). They stay on that device only.
- **This browser plus backup files.** Where browser data is likely to be cleared, Gaskin also downloads a backup file every few days (every day where power is scarce).

Whatever the mode, the latest records are also kept in the browser, so pulling out the stick mid-visit loses nothing. "Import backup" in Settings opens any backup file.

## Putting Gaskin on a USB stick

1. Format the stick as exFAT or FAT32 so every computer can read it, and name it GASKIN.
2. Copy `index.html` onto it, and make an empty folder called `GASKIN-DATA`.
3. On a computer, double-click `index.html`. It opens in the default browser.
4. During setup, when asked, choose the `GASKIN-DATA` folder and press "Allow".

## What works on each system

| System | Open from the stick | Write records to the stick | Notes |
|---|---|---|---|
| **Windows 10 or 11** | Yes, double-click | Yes, in Chrome or Edge | The best laptop setup. Firefox keeps records in the browser and downloads backups. |
| **Windows 7 or 8** | Yes | Only with Chrome 109 or Edge 109, the last versions for these systems | Old browsers miss security updates. Keep the laptop offline or move to Windows 10 if possible. |
| **macOS** | Yes, double-click or drag onto Chrome | Yes, in Chrome or Edge | Safari keeps records in the browser and downloads backups. |
| **Linux** | Yes | Yes, in Chrome or Chromium | Firefox keeps records in the browser and downloads backups. |
| **ChromeOS** | Yes, from the Files app | Yes | Works well on cheap Chromebooks. |
| **Android with a USB-OTG stick** | Partly: open the file from the Files app in Chrome | No | Phone browsers cannot write into a stick's files. Records stay in Chrome; use "Export backup" to save a file, then copy it to the stick with the Files app. |
| **iPhone and iPad** | Only after copying the file into the Files app | No | The most restricted. Safari can clear site data that is not used for a few weeks, so add Gaskin to the home screen and save a backup often. |

Opening `index.html` from a file means each browser treats the stick's location as its own site. If the stick appears as `E:` on one computer and `F:` on another, the browser's own copy of the records differs between them, but the folder on the stick is the same, so records follow the stick in folder mode.

## Installing as an app

When Gaskin is served over https (the hosted demo outside Claude, or a facility server), browsers offer "Install" or "Add to Home screen". It then opens like an app and works offline. The web manifest and service worker in `public/` handle this. Registration is skipped when the page is opened from a file, inside another page (such as the Claude demo), or in a browser without service workers, so it can do no harm there. The service worker caches only Gaskin's own files; patient records are never put in its cache.

## Honest limits

- Phone browsers, Android and iPhone alike, cannot write directly into files on a USB stick or SD card. On a phone, records live in the browser and travel by backup file.
- Browser storage belongs to one browser on one device. Clearing browsing data deletes it. Folder mode and backup files are the protection.
- A folder chosen on one computer must be chosen again on another, because browsers do not share folder permissions.
- Two people editing the same records on two devices at once is not supported yet. The last save wins.

## Planned: the portable launcher

For full read and write from a stick on any computer, including old Windows machines and browsers without folder access, the next step is a small launcher on the stick: `Gaskin.exe` for Windows, `Gaskin.app` for macOS and `gaskin` for Linux. Each is a few megabytes, needs no installation and no administrator rights, starts a local web server bound to `127.0.0.1` that serves `index.html` and reads and writes `GASKIN-DATA/` next to itself, then opens the default browser. Because the page is then served from `http://127.0.0.1`, it can also install as an app and use the service worker. The same launcher can run on a facility computer as a hub that phones on the facility Wi-Fi reach, and is where the MCP connector for AI assistants will run.
