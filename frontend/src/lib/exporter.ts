import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

async function capture(el: HTMLElement): Promise<HTMLCanvasElement> {
  // Determine a background color (use computed body bg)
  const isDark = document.documentElement.classList.contains("dark");
  return html2canvas(el, {
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
}

export async function exportPNG(el: HTMLElement, filename: string) {
  const canvas = await capture(el);
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function exportPDF(el: HTMLElement, filename: string) {
  const canvas = await capture(el);
  const imgData = canvas.toDataURL("image/png");
  const imgW = canvas.width;
  const imgH = canvas.height;
  const orientation = imgW >= imgH ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / imgW, pageH / imgH);
  const w = imgW * ratio;
  const h = imgH * ratio;
  const x = (pageW - w) / 2;
  const y = 20;
  pdf.addImage(imgData, "PNG", x, y, w, h);
  pdf.save(`${filename}.pdf`);
}

export function printElement() {
  window.print();
}
