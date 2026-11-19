import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { EquipmentEntry } from "@/data/equipmentCatalog";
import { ACCENT, GLASS, RADIUS, SCRIM, SOLID, SPACE, SURFACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";
import { resolveMediaUrl } from "@/lib/media/mediaResolver";

export interface EquipmentInspectionSheetProps {
  equipment: EquipmentEntry;
  alternatives?: EquipmentEntry[];
  onClose: () => void;
  onSelect?: (equipment: EquipmentEntry) => void;
}

export function EquipmentInspectionSheet({
  equipment,
  alternatives = [],
  onClose,
  onSelect,
}: EquipmentInspectionSheetProps) {
  const [selected, setSelected] = useState<EquipmentEntry>(equipment);

  useEffect(() => {
    setSelected(equipment);
  }, [equipment]);

  return (
    <div
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
      }}
    >
      <div
        style={{
          position: "relative",
          width: "90vw",
          maxWidth: 560,
          maxHeight: "85vh",
          borderRadius: RADIUS.modal,
          background: SURFACE.base,
          border: `1px solid ${GLASS.borderStrong}`,
          boxShadow: GLASS.shadow,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${SPACE.md} ${SPACE.lg}`,
            borderBottom: `1px solid ${GLASS.border}`,
            background: SURFACE.base,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: TYPE.title2.size,
              fontWeight: TYPE.title2.weight,
              color: TEXT.primary,
            }}
          >
            {selected.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar inspección de equipo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: `1px solid ${GLASS.border}`,
              background: "transparent",
              color: TEXT.secondary,
              cursor: "pointer",
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: SPACE.md,
            display: "flex",
            flexDirection: "column",
            gap: SPACE.md,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: SPACE.sm,
            }}
          >
            {selected.views.map((view: { id: number; src: string }) => (
              <div
                key={view.id}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1",
                  background: SURFACE.raised,
                  borderRadius: RADIUS.surface,
                  border: `1px solid ${GLASS.border}`,
                  overflow: "hidden",
                }}
              >
                <img
                  src={resolveMediaUrl(view.src)}
                  alt={`Vista ${view.id} de ${selected.name}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE.xs,
              padding: `${SPACE.xs} ${SPACE.sm}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.card,
            }}
          >
            <span
              style={{
                fontSize: TYPE.label.size,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: TEXT.secondary,
              }}
            >
              Categoría
            </span>
            <span
              style={{
                fontSize: TYPE.caption.size,
                color: TEXT.primary,
                fontWeight: 600,
              }}
            >
              {selected.category}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE.xs,
              padding: `${SPACE.xs} ${SPACE.sm}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.card,
            }}
          >
            <span
              style={{
                fontSize: TYPE.label.size,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: TEXT.secondary,
              }}
            >
              ID
            </span>
            <span
              style={{
                fontFamily: TYPE.mono.font,
                fontSize: TYPE.caption.size,
                color: TEXT.primary,
              }}
            >
              {selected.id}
            </span>
          </div>

          {(alternatives.length > 0 ||
            equipment.id !== selected.id ||
            alternatives.some((a) => a.id === equipment.id)) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: SPACE.xs,
              }}
            >
              <span
                style={{
                  fontSize: TYPE.caption.size,
                  color: TEXT.secondary,
                  fontWeight: 600,
                }}
              >
                Máquinas compatibles
              </span>
              <div
                style={{
                  display: "flex",
                  gap: SPACE.xs,
                  overflowX: "auto",
                  paddingBottom: SPACE.xs,
                }}
              >
                {[equipment, ...alternatives]
                  .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setSelected(e);
                        onSelect?.(e);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: `${SPACE.xs} ${SPACE.sm}`,
                        borderRadius: RADIUS.control,
                        border: `1px solid ${e.id === selected.id ? ACCENT.base : GLASS.border}`,
                        background: e.id === selected.id ? ACCENT.subtle : SOLID.card,
                        cursor: "pointer",
                        minWidth: 80,
                      }}
                    >
                      {e.views?.[0] && (
                        <img
                          src={resolveMediaUrl(e.views[0].src)}
                          alt={e.name}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: TYPE.caption.size,
                          color: e.id === selected.id ? ACCENT.text : TEXT.primary,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 100,
                        }}
                      >
                        {e.id}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: SPACE.md,
              paddingTop: SPACE.md,
              borderTop: `1px solid ${GLASS.border}`,
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: TYPE.caption.size,
                color: TEXT.secondary,
                marginBottom: SPACE.xs,
                fontWeight: 600,
              }}
            >
              Notas del equipo
            </label>
            <textarea
              style={{
                width: "100%",
                minHeight: 80,
                padding: "8px 12px",
                borderRadius: RADIUS.input,
                border: `1px solid ${GLASS.border}`,
                background: SOLID.card,
                color: TEXT.primary,
                fontSize: TYPE.body.size,
                fontFamily: TYPE.mono.font,
                resize: "vertical",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
