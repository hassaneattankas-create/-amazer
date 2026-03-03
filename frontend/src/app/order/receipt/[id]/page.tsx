"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import { getSecureReceipt } from "@/services/order-service";

export default function OrderReceiptPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? undefined;
  const orderId = params.id;
  const receiptRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("");

  const { data, isPending, isError } = useQuery({
    queryKey: ["secure-receipt", orderId, token],
    queryFn: () => getSecureReceipt(orderId, token),
  });

  const qrPayload = useMemo(() => {
    if (!data) {
      return "";
    }
    return data.verify_url;
  }, [data]);

  const absoluteReceiptUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.location.href;
  }, []);

  async function downloadPdf() {
    if (!receiptRef.current) {
      return;
    }
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const popup = window.open("", "_blank");
      if (!popup) {
        setStatus("Autorisez les popups pour exporter le PDF.");
        return;
      }
      popup.document.write(`
        <html>
          <head><title>Recu AMAZER ${orderId}</title></head>
          <body style="margin:0;padding:12px;background:#fff;">
            <img src="${imgData}" style="width:100%;height:auto;" />
            <script>
              window.onload = function() { window.print(); };
            </script>
          </body>
        </html>
      `);
      popup.document.close();
      setStatus("Fenetre PDF ouverte (Imprimer > Enregistrer en PDF).");
    } catch {
      setStatus("Erreur lors du telechargement PDF.");
    }
  }

  function saveQrImage() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) {
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `amazer-qr-${orderId}.png`;
    anchor.click();
    setStatus("Image QR enregistree.");
  }

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
        <article className="premium-card border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-xl font-semibold text-rose-700">Acces refuse ou recu invalide</h1>
          <p className="mt-2 text-sm text-rose-700">
            Le lien est peut-etre expire, modifie ou non autorise.
          </p>
          <Button asChild className="mt-4 border border-slate-200 bg-white text-slate-800 hover:bg-slate-50">
            <Link href="/dashboard">Retour</Link>
          </Button>
        </article>
      </section>
    );
  }

  const whatsappText = encodeURIComponent(
    `Mon recu securise AMAZER (${data.order_id}) : ${absoluteReceiptUrl}\nVerification QR: ${data.verify_url}`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
      <article ref={receiptRef} className="premium-card border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="luxury-title text-2xl font-semibold">Recu securise AMAZER</h1>
            <p className="mt-1 text-sm text-slate-600">Commande #{data.order_id}</p>
          </div>
          <Image src="/logo-amazer.svg" alt="Logo AMAZER" width={96} height={96} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-900">Client:</span> {data.customer_name}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Paiement:</span> {data.payment_mode.toUpperCase()}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Date:</span>{" "}
            {new Date(data.created_at).toLocaleDateString("fr-FR")}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Heure:</span>{" "}
            {new Date(data.created_at).toLocaleTimeString("fr-FR", { hour12: false })}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Code transaction:</span>{" "}
            {data.transaction_code_masked ?? "-"}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Integrite:</span> {data.integrity_hash.slice(0, 16)}...
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="pb-2">Article</th>
                <th className="pb-2">Qt</th>
                <th className="pb-2">Prix</th>
                <th className="pb-2">Sous-total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={`${item.product_id}-${item.product_name}`} className="border-t border-slate-100">
                  <td className="py-2 text-slate-800">{item.product_name}</td>
                  <td className="py-2 text-slate-700">{item.quantity}</td>
                  <td className="py-2 text-slate-700">{formatXOF(item.unit_price)}</td>
                  <td className="py-2 font-semibold text-slate-900">{formatXOF(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">Total</p>
          <p className="text-xl font-semibold text-[#FF4D00]">{formatXOF(data.total_amount)}</p>
        </div>

        <div ref={qrRef} className="mt-5 flex flex-col items-center gap-2">
          <QRCodeCanvas value={qrPayload} size={180} includeMargin />
          <p className="text-xs text-slate-500">QR de verification securisee (admin uniquement).</p>
        </div>
      </article>

      <article className="premium-card border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-base font-semibold text-emerald-800">🛡️ Conseils de Securite AMAZER</h2>
        <ul className="mt-3 space-y-2 text-sm text-emerald-900">
          <li>Ne partagez jamais la capture d ecran de ce QR Code sur les reseaux sociaux.</li>
          <li>Le vendeur doit scanner ce code uniquement via l application officielle AMAZER.</li>
          <li>Ce recu est valable pour un seul retrait. Une fois scanne, il devient invalide.</li>
          <li>AMAZER ne vous demandera jamais votre code secret Nita/Amana par SMS ou appel.</li>
        </ul>
      </article>

      <div className="flex flex-wrap gap-2">
        <Button onClick={downloadPdf} className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]">
          Telecharger le recu (PDF)
        </Button>
        <Button onClick={saveQrImage} className="border border-slate-200 bg-white text-slate-800 hover:bg-slate-50">
          Enregistrer l image
        </Button>
        <Button asChild className="border border-slate-200 bg-white text-slate-800 hover:bg-slate-50">
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            Envoyer mon recu sur WhatsApp
          </a>
        </Button>
      </div>
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
