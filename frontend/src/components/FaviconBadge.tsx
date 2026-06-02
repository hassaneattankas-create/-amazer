"use client";

import { useEffect, useRef } from "react";
import { useNotificationStore } from "@/store/notification-store";

function buildFaviconDataUrl(unread: number): string | null {
  if (typeof window === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Fond orange arrondi
  ctx.fillStyle = "#FF4D00";
  ctx.beginPath();
  ctx.roundRect(0, 0, 32, 32, 7);
  ctx.fill();

  // Lettre A
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", 16, 17);

  if (unread > 0) {
    // Cercle rouge
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(25, 7, 7, 0, Math.PI * 2);
    ctx.fill();
    // Chiffre
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(unread > 9 ? "9+" : String(unread), 25, 7);
  }

  return canvas.toDataURL("image/png");
}

export function FaviconBadge() {
  const unread = useNotificationStore((state) =>
    state.items.reduce((n, item) => n + (item.unread ? 1 : 0), 0)
  );
  const prevUnread = useRef<number>(-1);

  useEffect(() => {
    if (prevUnread.current === unread) return;
    prevUnread.current = unread;

    const dataUrl = buildFaviconDataUrl(unread);
    if (!dataUrl) return;

    let link = document.querySelector<HTMLLinkElement>("link[data-amazer-badge]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-amazer-badge", "1");
      document.head.appendChild(link);
    }
    link.type = "image/png";
    link.href = dataUrl;

    // Titre onglet
    const base = "AMAZER";
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread]);

  return null;
}
