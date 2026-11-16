import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Zap,
  TrendingUp,
} from "lucide-react";
import { useActiveSession } from "@/context/ActiveSessionContext";
import {
  ACCENT,
  MOTION,
  RADIUS,
  SPACE,
  SURFACE,
  TEXT,
  Z_INDEX,
} from "@/design/tokens";
import { NAV_LABELS } from "@/lib/i18n";
import {
  HOME_PATH,
  ROUTINES_PATH,
  TRAIN_PATH,
  PROGRESS_PATH,
  RANGES_PATH,
} from "@/components/shell/navItems";

type NavItem = {
  id: string;
  path: string;
  label: string;
  ariaLabel: string;
  icon: typeof Home;
  primary?: boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", path: HOME_PATH, label: NAV_LABELS.home, ariaLabel: NAV_LABELS.home, icon: Home },
  { id: "routines", path: ROUTINES_PATH, label: NAV_LABELS.routines, ariaLabel: NAV_LABELS.routines, icon: Zap, primary: true },
  { id: "progress", path: PROGRESS_PATH, label: NAV_LABELS.progress, ariaLabel: NAV_LABELS.progress, icon: TrendingUp },
];

function isActivePath(pathname: string, itemPath: string) {
  return pathname === itemPath || pathname.startsWith(itemPath + "/");
}

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useActiveSession();

  const pathname = location.pathname;

  const go = (path: string) => {
    navigate(path);
  };

  const handleTrain = () => {
    if (session) {
      navigate(TRAIN_PATH);
    } else {
      navigate(ROUTINES_PATH);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        insetInline: 0,
        zIndex: Z_INDEX.nav ?? 40,
        pointerEvents: "none",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      className="md:hidden"
    >
      <nav
        aria-label="Navegación principal"
        style={{ pointerEvents: "auto", marginInline: SPACE.md, marginBottom: SPACE.md }}
      >
        <div
          className="backdrop-blur-xl bg-black/70 border-t border-white/10"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            borderRadius: RADIUS.pill,
            padding: `${SPACE.xs} ${SPACE.sm}`,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active =
              item.path === PROGRESS_PATH
                ? pathname === PROGRESS_PATH ||
                  pathname === RANGES_PATH ||
                  pathname.startsWith(RANGES_PATH + "/")
                : isActivePath(pathname, item.path);
            const Icon = item.icon;
            if (item.primary) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={handleTrain}
                  aria-label={session ? NAV_LABELS.continueTraining : NAV_LABELS.train}
                  style={{
                    position: "relative",
                    top: -20,
                    height: 56,
                    width: 56,
                    borderRadius: RADIUS.pill,
                    border: `2px solid ${SURFACE.base}`,
                    background: ACCENT.base,
                    color: TEXT.onAccent,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 8px 24px ${ACCENT.base}55`,
                    cursor: "pointer",
                  }}
                >
                  <Zap size={24} aria-hidden="true" fill="currentColor" />
                </button>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.path)}
                aria-current={active ? "page" : undefined}
                className="text-[10px]"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  minHeight: MOTION.minTouchTarget,
                  padding: `${SPACE.xs} ${SPACE.sm}`,
                  color: active ? ACCENT.base : TEXT.tertiary,
                  fontWeight: active ? 600 : 400,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
