import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Minus, Package, Plus, ShoppingBag, Ticket as TicketIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/image/compressImage";
import { ACCENT, GLASS, RADIUS, STATUS, SURFACE, TEXT } from "@/design/tokens";
import {
  findStoreMeta,
  readLocalProducts,
  saveLocalProduct,
  saveStoreMeta,
  type LocalProduct,
} from "@/lib/gymClubMetadata";
import type { Database, PurchaseTicketRow } from "@/types/supabase";

type Product = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price_cents: number;
  stock: number;
  image_path?: string;
  is_active?: boolean;
};

type TicketStatus = Database["public"]["Enums"]["purchase_ticket_status"];

const CATEGORY_LABELS: Record<string, string> = {
  supplements: "Suplementos",
  accessories: "Accesorios",
  clothing: "Ropa",
  other: "Otros",
};

const field =
  "min-h-[42px] w-full min-w-0 rounded-xl border border-white/10 bg-zinc-800/80 px-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/25";

export function StoreManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [tickets, setTickets] = useState<PurchaseTicketRow[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("supplements");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [image, setImage] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("purchase_tickets").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    const remote: Product[] = (p.data ?? []).map((item) => {
      const meta = findStoreMeta(item.id, item.name);
      return {
        id: item.id,
        name: item.name,
        description: item.description ?? undefined,
        category: item.description ?? meta?.category,
        price_cents: Math.round(Number(item.price ?? 0) * 100),
        stock: Number(item.stock ?? 0),
        image_path: item.image_url ?? meta?.imageUrl,
        is_active: Boolean(item.is_active ?? true),
      };
    });
    const local = readLocalProducts();
    setProducts([
      ...remote,
      ...local.filter((item) => !remote.some((current) => current.id === item.id)),
    ]);
    setTickets(t.data ?? []);
  }, []);

  useEffect(() => {
    void load();
    if (typeof (supabase as { channel?: unknown }).channel !== "function") return;
    const channel = supabase
      .channel("cronos-store-tickets-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchase_tickets" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      setStatus("Escribe un nombre para el producto.");
      return;
    }
    const priceMxn = Math.max(0, Number(price || 0));
    const priceCents = Math.round(priceMxn * 100);
    const parsedStock = Math.max(0, Number(stock) || 0);
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: name.trim(),
        description: category,
        price: priceMxn,
        stock: parsedStock,
        image_url: image || null,
        is_active: true,
      })
      .select("id")
      .single();

    const product: LocalProduct = {
      id: String(data?.id ?? `local-product-${Date.now()}`),
      name: name.trim(),
      category,
      price_cents: priceCents,
      stock: parsedStock,
      image_path: image || undefined,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    saveStoreMeta([product.id, product.name], { imageUrl: image || undefined, category });
    if (error) saveLocalProduct(product);
    setProducts((current) => [product, ...current]);
    setStatus(
      error ? "Producto guardado localmente y publicado en la tienda." : "Producto añadido a la tienda.",
    );
    setName("");
    setPrice("");
    setStock("0");
    setImage("");
    if (!error) await load();
  };

  const adjustStock = async (productId: string, delta: number) => {
    const currentProd = products.find((p) => p.id === productId);
    if (!currentProd) return;
    const nextStock = Math.max(0, currentProd.stock + delta);
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, stock: nextStock } : p)));
    await supabase.from("products").update({ stock: nextStock }).eq("id", productId);
  };

  const ticket = async (id: string, value: TicketStatus) => {
    const currentTicket = tickets.find((t) => t.id === id);
    await supabase.from("purchase_tickets").update({ status: value }).eq("id", id);

    if (
      currentTicket &&
      (value === "paid" || value === "delivered") &&
      currentTicket.status === "pending"
    ) {
      const targetProduct = products.find((p) => p.id === currentTicket.product_id);
      if (targetProduct) {
        const decremented = Math.max(0, targetProduct.stock - (currentTicket.quantity || 1));
        await supabase
          .from("products")
          .update({ stock: decremented })
          .eq("id", targetProduct.id);
      }
    }
    await load();
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
          <ShoppingBag size={18} style={{ color: ACCENT.text }} aria-hidden="true" />
          <h2 className="text-base font-bold text-white">Tienda del Gym</h2>
        </div>

        <label className="grid gap-1">
          <span className="text-xs font-medium" style={{ color: TEXT.secondary }}>
            Nombre del producto
          </span>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Proteína Isolate 2 lb"
          />
        </label>

        <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-3">
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              Categoría
            </span>
            <select
              className={field}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="supplements">Suplementos</option>
              <option value="accessories">Accesorios</option>
              <option value="clothing">Ropa</option>
              <option value="other">Otros</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              Precio (MXN)
            </span>
            <input
              className={field}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="890"
              inputMode="decimal"
            />
          </label>
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              Stock disp.
            </span>
            <input
              className={field}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="15"
              inputMode="numeric"
            />
          </label>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
              Imagen del producto (URL opcional)
            </span>
            <input
              className={field}
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://…/producto.jpg"
            />
          </label>
          <label
            className="inline-flex min-h-[42px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white"
            style={{
              backgroundColor: GLASS.fillRaised,
              border: `1px solid ${GLASS.border}`,
            }}
          >
            <ImagePlus size={15} aria-hidden="true" />
            Subir foto
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void compressImage(file).then(setImage);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {image ? (
          <img
            src={image}
            alt="Vista previa del producto"
            className="h-20 w-20 rounded-xl border border-white/10 object-cover"
          />
        ) : null}

        <button
          type="button"
          onClick={() => void create()}
          className="min-h-[44px] w-full rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: ACCENT.base }}
        >
          Añadir producto a la tienda
        </button>

        {status ? (
          <p className="text-xs font-medium" style={{ color: STATUS.success.text }} role="status">
            {status}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {products.map((product) => (
          <article
            key={product.id}
            className="flex items-center gap-3 p-3"
            style={{
              borderRadius: RADIUS.surface,
              backgroundColor: SURFACE.l1,
              border: `1px solid ${GLASS.border}`,
            }}
          >
            {product.image_path ? (
              <img
                src={product.image_path}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
              >
                <Package size={20} style={{ color: TEXT.secondary }} aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: GLASS.fillRaised, color: TEXT.secondary }}
                >
                  {CATEGORY_LABELS[product.category ?? "other"] ?? product.category ?? "Tienda"}
                </span>
              </div>
              <strong className="mt-1 block truncate text-sm text-white">{product.name}</strong>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span
                  className="font-mono text-xs tabular-nums"
                  style={{ color: product.stock === 0 ? ACCENT.text : TEXT.secondary }}
                >
                  ${(product.price_cents / 100).toFixed(2)} · Stock {product.stock}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Reducir stock de ${product.name}`}
                    onClick={() => void adjustStock(product.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
                  >
                    <Minus size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Aumentar stock de ${product.name}`}
                    onClick={() => void adjustStock(product.id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TicketIcon size={16} style={{ color: TEXT.secondary }} aria-hidden="true" />
            <h3 className="text-sm font-bold text-white">Tickets de compra recibidos</h3>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ backgroundColor: STATUS.success.muted, color: STATUS.success.text }}
          >
            EN VIVO
          </span>
        </div>
        {tickets.length === 0 ? (
          <p className="text-xs" style={{ color: TEXT.tertiary }}>
            Sin reservas de tienda recientes.
          </p>
        ) : (
          tickets.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
              style={{
                borderRadius: RADIUS.surface,
                backgroundColor: SURFACE.l1,
                border: `1px solid ${GLASS.border}`,
              }}
            >
              <span
                className="font-mono text-xs tabular-nums"
                style={{ color: TEXT.secondary }}
              >
                {item.ticket_number} · ${(item.total_cents / 100).toFixed(2)} ·{" "}
                <strong className="text-white">{item.status}</strong>
              </span>
              {item.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="min-h-[38px] rounded-xl px-3 text-xs font-medium text-white"
                    style={{
                      backgroundColor: GLASS.fillRaised,
                      border: `1px solid ${GLASS.border}`,
                    }}
                    onClick={() => void ticket(item.id, "cancelled")}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="min-h-[38px] rounded-xl px-3 text-xs font-bold"
                    style={{
                      backgroundColor: STATUS.success.base,
                      color: TEXT.onAccent,
                    }}
                    onClick={() => void ticket(item.id, "delivered")}
                  >
                    Confirmar pago y entregar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
