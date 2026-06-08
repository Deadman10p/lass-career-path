// Shared helper to capture a DOM node into a PDF (Blob or saved file).
// Mirrors the logic that ResultsPage uses for the student-facing download
// so the bulk-export ZIP for counsellors looks identical.

export interface ExportPdfOptions {
  /** When provided, the PDF will be saved with this filename in addition to returning a Blob. */
  filename?: string;
  /** CSS scale factor for html2canvas. Default 3 (higher = sharper, slower). */
  scale?: number;
  /** Additional CSS injected into the cloned document for export. */
  extraExportCss?: string;
}

const BASE_EXPORT_CSS = `
  .lass-pdf-export, .lass-pdf-export * {
    animation: none !important;
    transition: none !important;
    transform: none !important;
    opacity: 1 !important;
    filter: none !important;
  }
  .lass-pdf-export [data-pdf-section] {
    display: block !important;
    visibility: visible !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .lass-pdf-export .lass-hero-navy {
    background: var(--report-hero-bg, linear-gradient(140deg, #0f2547 0%, #1B3A6B 55%, #14305c 100%)) !important;
  }
  .lass-pdf-export .shadow-card,
  .lass-pdf-export .shadow-elevated,
  .lass-pdf-export .shadow-glow { box-shadow: none !important; }
  .lass-pdf-export .recharts-wrapper,
  .lass-pdf-export .recharts-surface { overflow: visible !important; }
`;

export async function exportNodeToPdf(
  node: HTMLElement,
  opts: ExportPdfOptions = {},
): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const A4_W = 210, A4_H = 297, MARGIN = 10;
  const CONTENT_W = A4_W - MARGIN * 2;
  const PAGE_H = A4_H - MARGIN * 2;
  const GAP = 3;
  const SCALE = opts.scale ?? 3;
  const exportStyles = BASE_EXPORT_CSS + (opts.extraExportCss ?? "");

  const sections = Array.from(
    node.querySelectorAll<HTMLElement>("[data-pdf-section]"),
  );
  if (!sections.length) {
    // Fall back to the whole node so callers still get a non-empty PDF.
    sections.push(node);
  }
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  let y = MARGIN;
  let first = true;

  node.classList.add("lass-pdf-export");
  try {
    await document.fonts?.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    for (const section of sections) {
      const canvas = await html2canvas(section, {
        scale: SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: Math.max(document.documentElement.clientWidth, node.scrollWidth),
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement("style");
          style.textContent = exportStyles;
          clonedDoc.head.appendChild(style);
        },
      });
      const hMM = (canvas.height * CONTENT_W) / canvas.width;

      if (hMM > PAGE_H) {
        const pageHeightPx = Math.floor((PAGE_H * canvas.width) / CONTENT_W);
        let offsetPx = 0;
        while (offsetPx < canvas.height) {
          const sliceHpx = Math.min(pageHeightPx, canvas.height - offsetPx);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceHpx;
          const ctx = slice.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, offsetPx, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
          if (!first) pdf.addPage();
          first = false;
          const sliceHmm = (sliceHpx * CONTENT_W) / canvas.width;
          pdf.addImage(slice.toDataURL("image/png"), "PNG", MARGIN, MARGIN, CONTENT_W, sliceHmm, undefined, "FAST");
          offsetPx += sliceHpx;
          y = MARGIN + sliceHmm + GAP;
        }
        continue;
      }

      if (!first && y + hMM > MARGIN + PAGE_H) {
        pdf.addPage();
        y = MARGIN;
      }
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", MARGIN, y, CONTENT_W, hMM, undefined, "FAST");
      y += hMM + GAP;
      first = false;
    }
  } finally {
    node.classList.remove("lass-pdf-export");
  }

  if (opts.filename) pdf.save(opts.filename);
  return pdf.output("blob");
}
