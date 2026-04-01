"use client";

import { useSyncExternalStore } from "react";

/**
 * True only after the component has mounted in the browser.
 * Use to avoid React hydration mismatches when UI depends on localStorage,
 * random order, or other values that differ between server and first client paint.
 */
export function useClientMounted(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}
