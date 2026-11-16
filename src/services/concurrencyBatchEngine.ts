/**
 * concurrencyBatchEngine.ts — High-concurrency optimistic storage & batch sync.
 *
 * Designed for 30–100+ simultaneous gym members during peak hours:
 * - Every set/weight/RIR tap writes in 0ms to IndexedDB with an idempotent
 *   `client_mutation_id` (UUID).
 * - Mutations are debounced (15s) and flushed in a single batch upsert on
 *   exercise switch, workout completion, or network reconnection.
 * - Caches the dynamic exercise catalog + equipment map by version in IndexedDB
 *   and multiplexes a single Realtime channel that pauses in background tabs.
 */

import { supabase } from "@lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Exercise } from "@/types/supabase";

const DB_NAME = "cronos_concurrency_v1";
const DB_VERSION = 1;
const STORE_MUTATIONS = "pending_mutations";
const STORE_CATALOG = "catalog_snapshot";
const BATCH_DEBOUNCE_MS = 15_000;

export interface PendingSetMutation {
  client_mutation_id: string;
  log_id: string;
  exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
  notes: string | null;
  queued_at: number;
}

export interface CatalogSnapshot {
  version: string;
  updatedAt: number;
  exercisesCount: number;
  exercises: Exercise[];
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
          db.createObjectStore(STORE_MUTATIONS, { keyPath: "client_mutation_id" });
        }
        if (!db.objectStoreNames.contains(STORE_CATALOG)) {
          db.createObjectStore(STORE_CATALOG, { keyPath: "version" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function generateMutationId(logId: string, exerciseId: string, setNumber: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mut-${logId}-${exerciseId}-${setNumber}-${Date.now()}`;
}

class ConcurrencyBatchEngine {
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private realtimeChannel: RealtimeChannel | null = null;
  private listenersBound = false;

  constructor() {
    this.bindLifecycleListeners();
  }

  private bindLifecycleListeners(): void {
    if (this.listenersBound || typeof window === "undefined") return;
    this.listenersBound = true;

    window.addEventListener("online", () => {
      void this.flushPendingSets();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.pauseRealtime();
      } else {
        void this.flushPendingSets();
      }
    });
  }

  /**
   * 0ms optimistic enqueue to IndexedDB with idempotent client_mutation_id.
   */
  async enqueueSetMutation(
    input: Omit<PendingSetMutation, "client_mutation_id" | "queued_at"> & {
      client_mutation_id?: string;
    },
  ): Promise<PendingSetMutation> {
    const record: PendingSetMutation = {
      ...input,
      client_mutation_id:
        input.client_mutation_id ??
        generateMutationId(input.log_id, input.exercise_id, input.set_number),
      queued_at: Date.now(),
    };

    const db = await openDb();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_MUTATIONS, "readwrite");
          tx.objectStore(STORE_MUTATIONS).put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
      db.close();
    }

    this.scheduleBatchFlush();
    return record;
  }

  scheduleBatchFlush(delayMs = BATCH_DEBOUNCE_MS): void {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushPendingSets();
    }, delayMs);
  }

  async listPendingMutations(): Promise<PendingSetMutation[]> {
    const db = await openDb();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_MUTATIONS, "readonly");
        const req = tx.objectStore(STORE_MUTATIONS).getAll();
        req.onsuccess = () => {
          db.close();
          resolve(Array.isArray(req.result) ? (req.result as PendingSetMutation[]) : []);
        };
        req.onerror = () => {
          db.close();
          resolve([]);
        };
      } catch {
        db.close();
        resolve([]);
      }
    });
  }

  /**
   * Sends all pending set mutations in one idempotent batch upsert.
   */
  async flushPendingSets(): Promise<{ flushed: number; error: string | null }> {
    if (this.flushing) return { flushed: 0, error: null };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { flushed: 0, error: "offline" };
    }

    const pending = await this.listPendingMutations();
    if (pending.length === 0) return { flushed: 0, error: null };

    this.flushing = true;
    try {
      // Deduplicate by (log_id, exercise_id, set_number), keeping latest queued_at
      const latestBySet = new Map<string, PendingSetMutation>();
      for (const item of pending) {
        const key = `${item.log_id}::${item.exercise_id}::${item.set_number}`;
        const prev = latestBySet.get(key);
        if (!prev || item.queued_at >= prev.queued_at) {
          latestBySet.set(key, item);
        }
      }

      const payload = Array.from(latestBySet.values()).map((m) => ({
        log_id: m.log_id,
        exercise_id: m.exercise_id,
        set_number: m.set_number,
        weight: m.weight,
        reps: m.reps,
        rpe: m.rpe,
        is_warmup: m.is_warmup,
        notes: m.notes,
      }));

      const { error } = await supabase
        .from("completed_sets")
        .upsert(payload, { onConflict: "log_id,exercise_id,set_number" });

      if (error) {
        return { flushed: 0, error: error.message };
      }

      const db = await openDb();
      if (db) {
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(STORE_MUTATIONS, "readwrite");
            const store = tx.objectStore(STORE_MUTATIONS);
            for (const m of pending) store.delete(m.client_mutation_id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
        db.close();
      }

      return { flushed: payload.length, error: null };
    } catch (err) {
      return {
        flushed: 0,
        error: err instanceof Error ? err.message : "batch_flush_failed",
      };
    } finally {
      this.flushing = false;
    }
  }

  async cacheCatalogSnapshot(version: string, exercises: Exercise[]): Promise<void> {
    const db = await openDb();
    if (!db) return;
    const snap: CatalogSnapshot = {
      version,
      updatedAt: Date.now(),
      exercisesCount: exercises.length,
      exercises,
    };
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_CATALOG, "readwrite");
        tx.objectStore(STORE_CATALOG).put(snap);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    db.close();
  }

  async readCatalogSnapshot(version: string): Promise<CatalogSnapshot | null> {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_CATALOG, "readonly");
        const req = tx.objectStore(STORE_CATALOG).get(version);
        req.onsuccess = () => {
          db.close();
          resolve((req.result as CatalogSnapshot | undefined) ?? null);
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

  /**
   * Single multiplexed Realtime channel that automatically pauses in background.
   */
  subscribeGymChannel(onEvent: (table: string, payload: unknown) => void): () => void {
    if (this.realtimeChannel) {
      void supabase.removeChannel(this.realtimeChannel);
    }

    const channel = supabase
      .channel("cronos-gym-multiplex")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        (p) => onEvent("announcements", p),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exercises" },
        (p) => onEvent("exercises", p),
      )
      .subscribe();

    this.realtimeChannel = channel;

    return () => {
      this.pauseRealtime();
    };
  }

  pauseRealtime(): void {
    if (this.realtimeChannel) {
      void supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}

export const concurrencyBatchEngine = new ConcurrencyBatchEngine();
