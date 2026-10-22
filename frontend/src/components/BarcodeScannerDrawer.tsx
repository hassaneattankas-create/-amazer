"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { Drawer } from "vaul";
import type { Html5Qrcode } from "html5-qrcode";

import { Button } from "@/components/ui/button";

type BarcodeScannerDrawerProps = {
  onDetected: (value: string) => void;
  /** "barcode" : code-barres produit (zone large) · "qr" : QR code d'un reçu (zone carrée). */
  mode?: "barcode" | "qr";
  triggerLabel?: string;
  triggerClassName?: string;
};

const DEFAULT_TRIGGER =
  "absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-pill bg-ink-900 px-4 text-white hover:bg-ink-800";

// Le contenu du tiroir est monte par un portail : on attend que la zone video existe avant de demarrer
// la camera (sinon html5-qrcode echoue avec « element introuvable » et le scan ne marche jamais).
async function waitForElement(id: string, frames = 60): Promise<boolean> {
  for (let i = 0; i < frames; i += 1) {
    if (document.getElementById(id)) return true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return Boolean(document.getElementById(id));
}

export function BarcodeScannerDrawer({
  onDetected,
  mode = "barcode",
  triggerLabel = "Scan",
  triggerClassName = DEFAULT_TRIGGER,
}: BarcodeScannerDrawerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Ref : un nouveau callback du parent ne doit pas redemarrer la camera pendant le scan.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);
  const isScanningRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [status, setStatus] = useState("Prêt à scanner");
  const scannerId = `scanner-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // Titre du scanner : celui du bouton (« Scanner un billet », « Scanner le reçu du client »…).
  const title = mode === "qr" ? (triggerLabel !== "Scan" ? triggerLabel : "Scanner le QR code") : "Scanner un code-barres";

  const disposeScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // deja arrete
      }
      try {
        scanner.clear();
      } catch {
        // deja nettoye
      }
    }
    isScanningRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!open || isScanningRef.current) {
      return undefined;
    }

    const start = async () => {
      setIsStarting(true);
      setStatus("Activation de la caméra…");
      try {
        const [{ Html5Qrcode }, ready] = await Promise.all([import("html5-qrcode"), waitForElement(scannerId)]);
        if (cancelled || isScanningRef.current) return;
        if (!ready) throw new Error("zone de scan absente");

        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;
        isScanningRef.current = true;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width: number, height: number) =>
              mode === "qr"
                ? { width: Math.floor(Math.min(width, height) * 0.7), height: Math.floor(Math.min(width, height) * 0.7) }
                : { width: Math.floor(width * 0.85), height: Math.floor(Math.min(height * 0.5, 160)) },
          },
          (decodedText: string) => {
            if (navigator.vibrate) navigator.vibrate(35);
            onDetectedRef.current(decodedText);
            setStatus("Code détecté.");
            void disposeScanner().then(() => setOpen(false));
          },
          undefined
        );
        setStatus(mode === "qr" ? "Placez le QR code dans le cadre." : "Placez le code-barres dans le cadre.");
      } catch {
        setStatus("Caméra indisponible. Autorisez l'accès à la caméra puis réessayez.");
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
  }, [disposeScanner, mode, open, scannerId]);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button type="button" className={triggerClassName}>
          <ScanLine className="h-4 w-4" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-overlay bg-black/30" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-modal rounded-t-sheet bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-overlay">
          <div className="mx-auto h-1.5 w-12 rounded-pill bg-surface-3" aria-hidden="true" />
          <div className="mx-auto max-w-md">
            <div className="mt-4 flex items-center gap-2">
              <Camera className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <Drawer.Title className="text-sm font-semibold text-ink-900">{title}</Drawer.Title>
            </div>
            <Drawer.Description className="mt-1 text-xs text-ink-600" role="status">
              {status}
            </Drawer.Description>
            <div id={scannerId} className="mt-3 min-h-56 overflow-hidden rounded-card border border-border bg-surface-1" />
            {!isStarting ? (
              <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setOpen(false)}>
                Fermer
              </Button>
            ) : null}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
