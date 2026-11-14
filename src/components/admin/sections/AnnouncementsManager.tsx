import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Megaphone, Pin, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image/compressImage";
import { ACCENT, GLASS, RADIUS, STATUS, SURFACE, TEXT } from "@/design/tokens";
import {
  cleanAnnouncementMeta,
  clearAnnouncementCaches,
  dedupeLocalAnnouncements,
  findAnnouncementMeta,
  readLocalAnnouncements,
  saveAnnouncementMeta,
  saveLocalAnnouncement,
  type AnnouncementMeta,
} from "@/lib/gymClubMetadata";

type AnnouncementRow = {
  id: string;
  title: string;
  body?: string;
  message?: string;
  category?: string;
  banner_path?: string;
  image_url?: string;
  imageUrl?: string;
  active?: boolean;
  pinned?: boolean;
  created_at?: string;
};

const field =
  "min-h-[42px] w-full min-w-0 rounded-xl border border-white/10 bg-zinc-800/80 px-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/25";

function normalizedTitle(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function dedupeAnnouncements(
  local: AnnouncementRow[],
  remote: AnnouncementRow[],
): AnnouncementRow[] {
  const remoteIds = new Set(remote.map((item) => String(item.id ?? "").trim()).filter(Boolean));
  const remoteTitles = new Set(remote.map((item) => normalizedTitle(item.title)).filter(Boolean));
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const kept: AnnouncementRow[] = [];

  for (const item of local) {
    const id = String(item.id ?? "").trim();
    const title = normalizedTitle(item.title);
    if (id && (seenIds.has(id) || remoteIds.has(id))) continue;
    if (title && (seenTitles.has(title) || remoteTitles.has(title))) continue;
    if (id) seenIds.add(id);
    if (title) seenTitles.add(title);
    kept.push(item);
  }

  return kept;
}

export function AnnouncementsManager() {
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("info");
  const [imageUrl, setImageUrl] = useState("");
  const [pinned, setPinned] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const meta = cleanAnnouncementMeta();
    const feed = dedupeLocalAnnouncements<AnnouncementRow>();
    const cleaned: string[] = [];
    if (feed.removed > 0) cleaned.push(`${feed.removed} aviso(s) duplicado(s) del espejo local`);
    if (meta.removed.length > 0) cleaned.push(`${meta.removed.length} clave(s) de metadatos huerfana(s)`);

    const { data } = await (supabase as any)
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    const remoteItems = (data ?? []).map((item: AnnouncementRow) => {
      const itemMeta = findAnnouncementMeta(item.id, item.title);
      const banner = item.banner_path || itemMeta?.imageUrl || item.image_url;
      return {
        ...item,
        ...itemMeta,
        imageUrl: banner,
        image_url: banner,
      };
    });
    const localItems = dedupeAnnouncements(readLocalAnnouncements<AnnouncementRow>(), remoteItems);
    setItems([...remoteItems, ...localItems]);
    if (cleaned.length > 0) setStatus(`Limpieza automatica: ${cleaned.join(" y ")} eliminados.`);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetCache = () => {
    clearAnnouncementCaches();
    setStatus("Cache de avisos reseteado. Los avisos de Supabase se vuelven a leer al recargar.");
    void load();
    window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
  };

  const publish = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle) {
      setStatus("Escribe un título para publicar el aviso.");
      return;
    }
    const localItem: AnnouncementRow = {
      id: `local-announcement-${Date.now()}`,
      title: trimmedTitle,
      message: trimmedBody,
      body: trimmedBody,
      category,
      imageUrl: imageUrl || undefined,
      image_url: imageUrl || undefined,
      pinned,
      active: true,
      created_at: new Date().toISOString(),
    };
    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any)
      .from("announcements")
      .insert({
        title: trimmedTitle,
        message: trimmedBody,
        kind: category === "event" ? "event" : "notice",
        banner_path: imageUrl || null,
        starts_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        created_by: authData.user?.id,
      })
      .select("id")
      .single();
    if (error) {
      saveLocalAnnouncement(localItem);
      saveAnnouncementMeta([localItem.id, trimmedTitle], {
        imageUrl: imageUrl || undefined,
        category: category as AnnouncementMeta["category"],
        pinned,
        active: true,
      });
      setItems((current) => [localItem, ...current]);
      setTitle("");
      setBody("");
      setImageUrl("");
      setPinned(false);
      setStatus("Aviso guardado localmente y publicado en /hoy.");
      window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
      return;
    }
    saveAnnouncementMeta([String(data?.id ?? ""), trimmedTitle], {
      imageUrl: imageUrl || undefined,
      category: category as AnnouncementMeta["category"],
      pinned,
      active: true,
    });
    saveLocalAnnouncement({ ...localItem, id: String(data?.id ?? localItem.id) });
    setItems((current) => [{ ...localItem, id: String(data?.id ?? localItem.id) }, ...current]);
    setTitle("");
    setBody("");
    setImageUrl("");
    setPinned(false);
    setStatus("Aviso publicado.");
    window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
    await load();
  };

  const update = async (id: string, values: Partial<AnnouncementRow>) => {
    const current = items.find((item) => item.id === id);
    const meta: AnnouncementMeta = {
      imageUrl:
        typeof values.image_url === "string"
          ? values.image_url
          : current?.imageUrl ?? current?.image_url,
      category: (values.category ?? current?.category) as AnnouncementMeta["category"],
      pinned: values.pinned ?? current?.pinned,
      active: values.active ?? current?.active,
    };
    if ("pinned" in values || "active" in values || "image_url" in values || "category" in values) {
      saveAnnouncementMeta([id, current?.title ?? ""], meta);
    }
    await load();
    window.dispatchEvent(new CustomEvent("cronos-announcements-changed"));
  };

  return (
    <section className="grid gap-4 pb-28">
      <div
        className="grid gap-2.5 p-3.5"
        style={{
          borderRadius: RADIUS.surface,
          backgroundColor: SURFACE.l1,
          border: `1px solid ${GLASS.border}`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone size={17} style={{ color: ACCENT.text }} aria-hidden="true" />
            <h2 className="text-base font-bold text-white">Avisos del Gym</h2>
          </div>
          <button
            type="button"
            onClick={resetCache}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-white"
            style={{
              backgroundColor: GLASS.fillRaised,
              border: `1px solid ${GLASS.border}`,
            }}
          >
            <Trash2 size={13} aria-hidden="true" />
            Limpiar duplicados / caché
          </button>
        </div>

        <label className="grid gap-1">
          <span className="text-xs font-medium" style={{ color: TEXT.secondary }}>
            Título del aviso
          </span>
          <input
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Horario especial de puente"
          />
        </label>

        {/* Bento Row: Tipo de aviso + Fijar en /hoy en 2 columnas */}
        <div className="grid grid-cols-2 gap-2.5">
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              Tipo de aviso
            </span>
            <select
              className={field}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="info">Aviso</option>
              <option value="event">Evento</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <div className="flex min-w-0 items-end">
            <label
              className="flex min-h-[42px] w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl px-3 text-xs font-semibold"
              style={{
                backgroundColor: pinned ? ACCENT.subtle : GLASS.fill,
                border: `1px solid ${pinned ? ACCENT.border : GLASS.border}`,
                color: pinned ? TEXT.primary : TEXT.secondary,
              }}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Pin size={13} aria-hidden="true" /> Fijar en /hoy
              </span>
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
            </label>
          </div>
        </div>

        {/* Bento Row compacta: URL de imagen + Subir imagen */}
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              URL de imagen (opcional)
            </span>
            <input
              className={field}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…/aviso.jpg"
            />
          </label>
          <label
            className="inline-flex min-h-[42px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white"
            style={{
              backgroundColor: GLASS.fillRaised,
              border: `1px solid ${GLASS.border}`,
            }}
          >
            <ImagePlus size={15} aria-hidden="true" />
            Subir imagen
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void compressImage(file).then(setImageUrl);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Vista previa del aviso"
            className="max-h-36 w-full rounded-xl border border-white/10 object-cover"
          />
        ) : null}

        <label className="grid gap-1">
          <span className="text-xs font-medium" style={{ color: TEXT.secondary }}>
            Mensaje del aviso
          </span>
          <textarea
            className="min-h-20 w-full rounded-xl border border-white/10 bg-zinc-800/80 p-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/25"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Detalles para toda la comunidad Cronos..."
          />
        </label>

        <button
          type="button"
          className="min-h-[44px] w-full rounded-xl px-4 text-sm font-bold text-white"
          style={{ backgroundColor: ACCENT.base }}
          onClick={() => void publish()}
        >
          Publicar Aviso en el Gym
        </button>

        {status ? (
          <p className="text-xs font-medium" style={{ color: STATUS.success.text }} role="status">
            {status}
          </p>
        ) : null}
      </div>

      <div
        className="divide-y divide-white/10"
        style={{
          borderRadius: RADIUS.surface,
          backgroundColor: SURFACE.l1,
          border: `1px solid ${GLASS.border}`,
        }}
      >
        {items.map((item) => (
          <article key={item.id} className="grid gap-2 p-3.5">
            {item.imageUrl ?? item.image_url ? (
              <img
                src={item.imageUrl ?? item.image_url}
                alt=""
                className="max-h-40 w-full rounded-xl object-cover"
              />
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <strong className="truncate text-sm text-white">{item.title}</strong>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: GLASS.fill,
                  color: TEXT.secondary,
                }}
              >
                {item.category ?? "info"}
              </span>
            </div>
            <p className="text-sm" style={{ color: TEXT.secondary }}>
              {item.body ?? item.message}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-[38px] rounded-xl px-3 text-xs font-medium text-white"
                style={{
                  backgroundColor: GLASS.fillRaised,
                  border: `1px solid ${GLASS.border}`,
                }}
                onClick={() => void update(item.id, { pinned: !item.pinned })}
              >
                {item.pinned ? "Desfijar" : "Fijar"}
              </button>
              <button
                type="button"
                className="min-h-[38px] rounded-xl px-3 text-xs font-medium text-white"
                style={{
                  backgroundColor: GLASS.fillRaised,
                  border: `1px solid ${GLASS.border}`,
                }}
                onClick={() => void update(item.id, { active: item.active === false })}
              >
                {item.active === false ? "Activar" : "Ocultar"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
