import { useSyncExternalStore } from 'react';
import { packStore } from '../registry';
import { reviewStore } from '../reviews';

/** Re-render when packs are installed or removed */
export function usePackVersion(): number {
  return useSyncExternalStore(packStore.subscribe, packStore.getVersion, packStore.getVersion);
}

/** Re-render when a worker checks or unchecks a line */
export function useReviewVersion(): number {
  return useSyncExternalStore(reviewStore.subscribe, reviewStore.getVersion, reviewStore.getVersion);
}
