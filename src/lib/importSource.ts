// Transforme un fichier de cours (PDF, texte, photo) en texte utilisable par Claude.
// Les PDF avec du texte sont lus sur l'appareil ; les photos et les PDF scannés sont lus par Claude.
import { SOURCE_MAX } from "../../shared/study";
import { readWithClaude } from "./api";

export type Progress = (message: string) => void;

const MAX_SCANNED_PAGES = 15;
const TEXT_EXT = /\.(txt|md|markdown|text|csv)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

export const ACCEPTED_FILES = ".pdf,.txt,.md,.markdown,text/plain,application/pdf,image/*";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Impossible de lire ce fichier."));
    reader.readAsDataURL(blob);
  });
}

async function decodeImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error(
        `Impossible d'ouvrir la photo « ${file.name} ». Sur iPhone, choisis-la depuis la photothèque (elle est alors convertie en JPEG).`,
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Photo réduite (1600 px maximum) et compressée en JPEG : envoi rapide, lecture fiable. */
export async function imageToJpegBase64(file: File, maxSide = 1600): Promise<string> {
  const img = await decodeImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Ton navigateur ne peut pas préparer cette photo.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if ("close" in img && typeof img.close === "function") img.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error("Impossible de préparer cette photo.");
  return blobToBase64(blob);
}

async function readPdf(file: File, onProgress: Progress, signal?: AbortSignal): Promise<string> {
  onProgress("Ouverture du PDF…");
  const { openPdf, pdfPagesText, pdfPageImage } = await import("./pdf");
  const { doc, close } = await openPdf(await file.arrayBuffer());
  try {
    const pages = await pdfPagesText(doc, (n) => onProgress(`Lecture de la page ${n}/${doc.numPages}…`));
    const text = pages.join("\n\n").trim();
    // Peu de texte par page : c'est un PDF scanné (des images), Claude doit le lire.
    if (text.length / Math.max(1, doc.numPages) >= 60) return text;
    const count = Math.min(doc.numPages, MAX_SCANNED_PAGES);
    const parts: string[] = [];
    for (let n = 1; n <= count; n++) {
      if (signal?.aborted) throw new DOMException("Annulé", "AbortError");
      onProgress(`PDF scanné : Claude lit la page ${n}/${count}…`);
      const image = await pdfPageImage(doc, n);
      parts.push((await readWithClaude("image/jpeg", image, signal)).texte);
    }
    if (doc.numPages > count) parts.push(`[Seules les ${count} premières pages ont été lues.]`);
    return parts.join("\n\n");
  } finally {
    close();
  }
}

/** Texte d'un fichier de cours. Les erreurs ont un message en français prêt à afficher. */
export async function extractText(file: File, onProgress: Progress, signal?: AbortSignal): Promise<string> {
  const type = file.type;
  if (type === "application/pdf" || /\.pdf$/i.test(file.name)) return readPdf(file, onProgress, signal);
  if (type.startsWith("text/") || TEXT_EXT.test(file.name)) {
    onProgress(`Lecture de « ${file.name} »…`);
    return (await file.text()).trim();
  }
  if (type.startsWith("image/") || IMAGE_EXT.test(file.name)) {
    onProgress(`Préparation de la photo « ${file.name} »…`);
    const data = await imageToJpegBase64(file);
    onProgress(`Claude lit la photo « ${file.name} »…`);
    return (await readWithClaude("image/jpeg", data, signal)).texte;
  }
  if (/\.docx?$/i.test(file.name)) {
    throw new Error("Les fichiers Word ne sont pas pris en charge : enregistre-le en PDF, ou copie-colle le texte.");
  }
  throw new Error(`Format non pris en charge (« ${file.name} ») : utilise un PDF, un fichier texte ou une photo.`);
}

/** Coupe un cours trop long pour Claude, en le signalant. */
export function limitSource(text: string): { texte: string; coupe: boolean } {
  if (text.length <= SOURCE_MAX) return { texte: text, coupe: false };
  const cut = text.lastIndexOf("\n", SOURCE_MAX);
  return { texte: text.slice(0, cut > SOURCE_MAX * 0.8 ? cut : SOURCE_MAX), coupe: true };
}
