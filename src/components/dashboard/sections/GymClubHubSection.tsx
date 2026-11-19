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
import {
  bookClassSeat,
  cancelClassSeat,
  getClassSeatCounts,
  listUserClassBookings,
} from "@/services/attendanceAndClubService";
import { useProfile } from "@/hooks/useProfile";
import type { ClassBookingRow, PurchaseTicketRow } from "@/types/supabase";

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
  day_of_week?: string;
  start_time?: string;
};
type Schedule = { id: string; class_id: string; day_of_week: number; start_time: string };
const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function GymClubHubSection({
  userId,
  compactPreview = false,
  onViewAll,
}: {
  userId: string;
  compactPreview?: boolean;
  onViewAll?: () => void;
}) {
  const { profile } = useProfile(userId);
  const [tab, setTab] = useState<"store" | "classes">("store");
  const [products, setProducts] = useState<Product[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({});
  const [bookings, setBookings] = useState<ClassBookingRow[]>([]);
  const [myTickets, setMyTickets] = useState<PurchaseTicketRow[]>([]);
  const [ticket, setTicket] = useState<string | null>(null);
  const [bookingMsg, setBookingMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, c, s, seats, userBookings, userTickets] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("gym_classes").select("*").eq("is_active", true),
      supabase.from("gym_schedules").select("*"),
      getClassSeatCounts(),
      listUserClassBookings(userId),
      supabase
        .from("purchase_tickets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

    const remoteProducts: Product[] = (p.data ?? []).map((item) => {
      const meta = findStoreMeta(item.id, item.name);
      return {
        id: item.id,
        name: item.name,
        category: item.description ?? meta?.category,
        price_cents: Math.round(Number(item.price ?? 0) * 100),
        stock: Number(item.stock ?? 0),
        ...meta,
        image_path: item.image_url ?? meta?.imageUrl,
      };
    });
    const remoteClasses: GymClass[] = (c.data ?? []).map((item) => {
      const meta = findClassMeta(item.id, item.title);
      return {
        id: item.id,
        name: item.title,
        instructor: item.instructor ?? undefined,
        capacity: Number(item.capacity ?? 20),
        day_of_week: item.day_of_week,
        start_time: item.start_time,
        ...meta,
        price_cents: meta?.priceCents,
      };
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
      setSeatCounts(seats);
      setBookings(userBookings);
      setMyTickets(userTickets.data ?? []);
    });
  }, [userId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [load]);

  const reserve = async (product: Product) => {
    const ticketNumber = `CRN-${Math.floor(100 + Math.random() * 900)}`;
    void recordDemandIntent("store", product.id, product.name, userId);
    const { error } = await supabase.from("purchase_tickets").insert({
      ticket_number: ticketNumber,
      user_id: userId,
      product_id: product.id,
      quantity: 1,
      unit_price_cents: product.price_cents,
      total_cents: product.price_cents,
      status: "pending",
    });
    if (!error) {
      setTicket(ticketNumber);
      void load();
    }
  };

  const bookClass = async (item: GymClass) => {
    setBookingMsg(null);
    void recordDemandIntent("class", item.id, item.name, userId);
    const firstSchedule = schedules.find((s) => s.class_id === item.id);
    const res = await bookClassSeat({
      classId: item.id,
      scheduleId: firstSchedule?.id ?? null,
      athleteName: profile?.display_name || "Atleta Cronos",
    });
    if (res.ok) {
      setBookingMsg(`¡Lugar apartado en ${item.name}!`);
      await load();
    } else {
      setBookingMsg(res.error || "No se pudo apartar tu lugar.");
    }
  };

  const cancelBooking = async (bookingId: string) => {
    const ok = await cancelClassSeat(bookingId);
    if (ok) {
      setBookingMsg("Reserva cancelada.");
      await load();
    }
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
              className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-[#FF3B30] transition-transform duration-150 active:scale-[0.98]"
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
                    ${(product.price_cents / 100).toFixed(2)} MXN · {product.stock} disp.
                  </span>
                </div>
                <button
                  type="button"
                  disabled={product.stock < 1}
                  onClick={() => void reserve(product)}
                  className="mt-3 h-11 w-full rounded-xl bg-[#FF3B30] px-3 text-xs font-semibold text-white active:scale-[0.98] disabled:opacity-40"
                >
                  {product.stock < 1 ? "Agotado" : "Apartar en recepción"}
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
      {bookingMsg ? (
        <p className="rounded-xl bg-white/10 p-3 text-xs font-semibold text-white">{bookingMsg}</p>
      ) : null}

      {tab === "store" ? (
        <div className="space-y-3">
          {myTickets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {myTickets.slice(0, 3).map((t) => (
                <span
                  key={t.id}
                  className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 font-mono text-[11px] text-zinc-300"
                >
                  {t.ticket_number} · {t.status}
                </span>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {products.map((product) => (
              <article key={product.id} className="flex gap-3 rounded-xl bg-[#2C2C2E] p-3">
                {product.image_path ? (
                  <img
                    src={product.image_path}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover"
                  />
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
                    {product.stock < 1 ? "Agotado" : "Apartar en recepción"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {classes.map((item) => {
            const occupied = seatCounts[item.id] ?? 0;
            const remaining = Math.max(0, item.capacity - occupied);
            const myBooking = bookings.find((b) => b.class_id === item.id);
            const active = Boolean(myBooking);
            const classSchedules = schedules.filter((schedule) => schedule.class_id === item.id);
            const scheduleText =
              classSchedules
                .map((schedule) => `${days[schedule.day_of_week]} ${schedule.start_time.slice(0, 5)}`)
                .join(" · ") ||
              (item.day_of_week && item.start_time
                ? `${item.day_of_week} ${item.start_time}`
                : "Horario por confirmar");

            return (
              <article key={item.id} className="rounded-xl bg-[#2C2C2E] p-3">
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-sm text-white">{item.name}</strong>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      remaining === 0 ? "text-[#FF6961]" : "text-[#30D158]"
                    }`}
                  >
                    {remaining === 0 ? "Cupo lleno" : `${remaining}/${item.capacity} lugares`}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  {item.instructor || "Instructor por confirmar"} ·{" "}
                  {item.price_cents ? `$${(item.price_cents / 100).toFixed(2)} MXN` : "Incluida"} ·{" "}
                  {scheduleText}
                </p>
                {active && myBooking ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#30D158]/10 p-2 text-xs text-[#30D158]">
                    <strong>LUGAR APARTADO HOY</strong>
                    <button
                      type="button"
                      onClick={() => void cancelBooking(myBooking.id)}
                      className="rounded-lg bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white"
                    >
                      Liberar cupo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={remaining === 0}
                    className="mt-2 h-11 rounded-xl bg-[#FF3B30] px-3 text-xs font-semibold text-white disabled:opacity-40"
                    onClick={() => void bookClass(item)}
                  >
                    {remaining === 0 ? "Cupo agotado" : "Apartar lugar en recepción"}
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
