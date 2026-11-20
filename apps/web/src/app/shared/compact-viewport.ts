import { DestroyRef, inject, Signal, signal } from '@angular/core';

export const COMPACT_MAX_WIDTH_PX = 720;

export function createCompactViewportSignal(): Signal<boolean> {
  const destroyRef = inject(DestroyRef);
  const compact = signal(false);

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return compact.asReadonly();
  }

  const query = window.matchMedia(`(max-width: ${COMPACT_MAX_WIDTH_PX}px)`);
  const sync = (): void => {
    compact.set(query.matches);
  };

  sync();
  query.addEventListener('change', sync);
  destroyRef.onDestroy(() => {
    query.removeEventListener('change', sync);
  });

  return compact.asReadonly();
}
