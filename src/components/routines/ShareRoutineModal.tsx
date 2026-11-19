import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Link2, Share2, X } from "lucide-react";
import { ACCENT, GLASS, RADIUS, SCRIM, STATUS, SURFACE, TEXT, Z_INDEX } from "@/design/tokens";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { createOrGetSharedRoutine } from "@/services/sharedRoutineService";

export interface ShareRoutineModalProps {
  routine: RoutineWithExercises | null;
  userId: string;
  ownerName: string;
  onClose: () => void;
}

export function ShareRoutineModal({
  routine,
  userId,
  ownerName,
  onClose,
}: ShareRoutineModalProps) {
  const [shareUrl, setShareUrl] = useState("");
  const [qrSrc, setQrSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routine) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setShareUrl("");
    setQrSrc("");

    void (async () => {
      const created = await createOrGetSharedRoutine(routine, userId, ownerName);
      if (!alive) return;
      if (!created) {
        setError("No se pudo generar el enlace compartido.");
        setLoading(false);
        return;
      }
      setShareUrl(created.url);
      try {
        const dataUrl = await QRCode.toDataURL(created.url, {
          width: 260,
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: "M",
        });
        if (alive) setQrSrc(dataUrl);
      } catch {
        // Fallback to URL-only sharing
      }
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [routine, userId, ownerName]);

  if (!routine) return null;

  const handleCopy = async () => {
    if (!shareUrl || !navigator.clipboard) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (!shareUrl) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `${routine.title} · Cronos Gym`,
          text: `Clona mi rutina "${routine.title}" en 1 toque:`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or unsupported
      }
    }
    await handleCopy();
  };

  return (
    <div
      role="dialog"
      aria-label="Compartir rutina por enlace o QR"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.modal,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: SCRIM.modal,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-3xl p-5 shadow-2xl"
        style={{
          backgroundColor: SURFACE.l1,
          border: `1px solid ${GLASS.borderStrong}`,
          borderRadius: RADIUS.modal,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT.text }}>
              Compartir Rutina · 1 toque
            </p>
            <h3 className="mt-0.5 text-base font-bold text-white">{routine.title}</h3>
          </div>
          <button
            type="button"
            aria-label="Cerrar compartir rutina"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: SURFACE.sunken, color: TEXT.secondary, border: `1px solid ${GLASS.border}` }}
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div
            className="flex h-52 items-center justify-center rounded-2xl text-xs"
            style={{ backgroundColor: SURFACE.sunken, color: TEXT.secondary }}
          >
            Generando link y código QR…
          </div>
        ) : error ? (
          <p className="rounded-xl p-3 text-xs" style={{ backgroundColor: ACCENT.subtle, color: ACCENT.text }}>
            {error}
          </p>
        ) : (
          <>
            {qrSrc && (
              <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-3xl bg-white p-3">
                <img src={qrSrc} alt={`QR de ${routine.title}`} className="h-full w-full object-contain" />
              </div>
            )}

            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
            >
              <Link2 size={14} style={{ color: TEXT.secondary, flexShrink: 0 }} />
              <span className="min-w-0 flex-1 truncate font-mono text-white">{shareUrl}</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleNativeShare()}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl text-xs font-bold text-white"
                style={{ backgroundColor: ACCENT.base }}
              >
                <Share2 size={14} />
                <span>Compartir</span>
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl px-4 text-xs font-semibold"
                style={{
                  backgroundColor: copied ? STATUS.success.muted : SURFACE.sunken,
                  border: `1px solid ${GLASS.border}`,
                  color: copied ? STATUS.success.text : TEXT.primary,
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "Copiado" : "Copiar link"}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
