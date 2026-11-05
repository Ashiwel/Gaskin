/**
 * Make Gaskin installable and offline-capable when it is served over http(s).
 *
 * Registration is guarded: nothing happens when the page is opened from file:// (USB stick),
 * inside an iframe (the hosted Claude demo is sandboxed), in a browser without service workers,
 * or when no manifest/service worker file was published next to the page.
 */

export interface PwaSupport {
  ok: boolean;
  reason: string;
}

export function pwaSupport(): PwaSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return { ok: false, reason: 'No browser.' };
  if (location.protocol === 'file:') return { ok: false, reason: 'Opened from a file (USB stick); works offline already.' };
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return { ok: false, reason: 'Needs https to install.' };
  let framed = false;
  try {
    framed = window.top !== window.self;
  } catch {
    framed = true;
  }
  if (framed) return { ok: false, reason: 'Inside another page; open Gaskin on its own to install it.' };
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'This browser cannot install web apps.' };
  return { ok: true, reason: 'Can install.' };
}

/**
 * Add the manifest link and register sw.js, both relative to the page so it works in any folder.
 * Resolves true when a service worker was registered. Never throws.
 */
export async function registerPWA(opts: { manifest?: string; sw?: string } = {}): Promise<boolean> {
  const s = pwaSupport();
  if (!s.ok) return false;
  const manifest = opts.manifest ?? 'manifest.webmanifest';
  const sw = opts.sw ?? 'sw.js';
  try {
    // Only proceed if the files were actually published (the single-file demo build may not ship them).
    const head = await fetch(sw, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
    if (!head || !head.ok) return false;
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = manifest;
      document.head.appendChild(link);
    }
    await navigator.serviceWorker.register(sw, { scope: './' });
    return true;
  } catch {
    return false;
  }
}
