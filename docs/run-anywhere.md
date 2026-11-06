# Running Gaskin anywhere

Gaskin is one file of about 3.7 MB (`Gaskin.html` in the desktop download, `dist/index.html` in a build). It runs in any modern browser, needs no installation and works with no internet once open. This guide covers the desktop download, running from a USB stick or hard drive on each kind of device, what works on each, and the limits.

## The desktop download

`release/Gaskin-desktop.zip` (about 1.7 MB) holds one folder, `Gaskin/`:

| File | What it is |
|---|---|
| `Gaskin.html` | The whole app |
| `Open Gaskin (Windows).bat`, `Open Gaskin (Mac).command`, `Open Gaskin (Linux).sh` | Double-click launchers |
| `gaskin.mcpb` | The Claude Desktop extension (see `connect-your-assistant.md`) |
| `START-HERE.txt` | The steps below, in plain words |
| `app/` | What the launchers use: three small servers and the installable-app files |

Each launcher starts a small web server that serves this folder at `http://127.0.0.1:17654/` (or the next free port) and opens the default browser. It tries Python 3 first, then PowerShell's `HttpListener` on Windows, then Node; all three ship in the folder as plain source (`app/serve.py`, `app/serve.ps1`, `app/serve.js`) with no packages. If none is present, the launcher opens `Gaskin.html` directly from the file, which still works.

Serving from `127.0.0.1` matters because browsers treat it as a secure origin. From there Gaskin can install as an app (Chrome and Edge show an install icon), register its offline service worker, and save straight into a folder the worker picks. Opened as a file, it can do none of these, so it keeps records in the browser and downloads backup files instead.

The servers are deliberately narrow. They listen on `127.0.0.1` only, so no other device on the network can reach them. They answer GET and HEAD for a fixed list of nine paths (the app, its service worker, manifest and icons, and the extension), with no directory listing, and refuse anything else, including `../` paths. They send `nosniff`, `no-referrer` and, for the page, `X-Frame-Options: DENY`. The port is the same each time when it is free, because the browser keeps records per address: a different port would look like a different site with empty storage. Folder mode does not depend on the port, since the records live in the folder.

`npm run package:desktop` builds the zip and then runs `scripts/test-desktop.mjs`, which unzips it, starts the Linux launcher (the Python path) and the Node server, completes onboarding in headless Chrome, reloads, and checks that setup and records persisted, that the page is a secure context with the service worker ready, and that the server is bound to `127.0.0.1` and refuses paths outside its list. The PowerShell server has not been run on Windows yet.

## Where records are kept

Gaskin chooses one of three places automatically and shows a line such as "Saved to USB stick GASKIN at 14:02".

- **A folder you choose.** On Chrome, Edge or Opera on a computer, Gaskin can write straight into a folder, including one on a USB stick. It saves `gaskin-data.json` after every change and keeps the last ten copies in `backups/`, at most one an hour. The browser remembers the folder and asks again for permission on each new start; press "Reconnect".
- **This browser.** Records are kept in the browser's own storage (IndexedDB, or localStorage if that fails). They stay on that device only.
- **This browser plus backup files.** Where browser data is likely to be cleared, Gaskin also downloads a backup file every few days (every day where power is scarce).

Whatever the mode, the latest records are also kept in the browser, so pulling out the stick mid-visit loses nothing. Changes are written within half a second, and the write starts at once when the tab is hidden, closed or reloaded. A reload in the first fifth of a second after a change can still lose that change, because browsers do not wait for storage while a page unloads. "Import backup" in Settings opens any backup file.

## Putting Gaskin on a USB stick

1. Format the stick as exFAT or FAT32 so every computer can read it, and name it GASKIN.
2. Unzip `Gaskin-desktop.zip` onto it, and make an empty folder called `GASKIN-DATA` next to the `Gaskin` folder.
3. On a computer, double-click the launcher for that computer. If it will not run (a locked-down office PC, say), double-click `Gaskin.html` instead.
4. In Settings, Storage and backup, choose the `GASKIN-DATA` folder and press "Allow".

FAT32 and exFAT do not keep the executable flag, so on a Mac or Linux machine the `.command` or `.sh` file may need `chmod +x` or "Open with Terminal" the first time.

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

Opening `Gaskin.html` from a file (rather than through a launcher) means each browser treats the stick's location as its own site. If the stick appears as `E:` on one computer and `F:` on another, the browser's own copy of the records differs between them, but the folder on the stick is the same, so records follow the stick in folder mode.

## Installing as an app

When Gaskin is served over https (the hosted demo outside Claude, or a facility server) or from a desktop launcher on `127.0.0.1`, browsers offer "Install" or "Add to Home screen". It then opens like an app and works offline. The web manifest and service worker in `public/` handle this. Registration is skipped when the page is opened from a file, inside another page (such as the Claude demo), or in a browser without service workers, so it can do no harm there. The service worker caches only Gaskin's own files; patient records are never put in its cache.

## Honest limits

- Phone browsers, Android and iPhone alike, cannot write directly into files on a USB stick or SD card. On a phone, records live in the browser and travel by backup file.
- Browser storage belongs to one browser on one device. Clearing browsing data deletes it. Folder mode and backup files are the protection.
- A folder chosen on one computer must be chosen again on another, because browsers do not share folder permissions.
- Two people editing the same records on two devices at once is not supported yet. The last save wins.

## Next: a launcher with no dependencies

The desktop launchers need Python 3, PowerShell or Node, which most computers have (every Windows 10 and 11 machine has PowerShell). The next step is a single binary for each system (`Gaskin.exe`, `Gaskin.app`, `gaskin`), a few megabytes, with no administrator rights, that also reads and writes `GASKIN-DATA/` next to itself so folder mode works in every browser, and can run on a facility computer as a hub that phones on the facility Wi-Fi reach. That hub is also where the MCP connector for AI assistants would run.
