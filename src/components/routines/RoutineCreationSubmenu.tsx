import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ACCENT, TEXT } from "@/design/tokens";

export type RoutineSubmenuTab = "smart" | "architect" | "vip";

interface RoutineCreationSubmenuProps {
  hasVipOffer: boolean;
  renderSmart: (collapse: () => void) => ReactNode;
  renderArchitect: (collapse: () => void) => ReactNode;
  renderVip: (collapse: () => void) => ReactNode;
}

export function RoutineCreationSubmenu({
  hasVipOffer,
  renderSmart,
  renderArchitect,
  renderVip,
}: RoutineCreationSubmenuProps) {
  const [activeTab, setActiveTab] = useState<RoutineSubmenuTab | null>(null);

  const tabs: ReadonlyArray<{ id: RoutineSubmenuTab; label: string }> = hasVipOffer
    ? [
        { id: "smart", label: "Cronos Smart" },
        { id: "architect", label: "Arquitecto" },
        { id: "vip", label: "Coach VIP" },
      ]
    : [
        { id: "smart", label: "Cronos Smart" },
        { id: "architect", label: "Arquitecto" },
      ];

  const handleToggle = (id: RoutineSubmenuTab) => {
    setActiveTab((prev) => (prev === id ? null : id));
  };

  const collapse = () => setActiveTab(null);

  return (
    <div className="flex flex-col gap-3">
      {/* Compact 1-row Apple Segmented Bar (collapsed by default) */}
      <div
        role="tablist"
        aria-label="Herramientas de creación de rutinas"
        className="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] p-1"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleToggle(tab.id)}
              className="flex min-h-[42px] min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-xl px-1.5 text-[11px] font-semibold active:scale-[0.98] transition-all duration-150 sm:px-2.5 sm:text-xs"
              style={{
                backgroundColor: active ? ACCENT.base : "transparent",
                color: active ? "#FFFFFF" : TEXT.secondary,
              }}
            >
              <span className="truncate">{tab.label}</span>
              {active ? (
                <ChevronUp size={13} className="shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown size={13} className="shrink-0" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded panel */}
      {activeTab === "smart" && renderSmart(collapse)}
      {activeTab === "architect" && renderArchitect(collapse)}
      {activeTab === "vip" && hasVipOffer && renderVip(collapse)}
    </div>
  );
}
