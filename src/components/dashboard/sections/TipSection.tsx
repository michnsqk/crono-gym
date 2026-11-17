import { useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Megaphone, RotateCcw, Trophy, Zap } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { useRole } from "@/hooks/useRole";
import type { Announcement, AnnouncementCategory } from "@/hooks/useAnnouncements";
import { ACCENT, GLASS, SOLID, TEXT } from "@/design/tokens";

export interface Tip {
  id: string;
  text: string;
  icon: "lightbulb" | "zap";
  category: string;
}

export interface TipSectionProps {
  tip: Tip | string;
  tips?: Tip[] | string[];
  onNext: () => void;
  announcements?: Announcement[];
  onPublish?: (input: Pick<Announcement, "title" | "body" | "category" | "imageUrl">) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  embedded?: boolean;
}

const categoryLabel: Record<AnnouncementCategory, string> = {
  urgent: "URGENTE",
  event: "EVENTO",
  info: "AVISO OFICIAL",
};

function CategoryIcon({ category }: { category: AnnouncementCategory }) {
  if (category === "urgent") return <AlertCircle size={13} aria-hidden="true" />;
  if (category === "event") return <Trophy size={13} aria-hidden="true" />;
  return <Megaphone size={13} aria-hidden="true" />;
}

function text(value: Tip | string) { return typeof value === "string" ? value : value.text; }

/**
 * The photo of an announcement, whatever column or mirror key it arrived on.
 *
 * `useAnnouncements` folds `banner_path` and the local mirror into `imageUrl`,
 * but a row can also reach this card with only `image_url` (the admin mirror) or
 * a legacy `imageUrl` key. Resolving every spelling in one place is what keeps
 * the photo on the card instead of silently dropping it.
 */
function announcementImage(announcement: Announcement): string | undefined {
  const row = announcement as unknown as Record<string, unknown>;
  for (const candidate of [row.imageUrl, row.banner_path, row.image_path, row.image_url]) {
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
  }
  return undefined;
}

export function TipSection({ tip, tips, onNext, announcements = [], onPublish, onDelete }: TipSectionProps) {
  const { role } = useRole();
  const [tab, setTab] = useState<"announcements" | "tips">(announcements.length > 0 ? "announcements" : "tips");
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("info");
  const [imageUrl, setImageUrl] = useState("");
  const tipItems = tips && tips.length ? tips : [tip];
  const currentAnnouncement = announcements[announcementIndex];
  useEffect(() => {
    if (announcements.length > 0) setTab("announcements");
    setAnnouncementIndex((current) => Math.min(current, Math.max(0, announcements.length - 1)));
  }, [announcements.length]);

  async function publish() {
    if (!title.trim() || !body.trim() || !onPublish) return;
    await onPublish({ title, body, category, imageUrl: imageUrl || undefined });
    setTitle(""); setBody(""); setImageUrl(""); setComposerOpen(false);
  }

  return (
    <section
      className="rounded-2xl p-4"
      style={{ backgroundColor: SOLID.card, border: `1px solid ${GLASS.border}` }}
      aria-label="Avisos del Gym y Tips IA"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl p-1" style={{ backgroundColor: SOLID.popover }} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "announcements"}
            onClick={() => setTab("announcements")}
            className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-white"
            style={{
              backgroundColor: tab === "announcements" ? GLASS.fillRaised : "transparent",
              color: tab === "announcements" ? TEXT.primary : TEXT.secondary,
            }}
          >
            <Megaphone size={14} aria-hidden="true" style={{ color: ACCENT.base }} />
            <span>Avisos {announcements.length > 0 ? `(${announcements.length})` : ""}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "tips"}
            onClick={() => setTab("tips")}
            className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-zinc-400"
            style={{
              backgroundColor: tab === "tips" ? GLASS.fillRaised : "transparent",
              color: tab === "tips" ? TEXT.primary : TEXT.secondary,
            }}
          >
            <Zap size={14} aria-hidden="true" />
            <span>Tips IA</span>
          </button>
        </div>
        {(role === "admin" || role === "developer" || import.meta.env.DEV) && onPublish ? (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="whitespace-nowrap text-xs font-semibold"
            style={{ color: ACCENT.base }}
          >
            + Nuevo aviso
          </button>
        ) : null}
      </header>

      {tab === "announcements" && currentAnnouncement ? (
        <article className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: ACCENT.base }}>
              <CategoryIcon category={currentAnnouncement.category} />
              <span>{categoryLabel[currentAnnouncement.category]}</span>
            </span>
            <time className="font-mono text-xs text-zinc-400">{new Date(currentAnnouncement.createdAt).toLocaleDateString("es-MX")}</time>
          </div>
          <h3 className="mt-2 text-base font-bold text-white">{currentAnnouncement.title}</h3>
          {announcementImage(currentAnnouncement) ? (
            <img
              src={announcementImage(currentAnnouncement)}
              alt={`Foto del aviso: ${currentAnnouncement.title}`}
              className="mt-2 mb-3 max-h-44 w-full object-contain rounded-2xl bg-neutral-950 p-2"
              style={{ border: `1px solid ${GLASS.border}` }}
            />
          ) : null}
          <p className="mt-1 text-sm text-zinc-300">{currentAnnouncement.body}</p>
          {announcements.length > 1 ? (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                className="h-11 rounded-xl whitespace-nowrap px-3.5 py-2 flex items-center gap-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: SOLID.popover, border: `1px solid ${GLASS.border}` }}
                onClick={() => setAnnouncementIndex((announcementIndex - 1 + announcements.length) % announcements.length)}
              >
                <ChevronLeft size={14} aria-hidden="true" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                className="h-11 rounded-xl whitespace-nowrap px-3.5 py-2 flex items-center gap-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: SOLID.popover, border: `1px solid ${GLASS.border}` }}
                onClick={() => setAnnouncementIndex((announcementIndex + 1) % announcements.length)}
              >
                <span>Siguiente</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          ) : null}
          {(role === "admin" || role === "developer" || import.meta.env.DEV) && onDelete ? <button type="button" onClick={() => void onDelete(currentAnnouncement.id)} className="mt-3 text-xs text-zinc-400 hover:text-zinc-200">Eliminar aviso</button> : null}
        </article>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-zinc-300" aria-live="polite">{text(tipItems[tipIndex] ?? tip)}</p>
          <GlassButton variant="secondary" icon={<RotateCcw size={16} />} onClick={() => { setTipIndex((tipIndex + 1) % tipItems.length); onNext(); }} className="mt-4 h-11">Siguiente tip</GlassButton>
        </div>
      )}

      {composerOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Nuevo aviso">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1C1C1E] p-4">
          <h3 className="text-base font-bold text-white">Publicar aviso</h3>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título" className="mt-4 h-11 w-full rounded-xl border border-white/10 bg-[#2C2C2E] px-3 text-white" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Mensaje" rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-[#2C2C2E] p-3 text-white" />
          <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="URL de foto (opcional)" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#2C2C2E] px-3 text-white" />
          <select value={category} onChange={(event) => setCategory(event.target.value as AnnouncementCategory)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#2C2C2E] px-3 text-white">
            <option value="info">Aviso</option><option value="event">Evento</option><option value="urgent">Urgente</option>
          </select>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setComposerOpen(false)} className="h-11 rounded-xl bg-[#2C2C2E] px-4 text-sm text-white">Cancelar</button><button type="button" onClick={() => void publish()} className="h-11 rounded-xl bg-[#FF3B30] px-4 text-sm font-semibold text-white">Publicar</button></div>
        </div>
      </div> : null}
    </section>
  );
}
