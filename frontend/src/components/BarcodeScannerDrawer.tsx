"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { Drawer } from "vaul";
import type { Html5Qrcode } from "html5-qrcode";

import { Button } from "@/components/ui/button";

type BarcodeScannerDrawerProps = {
  onDetected: (barcode: string) => void;
};

export function BarcodeScannerDrawer({ onDetected }: BarcodeScannerDrawerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [status, setStatus] = useState("Pret a scanner");
  const scannerId = useMemo(() => "barcode-scanner-region", []);

  const disposeScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      isScanningRef.current = false;
      return;
    }

    try {
      await scanner.stop();
    } catch {
      // ignore scanner stop race
    }

    try {
      await scanner.clear();
    } catch {
      // ignore scanner clear race
    }

    scannerRef.current = null;
    isScanningRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!open || isScanningRef.current) {
      return undefined;
    }

    const start = async () => {
      setIsStarting(true);
      setStatus("Activation camera...");

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || isScanningRef.current) {
          return;
        }

        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;
        isScanningRef.current = true;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 140 } },
          (decodedText: string) => {
            if (navigator.vibrate) {
              navigator.vibrate(35);
            }
            onDetected(decodedText);
            setStatus(`Code detecte: ${decodedText}`);
            void disposeScanner().then(() => setOpen(false));
          },
          undefined
        );
        setStatus("Scanne un code-barres");
      } catch {
        setStatus("Camera indisponible. Verifie les permissions.");
        await disposeScanner();
      } finally {
        setIsStarting(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      void disposeScanner();
    };
  }, [disposeScanner, onDetected, open, scannerId]);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button
          type="button"
          className="primary-glow-btn shine-btn absolute right-2 top-1/2 h-10 -translate-y-1/2 px-3 text-white"
        >
          <ScanLine className="h-4 w-4" />
          Scan
        </Button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="pointer-events-none fixed inset-0 bg-black/30" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 shadow-xl">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
          <div className="mt-4 flex items-center gap-2">
            <Camera className="h-5 w-5 text-[#FF4D00]" />
            <p className="text-sm font-medium text-slate-900">Scanner code-barres</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">{status}</p>
          <div id={scannerId} className="mt-3 min-h-56 rounded-xl border border-slate-200 bg-slate-50" />
          {!isStarting ? (
            <Button
              type="button"
              className="mt-3 w-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Fermer
            </Button>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
