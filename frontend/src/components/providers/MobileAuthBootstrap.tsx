"use client";

import { useEffect } from "react";

import { hydrateMobileAuthTokens } from "@/lib/api";

export function MobileAuthBootstrap() {
  useEffect(() => {
    void hydrateMobileAuthTokens();
  }, []);

  return null;
}

