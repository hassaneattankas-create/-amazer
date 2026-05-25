"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ImageOff, ImageUp } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { resolveImageUrl } from "@/lib/image";
import { uploadMedia } from "@/services/media-service";

function dedupeUrls(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

type UploadTriggerProps = {
  label: string;
  multiple?: boolean;
  onUploaded: (urls: string[]) => void;
};

function UploadTrigger({ label, multiple = false, onUploaded }: UploadTriggerProps) {
  const inputId = useId();
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }
    setStatus("");
    setIsUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const response = await uploadMedia(file);
        uploaded.push(response.url);
      }
      onUploaded(uploaded);
      setStatus(uploaded.length > 1 ? "Images ajoutees." : "Image ajoutee.");
    } catch (error) {
      setStatus(getApiErrorMessage(error, "Erreur lors de l'upload."));
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
      >
        <ImageUp className="h-3.5 w-3.5 text-[#FF4D00]" />
        {isUploading ? "Upload..." : label}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleUpload}
        className="sr-only"
      />
      {status ? <span className="text-slate-500">{status}</span> : null}
    </div>
  );
}

type SingleMediaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  emptyMessage?: string;
};

export function SingleMediaField({
  label,
  value,
  onChange,
  emptyMessage = "Aucune image selectionnee.",
}: SingleMediaFieldProps) {
  const [imgError, setImgError] = useState(false);
  const previewUrl = resolveImageUrl(value) ?? value;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {value ? (
          <button
            type="button"
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
            onClick={() => { onChange(""); setImgError(false); }}
          >
            Retirer
          </button>
        ) : null}
      </div>
      {previewUrl && !imgError ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Image
            src={previewUrl}
            alt={label}
            width={960}
            height={540}
            unoptimized
            className="h-36 w-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      ) : previewUrl && imgError ? (
        <div className="flex h-36 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 text-xs text-slate-400">
          <ImageOff className="h-5 w-5" />
          Image non disponible — reuploader depuis la galerie
        </div>
      ) : (
        <p className="text-xs text-slate-500">{emptyMessage}</p>
      )}
      <UploadTrigger label={label} onUploaded={(urls) => { onChange(urls[0] ?? ""); setImgError(false); }} />
    </div>
  );
}

type GalleryItemProps = {
  previewUrl: string;
  label: string;
  index: number;
  onRemove: () => void;
};

function GalleryItem({ previewUrl, label, index, onRemove }: GalleryItemProps) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {imgError ? (
          <div className="flex h-28 items-center justify-center gap-1 bg-slate-100 text-xs text-slate-400">
            <ImageOff className="h-4 w-4" />
            Indisponible
          </div>
        ) : (
          <Image
            src={previewUrl}
            alt={`${label} ${index + 1}`}
            width={720}
            height={720}
            unoptimized
            className="h-28 w-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <button
        type="button"
        className="text-xs font-medium text-slate-500 hover:text-slate-800"
        onClick={onRemove}
      >
        Retirer
      </button>
    </div>
  );
}

type GalleryMediaFieldProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  maxItems?: number;
};

export function GalleryMediaField({
  label,
  values,
  onChange,
  maxItems = 12,
}: GalleryMediaFieldProps) {
  const normalizedValues = dedupeUrls(values).slice(0, maxItems);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="text-xs text-slate-500">
            {normalizedValues.length}/{maxItems} image(s)
          </p>
        </div>
        {normalizedValues.length ? (
          <button
            type="button"
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
            onClick={() => onChange([])}
          >
            Vider
          </button>
        ) : null}
      </div>
      {normalizedValues.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {normalizedValues.map((value, index) => {
            const previewUrl = resolveImageUrl(value) ?? value;
            return (
              <GalleryItem
                key={`${value}-${index}`}
                previewUrl={previewUrl}
                label={label}
                index={index}
                onRemove={() => onChange(normalizedValues.filter((entry) => entry !== value))}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Ajoute les photos depuis la galerie du telephone.</p>
      )}
      <UploadTrigger
        label={label}
        multiple
        onUploaded={(urls) => onChange(dedupeUrls([...normalizedValues, ...urls]).slice(0, maxItems))}
      />
    </div>
  );
}
