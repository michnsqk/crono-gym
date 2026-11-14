import { useCallback, useEffect, useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ACCENT, GLASS, RADIUS, STATUS, SURFACE, TEXT } from "@/design/tokens";
import {
  findClassMeta,
  readLocalClasses,
  saveClassMeta,
  saveLocalClass,
  type LocalGymClass,
} from "@/lib/gymClubMetadata";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const field =
  "min-h-[42px] w-full min-w-0 rounded-xl border border-white/10 bg-zinc-800/80 px-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/25";

type GymClass = {
  id: string;
  name: string;
  instructor?: string;
  capacity: number;
  price_cents?: number;
  description?: string;
};

type Schedule = {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
};

export function ClassesManager() {
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classId, setClassId] = useState("");
  const [name, setName] = useState("");
  const [instructor, setInstructor] = useState("");
  const [price, setPrice] = useState("0");
  const [capacity, setCapacity] = useState("20");
  const [durationMin, setDurationMin] = useState("60");
  const [day, setDay] = useState("1");
  const [time, setTime] = useState("18:00");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      (supabase as any).from("gym_classes").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("gym_schedules").select("*").order("day_of_week"),
    ]);
    const rows = (c.data ?? []).map((item: GymClass) => {
      const meta = findClassMeta(item.id, item.name);
      return { ...item, ...meta, price_cents: meta?.priceCents ?? item.price_cents };
    });
    const local = readLocalClasses();
    setClasses([
      ...rows,
      ...local.filter((item) => !rows.some((current: GymClass) => current.id === item.id)),
    ]);
    setSchedules(s.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createClass = async () => {
    if (!name.trim()) {
      setStatus("Escribe un nombre para la clase.");
      return;
    }
    const priceCents = Math.max(0, Math.round(Number(price || 0) * 100));
    const parsedCapacity = Number(capacity) || 20;
    const { data, error } = await (supabase as any)
      .from("gym_classes")
      .insert({
        name: name.trim(),
        instructor: instructor.trim() || null,
        capacity: parsedCapacity,
      })
      .select("id")
      .single();
    const classItem: LocalGymClass = {
      id: String(data?.id ?? `local-class-${Date.now()}`),
      name: name.trim(),
      instructor: instructor.trim() || undefined,
      capacity: parsedCapacity,
      price_cents: priceCents,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    saveClassMeta([classItem.id, classItem.name], { priceCents });
    saveLocalClass(classItem);
    setClasses((current) => [classItem, ...current]);
    setStatus(error ? "Clase guardada localmente y publicada en Clases." : "Clase creada.");
    setName("");
    setInstructor("");
    setPrice("0");
    if (!error) await load();
  };

  const addSchedule = async () => {
    if (!classId) {
      setStatus("Selecciona una clase primero.");
      return;
    }
    const { error } = await (supabase as any)
      .from("gym_schedules")
      .insert({ class_id: classId, day_of_week: Number(day), start_time: `${time}:00` });
    setStatus(error ? "No se pudo añadir el horario." : "Horario añadido.");
    if (!error) await load();
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
        <div className="flex items-center gap-2">
          <Calendar size={18} style={{ color: ACCENT.text }} aria-hidden="true" />
          <h2 className="text-base font-bold text-white">Clases y horarios</h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              Nombre de la clase
            </span>
            <input
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mobility & Core"
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              Instructor
            </span>
            <input
              className={field}
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="Coach Carlos"
            />
          </label>
        </div>

        {/* Fila Bento de 3 columnas: Precio (MXN), Cupo máximo y Duración (min) */}
        <div className="grid grid-cols-3 gap-2">
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              Precio (MXN)
            </span>
            <input
              className={field}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              inputMode="decimal"
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              Cupo máx.
            </span>
            <input
              className={field}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="20"
              inputMode="numeric"
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              Duración (min)
            </span>
            <input
              className={field}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              placeholder="60"
              inputMode="numeric"
            />
          </label>
        </div>

        <button
          type="button"
          className="min-h-[44px] w-full rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: ACCENT.base }}
          onClick={() => void createClass()}
        >
          Crear clase
        </button>

        {/* Bloque de horarios: Clase arriba y Día + Hora en grid-cols-2 */}
        <div className="mt-1 grid gap-2 border-t border-white/10 pt-3">
          <label className="grid gap-1">
            <span className="text-xs font-medium" style={{ color: TEXT.secondary }}>
              Clase a programar
            </span>
            <select
              className={field}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Selecciona una clase...</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid min-w-0 gap-1">
              <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
                Día
              </span>
              <select className={field} value={day} onChange={(e) => setDay(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 0].map((value) => (
                  <option key={value} value={value}>
                    {DAYS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1">
              <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
                Hora de inicio
              </span>
              <input
                className={field}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white"
          style={{
            backgroundColor: GLASS.fillRaised,
            border: `1px solid ${GLASS.border}`,
          }}
          onClick={() => void addSchedule()}
        >
          <Clock size={15} aria-hidden="true" /> Añadir horario
        </button>

        {status ? (
          <p className="text-xs font-medium" style={{ color: STATUS.success.text }} role="status">
            {status}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2.5">
        {classes.map((item) => (
          <article
            key={item.id}
            className="p-3.5"
            style={{
              borderRadius: RADIUS.surface,
              backgroundColor: SURFACE.l1,
              border: `1px solid ${GLASS.border}`,
            }}
          >
            <strong className="text-sm text-white">{item.name}</strong>
            <p className="mt-0.5 text-xs" style={{ color: TEXT.secondary }}>
              {item.instructor || "Instructor por confirmar"} ·{" "}
              {item.price_cents ? `$${(item.price_cents / 100).toFixed(2)} MXN` : "Incluida"} ·{" "}
              {item.capacity} cupos
            </p>
            <p className="mt-2 font-mono text-xs tabular-nums" style={{ color: TEXT.primary }}>
              {schedules
                .filter((schedule) => schedule.class_id === item.id)
                .map((schedule) => `${DAYS[schedule.day_of_week]} ${schedule.start_time.slice(0, 5)}`)
                .join(" · ") || "Sin horarios"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
