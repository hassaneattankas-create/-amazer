/**
 * Prepare une photo avant envoi : les photos de telephone (3 a 8 Mo) sont redimensionnees
 * (1600 px max) et compressees en JPEG (~450 Ko max). Ainsi l'envoi passe meme en 3G
 * et le serveur n'a jamais a les refuser.
 */
const MAX_SIDE = 1600;
const TARGET_BYTES = 450_000;
const READY_TYPES = ["image/jpeg", "image/png", "image/webp"];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Cette photo ne peut pas être lue sur cet appareil. Choisissez une photo JPG ou PNG."));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function preparePhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
    throw new Error("Ce fichier n'est pas une photo. Choisissez une image JPG ou PNG.");
  }
  if (file.type === "image/gif") return file;
  if (READY_TYPES.includes(file.type) && file.size <= TARGET_BYTES) return file;

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#FFFFFF"; // fond blanc pour les PNG transparents
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let blob: Blob | null = null;
  for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    blob = await toBlob(canvas, quality);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}
