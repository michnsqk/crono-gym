import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Package, ShoppingBag, Ticket as TicketIcon } from "lucide-react";
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

type Ticket = {
  id: string;
  ticket_number: string;
  total_cents: number;
  quantity: number;
  status: string;
  product_id: string;
};

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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("supplements");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [image, setImage] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, t] = await Promise.all([
      (supabase as any).from("products").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("purchase_tickets").select("*").order("created_at", { ascending: false }),
    ]);
    const remote = (p.data ?? []).map((item: Product) => {
      const meta = findStoreMeta(item.id, item.name);
      return { ...item, ...meta, image_path: item.image_path ?? meta?.imageUrl };
    });
    const local = readLocalProducts();
    setProducts([
      ...remote,
      ...local.filter((item) => !remote.some((current: Product) => current.id === item.id)),
    ]);
    setTickets(t.data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      setStatus("Escribe un nombre para el producto.");
      return;
    }
    const priceCents = Math.max(0, Math.round(Number(price || 0) * 100));
    const payload = {
      name: name.trim(),
      category,
      price_cents: priceCents,
      stock: Math.max(0, Number(stock) || 0),
      image_path: image || null,
    };
    const { data, error } = await (supabase as any)
      .from("products")
      .insert(payload)
      .select("id")
      .single();
    const product: LocalProduct = {
      id: String(data?.id ?? `local-product-${Date.now()}`),
      name: name.trim(),
      category,
      price_cents: priceCents,
      stock: payload.stock,
      image_path: image || undefined,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    saveStoreMeta([product.id, product.name], { imageUrl: image || undefined, category });
    saveLocalProduct(product);
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

  const ticket = async (id: string, value: string) => {
    await (supabase as any).from("purchase_tickets").update({ status: value }).eq("id", id);
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

        {/* Fila Bento de 3 columnas: Categoría + Precio (MXN) + Stock disponible */}
        <div className="grid grid-cols-3 gap-2">
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

        {/* Fila compacta de imagen */}
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

      {/* Apple Store Card Grid */}
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
              <span
                className="mt-0.5 block font-mono text-xs tabular-nums"
                style={{ color: TEXT.secondary }}
              >
                ${(product.price_cents / 100).toFixed(2)} MXN · Stock {product.stock}
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <TicketIcon size={16} style={{ color: TEXT.secondary }} aria-hidden="true" />
          <h3 className="text-sm font-bold text-white">Tickets de compra recibidos</h3>
        </div>
        {tickets.map((item) => (
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
              {item.ticket_number} · ${(item.total_cents / 100).toFixed(2)} · {item.status}
            </span>
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
          </div>
        ))}
      </div>
    </section>
  );
}
