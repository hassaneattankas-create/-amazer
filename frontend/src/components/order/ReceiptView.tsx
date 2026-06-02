"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { formatXOF } from "@/lib/currency";
import type { Receipt } from "@/types/order";

type ReceiptViewProps = {
  receipt?: Receipt;
  isPending: boolean;
  isError: boolean;
  backHref?: string;
};

const FALLBACK_PAYMENT_PHONE = "+227 96953163";

export function ReceiptView({
  receipt,
  isPending,
  isError,
  backHref = "/dashboard",
}: ReceiptViewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("");

  async function buildCanvas() {
    if (!receiptRef.current) {
      throw new Error("Receipt container unavailable");
    }

    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(receiptRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
  }

  async function buildPdfBlob(): Promise<Blob> {
    const canvas = await buildCanvas();
    const { jsPDF } = await import("jspdf");
    const imgData = canvas.toDataURL("image/png", 1.0);
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    return pdf.output("blob");
  }

  async function buildPngBlob(): Promise<Blob> {
    const canvas = await buildCanvas();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) {
      throw new Error("PNG generation failed");
    }
    return blob;
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function downloadPdf() {
    if (!receipt) return;
    try {
      downloadBlob(await buildPdfBlob(), `recu-amazer-${receipt.order_id}.pdf`);
      setStatus("PDF telecharge.");
    } catch {
      setStatus("Erreur lors du telechargement PDF.");
    }
  }

  async function sharePdf() {
    if (!receipt) return;
    try {
      const blob = await buildPdfBlob();
      const file = new File([blob], `recu-amazer-${receipt.order_id}.pdf`, { type: "application/pdf" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Recu AMAZER ${receipt.order_id}`,
          text: `Recu AMAZER pour la commande ${receipt.order_id}`,
          files: [file],
        });
        setStatus("PDF partage.");
        return;
      }

      downloadBlob(blob, file.name);
      setStatus("Partage direct non disponible. Le PDF a ete telecharge.");
    } catch {
      setStatus("Erreur lors du partage PDF.");
    }
  }

  async function saveAsImage() {
    if (!receipt) return;
    try {
      const blob = await buildPngBlob();
      const file = new File([blob], `recu-amazer-${receipt.order_id}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Recu AMAZER ${receipt.order_id}`,
          text: "Enregistrer le recu comme image.",
          files: [file],
        });
        setStatus("Image ouverte pour partage ou enregistrement.");
        return;
      }

      downloadBlob(blob, file.name);
      setStatus("Image telechargee.");
    } catch {
      setStatus("Erreur lors de l'enregistrement de l'image.");
    }
  }

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </section>
    );
  }

  if (isError || !receipt) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
        <article className="premium-card border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-xl font-semibold text-rose-700">Acces refuse ou recu invalide</h1>
          <p className="mt-2 text-sm text-rose-700">
            Le lien est peut-etre expire, modifie ou non autorise.
          </p>
          <Button asChild className="mt-4 border border-slate-200 bg-white text-slate-800 hover:bg-slate-50">
            <Link href={backHref}>Retour</Link>
          </Button>
        </article>
      </section>
    );
  }

  const paymentPhone = receipt.platform_wallet_phone || FALLBACK_PAYMENT_PHONE;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-14 sm:px-6">
      <article
        ref={receiptRef}
        className="premium-card overflow-hidden border border-orange-200 bg-gradient-to-br from-white via-orange-50/40 to-amber-50/60 p-6 shadow-[0_20px_60px_rgba(255,77,0,0.16)]"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="luxury-title bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 bg-clip-text text-2xl font-semibold text-transparent">
              Recu securise AMAZER
            </h1>
            <p className="mt-1 text-sm text-slate-600">Commande #{receipt.order_id}</p>
          </div>
          <div className="text-right">
            <p className="luxury-title text-xl font-semibold text-[#FF4D00]">AMAZER</p>
            <p
              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                receipt.payment_status === "paid"
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border border-amber-300 bg-amber-50 text-amber-700"
              }`}
            >
              {receipt.payment_status === "paid" ? "Paiement confirme" : "Paiement en attente"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-orange-100 bg-white/80 p-3 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-900">Client:</span> {receipt.customer_name}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Paiement:</span> {receipt.payment_mode.toUpperCase()}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Date:</span>{" "}
            {new Date(receipt.created_at).toLocaleDateString("fr-FR")}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Heure:</span>{" "}
            {new Date(receipt.created_at).toLocaleTimeString("fr-FR", { hour12: false })}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Reference:</span> {receipt.payment_reference ?? "-"}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Code transaction:</span>{" "}
            {receipt.transaction_code_masked ?? "-"}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Integrite:</span> {receipt.integrity_hash.slice(0, 16)}...
          </p>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-3">
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
              {receipt.items.map((item) => (
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

        <div className="mt-4 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
          <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
            <p>Sous-total articles</p>
            <p className="font-medium text-slate-900">{formatXOF(receipt.items_subtotal)}</p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-700">
            <p>Frais de livraison</p>
            <p className="font-medium text-slate-900">{formatXOF(receipt.delivery_fee)}</p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-700">
            <p>Commission plateforme</p>
            <p className="font-medium text-slate-900">{formatXOF(receipt.platform_commission)}</p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-700">
            <p>Frais de service</p>
            <p className="font-medium text-slate-900">{formatXOF(receipt.platform_service_fee)}</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-orange-200 pt-3">
            <p className="text-sm font-semibold text-slate-900">Total</p>
            <p className="text-xl font-semibold text-[#FF4D00]">{formatXOF(receipt.total_amount)}</p>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Paiement mobile ({receipt.payment_mode.toUpperCase()})</p>
          <p className="text-xs text-slate-600">
            Faites le versement manuellement au numero AMAZER ci-dessous, puis revenez confirmer que le paiement est bien
            effectue.
          </p>
          <p className="text-sm text-slate-800">
            <span className="font-semibold">Numero AMAZER:</span> {paymentPhone}
          </p>
          <p className="text-sm text-slate-800">
            <span className="font-semibold">Montant a verser:</span> {formatXOF(receipt.total_amount)}
          </p>
          <p className="text-sm text-slate-800">
            <span className="font-semibold">Reference a garder:</span> {receipt.payment_reference ?? "-"}
          </p>
        </div>
      </article>

      <article className="premium-card border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-base font-semibold text-emerald-800">Conseils de Securite AMAZER</h2>
        <ul className="mt-3 space-y-2 text-sm text-emerald-900">
          <li>Ne communique jamais ton code secret Nita ou Amana par message ou appel.</li>
          <li>Vérifie que le montant, les frais et la référence correspondent avant de valider.</li>
          <li>Conserve ce recu comme preuve; le vendeur peut verifier la commande dans son espace.</li>
          <li>AMAZER ne te demandera jamais ton code secret par SMS ou appel.</li>
        </ul>
      </article>

      <div className="flex flex-wrap gap-2">
        <Button onClick={downloadPdf} className="primary-glow-btn bg-[#FF4D00] text-white hover:bg-[#e74700]">
          Telecharger le recu (PDF)
        </Button>
        <Button onClick={saveAsImage} className="border border-slate-200 bg-white text-slate-800 hover:bg-slate-50">
          Enregistrer en image
        </Button>
        <Button onClick={sharePdf} className="border border-slate-200 bg-white text-slate-800 hover:bg-slate-50">
          Partager le recu (PDF)
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Sur mobile, l&apos;option image permet de sauvegarder le recu comme photo ou de l&apos;envoyer vers la galerie.
      </p>
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
