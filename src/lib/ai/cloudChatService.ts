import { supabase } from "@lib/supabase";
import type { CronosChatThread } from "@/lib/ai/cronosIntelligence";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Loads the athlete's persisted Cronos IA sessions & messages from Supabase.
 * Silently returns `[]` when unauthenticated or when running under partial test mocks.
 */
export async function loadCloudChatThreads(userId: string): Promise<CronosChatThread[]> {
  if (!isValidUuid(userId) || typeof supabase.from !== "function") return [];
  try {
    const { data: sessions, error: sessionsErr } = await supabase
      .from("chat_sessions")
      .select("id,title,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (sessionsErr || !Array.isArray(sessions) || sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map((s) => s.id);
    const { data: rows, error: msgErr } = await supabase
      .from("chat_messages")
      .select("id,session_id,role,content,created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

    if (msgErr || !Array.isArray(rows)) return [];

    const bySession = new Map<string, CronosChatThread["messages"]>();
    for (const row of rows) {
      if (row.role !== "user" && row.role !== "assistant") continue;
      const list = bySession.get(row.session_id) ?? [];
      list.push({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        feedback: null,
      });
      bySession.set(row.session_id, list);
    }

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updated_at,
      messages: bySession.get(s.id) ?? [],
    }));
  } catch {
    return [];
  }
}

export async function syncCloudChatThread(
  userId: string,
  thread: CronosChatThread,
): Promise<boolean> {
  if (!isValidUuid(userId) || !isValidUuid(thread.id) || typeof supabase.from !== "function") {
    return false;
  }
  try {
    const { error: sessErr } = await supabase.from("chat_sessions").upsert(
      {
        id: thread.id,
        user_id: userId,
        title: thread.title,
        updated_at: thread.updatedAt,
      },
      { onConflict: "id" },
    );
    if (sessErr) return false;

    const validMsgs = thread.messages.filter(
      (m) => isValidUuid(m.id) && (m.role === "user" || m.role === "assistant"),
    );
    if (validMsgs.length > 0) {
      await supabase.from("chat_messages").upsert(
        validMsgs.map((m) => ({
          id: m.id,
          session_id: thread.id,
          user_id: userId,
          role: m.role,
          content: m.content,
          created_at: m.createdAt,
        })),
        { onConflict: "id" },
      );
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteCloudChatThread(userId: string, sessionId: string): Promise<void> {
  if (!isValidUuid(userId) || !isValidUuid(sessionId) || typeof supabase.from !== "function") {
    return;
  }
  try {
    await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", userId);
  } catch {
    // Silent fallback; local storage already removed.
  }
}
