"use client";

import { useEffect, useState } from "react";

/**
 * True only after the component has mounted in the browser.
 * Use to avoid React hydration mismatches when UI depends on localStorage,
 * random order, or other values that differ between server and first client paint.
 */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
