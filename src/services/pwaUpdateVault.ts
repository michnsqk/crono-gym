/**
 * pwaUpdateVault.ts — Dual-layer UpdateSafeVault + silent OTA PWA updater.
 *
 * Guarantees zero data loss during Service Worker updates:
 * - Mirrors active workout session, rest timer target, and routine drafts into
 *   both `localStorage` (`cronos_emergency_vault_v1`) and IndexedDB.
 * - Listens for Service Worker updates and surfaces a discreet non-blocking
 *   update state so an athlete mid-workout can apply the update in ~1s and
 *   resume on the exact set and rest-timer second.
 */

import { useCallback, useEffect, useState } from "react";

export const EMERGENCY_VAULT_KEY = "cronos_emergency_vault_v1";
const VAULT_DB_NAME = "cronos_update_vault_v1";
const VAULT_STORE = "vault_records";

export interface VaultSnapshot {
  updatedAt: number;
  activeSessionJson: string | null;
  restTimerEndEpochMs: number | null;
  routineDraftsJson: string | null;
  currentPath: string;
}

function openVaultDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(VAULT_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(VAULT_STORE)) {
          db.createObjectStore(VAULT_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function sealEmergencyVault(partial?: Partial<VaultSnapshot>): Promise<VaultSnapshot> {
  const snapshot: VaultSnapshot = {
    updatedAt: Date.now(),
    activeSessionJson:
      partial?.activeSessionJson ??
      (typeof window !== "undefined" ? window.localStorage.getItem("cronos_active_session_v1") : null),
    restTimerEndEpochMs:
      partial?.restTimerEndEpochMs ??
      (() => {
        if (typeof window === "undefined") return null;
        const raw = window.localStorage.getItem("cronos_rest_timer_end_v1");
        const num = raw ? Number(raw) : NaN;
        return Number.isFinite(num) ? num : null;
      })(),
    routineDraftsJson:
      partial?.routineDraftsJson ??
      (typeof window !== "undefined" ? window.localStorage.getItem("cronos_routine_draft_v1") : null),
    currentPath:
      partial?.currentPath ??
      (typeof window !== "undefined" ? window.location.pathname : "/inicio"),
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(EMERGENCY_VAULT_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore quota errors; IndexedDB mirror below acts as secondary layer.
    }
  }

  const db = await openVaultDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(VAULT_STORE, "readwrite");
        tx.objectStore(VAULT_STORE).put({ id: "latest", ...snapshot });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    db.close();
  }

  return snapshot;
}

export async function restoreEmergencyVault(): Promise<VaultSnapshot | null> {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(EMERGENCY_VAULT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as VaultSnapshot;
        if (parsed.activeSessionJson && !window.localStorage.getItem("cronos_active_session_v1")) {
          window.localStorage.setItem("cronos_active_session_v1", parsed.activeSessionJson);
        }
        if (parsed.restTimerEndEpochMs && !window.localStorage.getItem("cronos_rest_timer_end_v1")) {
          window.localStorage.setItem("cronos_rest_timer_end_v1", String(parsed.restTimerEndEpochMs));
        }
        return parsed;
      }
    } catch {
      // Fall through to IndexedDB mirror.
    }
  }

  const db = await openVaultDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(VAULT_STORE, "readonly");
      const req = tx.objectStore(VAULT_STORE).get("latest");
      req.onsuccess = () => {
        db.close();
        resolve((req.result as VaultSnapshot | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export function usePwaUpdateVault() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let mounted = true;
    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!mounted || !reg) return;
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setUpdateReady(true);
      }
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(installing);
            setUpdateReady(true);
          }
        });
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  const applySafeUpdate = useCallback(async () => {
    await sealEmergencyVault();
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, [waitingWorker]);

  return {
    updateReady,
    applySafeUpdate,
    sealVault: sealEmergencyVault,
  };
}
