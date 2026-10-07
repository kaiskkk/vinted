// Lecture des PDF dans le navigateur (pdf.js), chargée seulement quand on importe un PDF.
// Version « legacy » : elle fonctionne aussi sur les navigateurs de téléphone un peu anciens.
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Ouvre un PDF ; `close` libère la mémoire une fois la lecture finie. */
export async function openPdf(data: ArrayBuffer): Promise<{ doc: PDFDocumentProxy; close: () => void }> {
  const task = getDocument({ data });
  try {
    return { doc: await task.promise, close: () => void task.destroy() };
  } catch (err) {
    if (err instanceof Error && err.name === "PasswordException") throw new Error("Ce PDF est protégé par un mot de passe.");
    throw new Error("Ce PDF est illisible ou abîmé.");
  }
}

/** Texte de chaque page (vide pour une page scannée). */
export async function pdfPagesText(doc: PDFDocumentProxy, onPage?: (n: number) => void): Promise<string[]> {
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    onPage?.(n);
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : "");
    }
    pages.push(
      text
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    );
    page.cleanup();
  }
  return pages;
}

/** Image JPEG (base64) d'une page, pour la faire lire par Claude quand le PDF est scanné. */
export async function pdfPageImage(doc: PDFDocumentProxy, n: number, maxSide = 1600): Promise<string> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, maxSide / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport }).promise;
  const data = canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "";
  page.cleanup();
  canvas.width = canvas.height = 0;
  return data;
}
