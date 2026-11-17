import { startTransition, useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  findClassMeta,
  findStoreMeta,
  readLocalClasses,
  readLocalProducts,
} from "@/lib/gymClubMetadata";
import { recordDemandIntent } from "@/services/gymOperationsService";

type Product = {
  id: string;
  name: string;
  category?: string;
  price_cents: number;
  stock: number;
  image_path?: string;
};
type GymClass = {
  id: string;
  name: string;
  instructor?: string;
  capacity: number;
  price_cents?: number;
  description?: string;
};
type Schedule = { class_id: string; day_of_week: number; start_time: string };
const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Helper for tables not yet typed in generated Supabase types
function dynamicFrom(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}

export function GymClubHubSection({
  userId,
  compactPreview = false,
  onViewAll,
}: {
  userId: string;
  compactPreview?: boolean;
  onViewAll?: () => void;
}) {
  const [tab, setTab] = useState<"store" | "classes">("store");
  const [products, setProducts] = useState<Product[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [subscribed, setSubscribed] = useState<string[]>([]);
  const [ticket, setTicket] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, c, s] = await Promise.all([
      dynamicFrom("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      dynamicFrom("gym_classes").select("*").eq("is_active", true),
      dynamicFrom("gym_schedules").select("*"),
    ]);

    const remoteProducts = ((p.data ?? []) as Product[]).map((item) => {
      const meta = findStoreMeta(item.id, item.name);
      return { ...item, ...meta, image_path: item.image_path ?? meta?.imageUrl };
    });
    const remoteClasses = ((c.data ?? []) as GymClass[]).map((item) => {
      const meta = findClassMeta(item.id, item.name);
      return { ...item, ...meta, price_cents: meta?.priceCents ?? item.price_cents };
    });
    const localProducts = readLocalProducts();
    const localClasses = readLocalClasses();

    startTransition(() => {
      setProducts([
        ...remoteProducts,
        ...localProducts.filter((item) => !remoteProducts.some((cur) => cur.id === item.id)),
      ]);
      setClasses([
        ...remoteClasses,
        ...localClasses.filter((item) => !remoteClasses.some((cur) => cur.id === item.id)),
      ]);
      setSchedules((s.data ?? []) as Schedule[]);
    });
    try {
      setSubscribed(
        JSON.parse(localStorage.getItem(`cronos-class-subscriptions:${userId}`) ?? "[]") as string[],
      );
    } catch {
      setSubscribed([]);
    }
  }, [userId]);

  useEffect(() => {
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(() => {
        void load();
      }, { timeout: 1200 });
    } else {
      timeoutId = setTimeout(() => {
        void load();
      }, 1200);
    }
    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [load]);

  const reserve = async (product: Product) => {
    const ticketNumber = `CRN-${Math.floor(100 + Math.random() * 900)}`;
    void recordDemandIntent("store", product.id, product.name, userId);
    const { error } = await dynamicFrom("purchase_tickets").insert({
      ticket_number: ticketNumber,
      user_id: userId,
      product_id: product.id,
      quantity: 1,
      unit_price_cents: product.price_cents,
      total_cents: product.price_cents,
      status: "pending",
    });
    if (!error) setTicket(ticketNumber);
  };

  const subscribe = (item: GymClass) => {
    const next = [...new Set([...subscribed, item.id])];
    setSubscribed(next);
    localStorage.setItem(`cronos-class-subscriptions:${userId}`, JSON.stringify(next));
    void recordDemandIntent("class", item.id, item.name, userId);
  };

  if (compactPreview) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Tienda del Gym
            </p>
            <h2 className="text-base font-bold text-white">Productos disponibles</h2>
          </div>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-[#FF3B30] active:scale-[0.98] transition-transform duration-150"
            >
              <span>Ver todos</span>
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        {ticket && (
          <p className="mb-3 rounded-xl bg-[#30D158]/15 p-3 font-mono text-xs text-[#30D158]">
            Ticket #{ticket} · muestra este folio en recepción
          </p>
        )}

        {products.length === 0 ? (
          <p className="text-xs text-zinc-400">
            Consulta suplementos, bebidas y accesorios directamente en recepción.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {products.slice(0, 6).map((product) => (
              <article
                key={product.id}
                className="flex w-52 shrink-0 flex-col justify-between rounded-xl bg-[#2C2C2E] p-3"
              >
                <div>
                  {product.image_path && (
                    <img
                      src={product.image_path}
                      alt=""
                      className="mb-2 h-24 w-full rounded-lg object-cover"
                    />
                  )}
                  <strong className="block truncate text-sm text-white">{product.name}</strong>
                  <span className="mt-0.5 block font-mono text-xs text-zinc-400">
                    ${(product.price_cents / 100).toFixed(2)} MXN
                  </span>
                </div>
                <button
                  type="button"
                  disabled={product.stock < 1}
                  onClick={() => void reserve(product)}
                  className="mt-3 h-11 w-full rounded-xl bg-[#FF3B30] px-3 text-xs font-semibold text-white active:scale-[0.98] disabled:opacity-40"
                >
                  Apartar en recepción
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-white/10 bg-[#1C1C1E] p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Gym Club</p>
        <h2 className="text-base font-bold text-white">Clases y Tienda Oficial</h2>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#2C2C2E] p-1">
        <button
          type="button"
          className={`h-11 rounded-lg text-xs font-semibold ${tab === "store" ? "bg-[#FF3B30] text-white" : "text-zinc-400"}`}
          onClick={() => setTab("store")}
        >
          Tienda del Gym
        </button>
        <button
          type="button"
          className={`h-11 rounded-lg text-xs font-semibold ${tab === "classes" ? "bg-[#FF3B30] text-white" : "text-zinc-400"}`}
          onClick={() => setTab("classes")}
        >
          Clases Disponibles
        </button>
      </div>
      {ticket ? (
        <p className="rounded-xl bg-[#30D158]/15 p-3 font-mono text-xs text-[#30D158]">
          Ticket #{ticket} · muestra este folio en recepción
        </p>
      ) : null}
      {tab === "store" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {products.map((product) => (
            <article key={product.id} className="flex gap-3 rounded-xl bg-[#2C2C2E] p-3">
              {product.image_path ? (
                <img src={product.image_path} alt="" className="h-16 w-16 rounded-xl object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-white">{product.name}</strong>
                <span className="font-mono text-xs text-zinc-400">
                  ${(product.price_cents / 100).toFixed(2)} MXN · {product.stock} disponibles
                </span>
                <button
                  type="button"
                  disabled={product.stock < 1}
                  className="mt-2 h-11 rounded-xl bg-[#FF3B30] px-3 text-xs font-semibold text-white disabled:opacity-40"
                  onClick={() => void reserve(product)}
                >
                  Apartar en recepción
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {classes.map((item) => {
            const active = subscribed.includes(item.id);
            return (
              <article key={item.id} className="rounded-xl bg-[#2C2C2E] p-3">
                <strong className="text-sm text-white">{item.name}</strong>
                <p className="text-xs text-zinc-400">
                  {item.instructor || "Instructor por confirmar"} ·{" "}
                  {item.price_cents ? `$${(item.price_cents / 100).toFixed(2)} MXN` : "Incluida"} ·{" "}
                  {item.capacity} cupos
                </p>
                {active ? (
                  <div className="mt-2 rounded-lg bg-[#30D158]/10 p-2 text-xs text-[#30D158]">
                    <strong>SUSCRITO · Tus horarios</strong>
                    <p className="mt-1">
                      {schedules
                        .filter((schedule) => schedule.class_id === item.id)
                        .map((schedule) => `${days[schedule.day_of_week]} ${schedule.start_time.slice(0, 5)}`)
                        .join(" · ") || "Horario por confirmar"}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mt-2 h-11 rounded-xl bg-[#FF3B30] px-3 text-xs font-semibold text-white"
                    onClick={() => subscribe(item)}
                  >
                    Suscribirme a esta clase
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
