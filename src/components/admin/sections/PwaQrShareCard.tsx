import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, FileText, QrCode, Smartphone } from "lucide-react";
import { ACCENT, GLASS, SURFACE, TEXT } from "@/design/tokens";

const DEFAULT_PWA_URL = "https://cronogym.vercel.app/";
const DEFAULT_CHECKIN_URL = "https://cronogym.vercel.app/checkin?gate=cronos-main";

/** Builds a valid 1-page A4/Letter-proportioned PDF embedding a JPEG image buffer. */
function buildSingleImagePdf(jpegBytes: Uint8Array, imgWidth: number, imgHeight: number): Blob {
  const pageW = 595; // A4 width in pt
  const pageH = 842; // A4 height in pt
  const drawW = 420;
  const drawH = Math.round((drawW * imgHeight) / imgWidth);
  const drawX = Math.round((pageW - drawW) / 2);
  const drawY = Math.round((pageH - drawH) / 2);

  const enc = new TextEncoder();
  const contentStream = `q\n${drawW} 0 0 ${drawH} ${drawX} ${drawY} cm\n/Im0 Do\nQ\n`;
  const contentBytes = enc.encode(contentStream);

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let cursor = 0;

  const pushStr = (s: string) => {
    const b = enc.encode(s);
    chunks.push(b);
    cursor += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    cursor += b.length;
  };

  pushStr("%PDF-1.4\n");

  const startObj = (id: number) => {
    offsets[id] = cursor;
    pushStr(`${id} 0 obj\n`);
  };

  // 1: Catalog
  startObj(1);
  pushStr("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2: Pages
  startObj(2);
  pushStr("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // 3: Page
  startObj(3);
  pushStr(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  // 4: Image XObject (DCTDecode / JPEG)
  startObj(4);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  pushBytes(jpegBytes);
  pushStr("\nendstream\nendobj\n");

  // 5: Page content stream
  startObj(5);
  pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
  pushBytes(contentBytes);
  pushStr("endstream\nendobj\n");

  const xrefStart = cursor;
  pushStr("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    pushStr(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const merged = new Uint8Array(cursor);
  let pos = 0;
  for (const part of chunks) {
    merged.set(part, pos);
    pos += part.length;
  }
  return new Blob([merged], { type: "application/pdf" });
}

async function renderPosterCanvas(url: string): Promise<HTMLCanvasElement> {
  const width = 1024;
  const height = 1280;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar el lienzo");

  // Obsidian background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // Subtle top crimson glow
  const glow = ctx.createRadialGradient(width / 2, 160, 20, width / 2, 160, 420);
  glow.addColorStop(0, "rgba(215, 0, 21, 0.28)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.font = "bold 56px -apple-system, BlinkMacSystemFont, Inter, sans-serif";
  ctx.fillText("CRONOS GYM", width / 2, 136);

  ctx.fillStyle = "#A1A1AA";
  ctx.font = "500 28px -apple-system, BlinkMacSystemFont, Inter, sans-serif";
  ctx.fillText("Escanea para instalar la app en tu celular", width / 2, 196);

  // QR white card
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
    width: 680,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
    errorCorrectionLevel: "H",
  });

  const cardSize = 740;
  const cardX = (width - cardSize) / 2;
  const cardY = 260;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardSize, cardSize, 40);
  ctx.fill();

  ctx.drawImage(qrCanvas, cardX + 30, cardY + 30, 680, 680);

  // Instructions footer
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 30px -apple-system, BlinkMacSystemFont, Inter, sans-serif";
  ctx.fillText("iOS (Safari): Compartir -> Agregar a inicio", width / 2, 1086);
  ctx.fillText("Android (Chrome): Toca 'Instalar aplicación'", width / 2, 1136);

  ctx.fillStyle = "#71717A";
  ctx.font = "500 24px monospace";
  ctx.fillText(url, width / 2, 1210);

  return canvas;
}

export function PwaQrShareCard() {
  const [qrMode, setQrMode] = useState<"pwa" | "checkin">("pwa");
  const [targetUrl, setTargetUrl] = useState(DEFAULT_PWA_URL);
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const mountedRef = useRef(true);

  const switchMode = (nextMode: "pwa" | "checkin") => {
    setQrMode(nextMode);
    setTargetUrl(nextMode === "pwa" ? DEFAULT_PWA_URL : DEFAULT_CHECKIN_URL);
  };

  useEffect(() => {
    mountedRef.current = true;
    void QRCode.toDataURL(targetUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    }).then((dataUrl) => {
      if (mountedRef.current) setPreviewSrc(dataUrl);
    });
    return () => {
      mountedRef.current = false;
    };
  }, [targetUrl]);

  async function handleDownloadPng() {
    setBusy("png");
    try {
      const canvas = await renderPosterCanvas(targetUrl);
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "cronos-gym-pwa-qr.png";
      link.click();
    } finally {
      setBusy(null);
    }
  }

  async function handleDownloadPdf() {
    setBusy("pdf");
    try {
      const canvas = await renderPosterCanvas(targetUrl);
      const jpegBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.94),
      );
      if (!jpegBlob) return;
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const pdfBlob = buildSingleImagePdf(jpegBytes, canvas.width, canvas.height);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cronos-gym-pwa-qr.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="grid gap-4 rounded-3xl p-5"
      style={{
        backgroundColor: SURFACE.l1,
        border: `1px solid ${GLASS.border}`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: ACCENT.subtle, color: ACCENT.base }}
          >
            <QrCode size={22} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {qrMode === "pwa" ? "QR de descarga PWA" : "QR Check-in Recepción"}
            </h2>
            <p className="text-xs" style={{ color: TEXT.secondary }}>
              {qrMode === "pwa"
                ? "Imprime o comparte este código en el gimnasio para que los atletas instalen la app al escanear."
                : "Coloca este QR en la entrada del gym para registrar asistencias y rachas diarias."}
            </p>
          </div>
        </div>
        <div
          className="grid grid-cols-2 gap-1 rounded-xl p-1"
          style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
        >
          <button
            type="button"
            onClick={() => switchMode("pwa")}
            className="h-8 rounded-lg px-2.5 text-xs font-semibold"
            style={{
              backgroundColor: qrMode === "pwa" ? ACCENT.base : "transparent",
              color: qrMode === "pwa" ? TEXT.primary : TEXT.secondary,
            }}
          >
            QR App
          </button>
          <button
            type="button"
            onClick={() => switchMode("checkin")}
            className="h-8 rounded-lg px-2.5 text-xs font-semibold"
            style={{
              backgroundColor: qrMode === "checkin" ? ACCENT.base : "transparent",
              color: qrMode === "checkin" ? TEXT.primary : TEXT.secondary,
            }}
          >
            Check-in QR
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[240px_1fr] md:items-center">
        <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-3xl bg-white p-3 shadow-lg">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="Código QR para instalar Cronos Gym"
              width={200}
              height={200}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-xs text-zinc-600">Generando QR…</span>
          )}
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-medium" style={{ color: TEXT.secondary }}>
              URL de instalación
            </span>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="h-11 rounded-2xl border border-white/10 bg-black/50 px-3.5 font-mono text-xs text-white outline-none focus:border-white/25"
            />
          </label>

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs text-zinc-300">
            <Smartphone size={15} className="shrink-0 text-zinc-400" aria-hidden="true" />
            <span>Compatible con cámara nativa de iPhone (iOS) y Google Pixel / Android.</span>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => void handleDownloadPng()}
              disabled={busy !== null}
              className="btn-crimson-accessible inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              <Download size={16} aria-hidden="true" />
              {busy === "png" ? "Generando PNG…" : "Descargar PNG"}
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={busy !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-[#1C1C1E] px-5 text-sm font-semibold text-white transition hover:bg-[#2C2C2E] active:scale-[0.98] disabled:opacity-50"
            >
              <FileText size={16} aria-hidden="true" />
              {busy === "pdf" ? "Generando PDF…" : "Descargar PDF"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
