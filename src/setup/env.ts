/** Read the facts about this device that recommendSetup() needs. Never throws. */
import type { SetupEnvironment } from './types';

export function detectSetupEnvironment(): SetupEnvironment {
  const g = globalThis as unknown as { claude?: unknown; showDirectoryPicker?: unknown; navigator?: Navigator & { gpu?: unknown }; location?: Location; window?: Window };
  let framed = false;
  try {
    framed = typeof window !== 'undefined' && window.top !== window.self;
  } catch {
    framed = true;
  }
  return {
    inClaude: Boolean(g.claude),
    webgpu: Boolean(g.navigator?.gpu),
    folderAccess: typeof g.showDirectoryPicker === 'function' && !framed,
    fromFile: g.location?.protocol === 'file:',
  };
}

/** Ask the browser for her position, with a timeout. Resolves null if refused or unavailable. */
export function requestPosition(timeoutMs = 15000): Promise<{ lat: number; lon: number; accuracyM?: number } | null> {
  return new Promise((resolve) => {
    try {
      const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
      if (!geo) return resolve(null);
      geo.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60_000 },
      );
    } catch {
      resolve(null);
    }
  });
}
