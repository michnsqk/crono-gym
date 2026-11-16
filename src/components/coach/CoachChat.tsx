/**
 * CoachChat.tsx — la conversación con el asistente, en pantalla completa OLED.
 *
 * Soporta varias conversaciones independientes por usuario, persistidas en el
 * dispositivo (`chatStorage`, IndexedDB, una conversación por día). Cada sesión
 * de día tiene su propio transcripto y se puede crear, listar, cambiar y borrar.
 *
 * Cuando `fullScreen` es cierto ocupa el 100% de ancho y alto sin bordes ni
 * traslucidez que dejen ver la interfaz trasera: un panel negro denso
 * (`bg-neutral-950`) con cero transparencia, header con `X` de cierre, título
 * `"Cronos IA"` y una tira de chips de sugerencias justo sobre el campo de
 * entrada. Todo el estilo sale de `src/design/tokens.ts`.
 *
 * Las tres decisiones estructurales del componente original se mantienen:
 *  1. El contexto se construye aquí desde el mismo `CoachContext` del hub.
 *  2. Los fallos son mensajes en el transcripto, no toasts.
 *  3. Una petición abortada conserva la respuesta parcial.
 *
 * La persistencia falla a `null`/`false` sin reventar la pantalla: si IndexedDB no
 * responde, la conversación sigue usable en memoria.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  History,
  Layers,
  Plus,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ACCENT, GLASS, MOTION, RADIUS, SCRIM, SOLID, SPACE, STATUS, SURFACE, TEXT, TYPE } from "@/design/tokens";
import { GlassButton } from "@/components/ui";
import { COACH_LABELS as T } from "@/lib/i18n";
import { useAuthModal } from "@/context/AuthModalContext";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { ROUTINES_PATH, TRAIN_PATH } from "@/components/shell/navItems";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { RecommendedExerciseCard } from "@/components/coach/RecommendedExerciseCard";
import { GeneratedRoutineCard } from "@/components/coach/GeneratedRoutineCard";
import {
  ROUTINE_DURATION_OPTIONS,
  ROUTINE_FOCUS_OPTIONS,
  buildGuidedRoutineFromChat,
  createNewThread,
  detectRoutineIntent,
  getActiveThreadId,
  loadChatThreads,
  resolveRecommendedExercisesFromAIResponse,
  saveChatThreads,
  saveGuidedRoutineToUserLibrary,
  setActiveThreadId,
  stripExerciseTags,
  swapGuidedRoutineExercise,
  type CronosChatThread,
  type GuidedRoutineResult,
  type RoutineDurationStyleId,
  type RoutineFocusId,
} from "@/lib/ai/cronosIntelligence";
import type { GymSettings } from "@/context/GymSettingsContext";
import type { CoachContext } from "@/lib/coach/types";
import {
  MAX_USER_MESSAGE_CHARS,
  askCoach,
  type AssistantResponse,
  type ToolCall,
} from "@/lib/ai/coachAssistant";
import { toAssistantContext, type CoachError, type ChatMessage } from "@/lib/ai/types";
import { EXERCISE_TOOLS } from "@/lib/ai/tools";
import { parseRoutinePayload, validateRoutine, type GeneratedRoutine } from "@/lib/ai/routineGenerator";
import { saveGeneratedRoutine } from "@/lib/routines/saveGeneratedRoutine";
import {
  clearChat,
  loadChat,
  pruneChatHistory,
  saveChat,
  toConversationTurns,
} from "@/lib/ai/chatStorage";

const EXERCISE_KEYWORDS = [
  "rutina",
  "ejercicio",
  "ejercicios",
  "pr",
  "récord",
  "1rm",
  "repeticiones",
  "reps",
  "peso",
  "libre",
  "máquina",
  "máquinas",
  "gimnasio",
  "equipo",
  "sentadilla",
  "press",
  "curl",
  "remo",
  "peso muerto",
  "carga",
  "serie",
  "series",
  "descanso",
  "calentamiento",
];

function selectTools(text: string): boolean {
  const lower = text.toLowerCase();
  return EXERCISE_KEYWORDS.some((kw) => lower.includes(kw));
}

export interface CoachChatProps {
  /** El contexto ya cargado del hub. No se reobtiene: sería una segunda fuente. */
  context: CoachContext;
  gymSettings: GymSettings;
  /** Usuario autenticado, necesario para guardar una rutina propuesta en su cuenta. */
  userId: string;
  /** Cuando es cierto, el chat ocupa el 100% de la pantalla (modo OLED focus). */
  fullScreen?: boolean;
  onClose?: () => void;
  /** Día que se abre al montar, si se quiere arrancar en uno concreto. */
  initialDay?: string;
}

export function CoachChat({
  context,
  gymSettings,
  userId,
  fullScreen = false,
  onClose,
  initialDay,
}: CoachChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const [proposedRoutine, setProposedRoutine] = useState<GeneratedRoutine | null>(null);
  const [proposedRoutineError, setProposedRoutineError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [threads, setThreads] = useState<CronosChatThread[]>(() => loadChatThreads());
  const [activeThreadId, setActiveThreadState] = useState<string | null>(() =>
    getActiveThreadId(),
  );
  const [feedbackByMsgId, setFeedbackByMsgId] = useState<Record<string, "up" | "down" | null>>({});
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [builderFocus, setBuilderFocus] = useState<RoutineFocusId | null>(null);
  const [builderStepByMsgId, setBuilderStepByMsgId] = useState<
    Record<string, "choose_focus" | "choose_duration">
  >({});
  const [guidedRoutinesByMsgId, setGuidedRoutinesByMsgId] = useState<
    Record<string, GuidedRoutineResult>
  >({});
  const { exercises: catalog } = useExerciseCatalog();
  const navigate = useNavigate();
  const { start } = useActiveSession();

  const abortRef = useRef<AbortController | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // --------------------------------------------------------------- persistencia

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await pruneChatHistory();
      if (cancelled) return;
      const day = initialDay ?? undefined;
      const msgs = await loadChat(day);
      if (cancelled) return;
      setMessages(
        msgs.map((m) => ({
          ...m,
          isStreaming: false,
        })),
      );
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDay]);

  useEffect(() => {
    const list = listEndRef.current?.parentElement;
    if (!list) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    if (atBottom) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const assistantContext = useMemo(() => toAssistantContext(context, gymSettings), [
    context,
    gymSettings,
  ]);

  // --------------------------------------------------------------- acciones

  const syncThread = useCallback(
    (nextMessages: ChatMessage[], feedbackOverrides?: Record<string, "up" | "down" | null>) => {
      const serializable = nextMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: new Date(m.timestamp || Date.now()).toISOString(),
          feedback: (feedbackOverrides ?? feedbackByMsgId)[m.id] ?? null,
        }));
      if (serializable.length === 0) return;

      const firstUser = serializable.find((m) => m.role === "user")?.content ?? "Nueva consulta";
      const title = firstUser.length > 42 ? `${firstUser.slice(0, 42)}…` : firstUser;
      const targetId = activeThreadId ?? createNewThread(title).id;

      setActiveThreadState(targetId);
      setActiveThreadId(targetId);
      setThreads((prev) => {
        const existing = prev.find((t) => t.id === targetId);
        const updated: CronosChatThread = {
          id: targetId,
          title: existing?.title && existing.messages.length > 0 ? existing.title : title,
          updatedAt: new Date().toISOString(),
          messages: serializable,
        };
        const next = [updated, ...prev.filter((t) => t.id !== targetId)];
        saveChatThreads(next);
        return next;
      });
    },
    [activeThreadId, feedbackByMsgId],
  );

  const handleNewSession = () => {
    abortRef.current?.abort();
    const fresh = createNewThread();
    setActiveThreadState(fresh.id);
    setActiveThreadId(fresh.id);
    setMessages([]);
    setFeedbackByMsgId({});
    setDraft("");
    setLoaded(true);
    setPersisted(true);
    setShowHistory(false);
  };

  const handleSelectThread = (thread: CronosChatThread) => {
    abortRef.current?.abort();
    setActiveThreadState(thread.id);
    setActiveThreadId(thread.id);
    const restored: ChatMessage[] = thread.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: Date.parse(m.createdAt) || Date.now(),
      isStreaming: false,
    }));
    const restoredFeedback: Record<string, "up" | "down" | null> = {};
    for (const m of thread.messages) {
      if (m.feedback) restoredFeedback[m.id] = m.feedback;
    }
    setMessages(restored);
    setFeedbackByMsgId(restoredFeedback);
    setShowHistory(false);
  };

  const handleDeleteThread = (id: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveChatThreads(next);
      return next;
    });
    if (activeThreadId === id) {
      setActiveThreadState(null);
      setActiveThreadId(null);
      setMessages([]);
    }
  };

  const handleFeedback = useCallback(
    (msgId: string, vote: "up" | "down") => {
      setFeedbackByMsgId((prev) => {
        const nextVal = prev[msgId] === vote ? null : vote;
        const nextMap = { ...prev, [msgId]: nextVal };
        syncThread(messages, nextMap);
        return nextMap;
      });
    },
    [messages, syncThread],
  );

  const handleClear = async () => {
    setMessages([]);
    setDraft("");
    setPersisted(true);
    await clearChat();
  };

  const persist = useCallback(
    (next: ChatMessage[]) => {
      void saveChat(next).then((ok) => setPersisted(ok));
      syncThread(next);
    },
    [syncThread],
  );

  const appendRoutineBuilderResult = useCallback(
    (focus: RoutineFocusId, durationStyle: RoutineDurationStyleId, userPromptText?: string) => {
      const generated = buildGuidedRoutineFromChat({
        focus,
        durationStyle,
        catalog,
        userId,
      });
      const assistantId = crypto.randomUUID();
      const jointText =
        generated.jointNotes.length > 0
          ? ` He adaptado la selección cuidando tus molestias (${generated.jointNotes.join(", ")}).`
          : "";
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: `Listo. Diseñé **${generated.name}** con ${generated.exercises.length} ejercicios del catálogo Cronos Gym (${generated.styleLabel}).${jointText}\n\n1. Revisa los GIFs y presiona "Cambiar" si quieres rotar algún ejercicio.\n2. Guárdala directo en "Mis Rutinas" o inicia el entreno ahora mismo.\n\nClave biomecánica: respeta los descansos prescritos y controla 2 a 3 segundos la fase excéntrica en los compuestos.`,
        timestamp: Date.now(),
        isStreaming: false,
      };
      setGuidedRoutinesByMsgId((prev) => ({ ...prev, [assistantId]: generated }));
      setMessages((prev) => {
        const base = userPromptText
          ? [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "user" as const,
                content: userPromptText,
                timestamp: Date.now(),
              },
            ]
          : prev;
        const next = [...base, assistantMsg];
        persist(next);
        return next;
      });
    },
    [catalog, persist, userId],
  );

  const startGuidedRoutineWizard = useCallback(
    (userText?: string) => {
      const assistantId = crypto.randomUUID();
      const userMsg: ChatMessage | null = userText
        ? {
            id: crypto.randomUUID(),
            role: "user",
            content: userText,
            timestamp: Date.now(),
          }
        : null;
      const promptMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content:
          "Paso 1 de 3 · ¿Qué enfoque o grupos musculares quieres entrenar hoy? Elige una opción con un toque:",
        timestamp: Date.now(),
        isStreaming: false,
      };
      setBuilderFocus(null);
      setBuilderStepByMsgId((prev) => ({ ...prev, [assistantId]: "choose_focus" }));
      setMessages((prev) => {
        const next = userMsg ? [...prev, userMsg, promptMsg] : [...prev, promptMsg];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleSelectBuilderFocus = useCallback(
    (focusId: RoutineFocusId, label: string) => {
      const assistantId = crypto.randomUUID();
      setBuilderFocus(focusId);
      setBuilderStepByMsgId((prev) => ({ ...prev, [assistantId]: "choose_duration" }));
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: label,
        timestamp: Date.now(),
      };
      const step2Msg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content:
          "Paso 2 de 3 · Perfecto. Ya tomé en cuenta tu Ficha 360° (peso, nivel y cuidado articular). ¿Qué duración y estilo prefieres?",
        timestamp: Date.now(),
        isStreaming: false,
      };
      setMessages((prev) => {
        const next = [...prev, userMsg, step2Msg];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleSelectBuilderDuration = useCallback(
    (durationStyle: RoutineDurationStyleId, label: string, explicitFocus?: RoutineFocusId) => {
      const focus = explicitFocus ?? builderFocus ?? "push";
      appendRoutineBuilderResult(focus, durationStyle, label);
    },
    [appendRoutineBuilderResult, builderFocus],
  );

  const handleStartGeneratedRoutine = useCallback(
    (routine: GuidedRoutineResult) => {
      const result = start({
        routine: { id: routine.id, title: routine.name },
        planned: routine.exercises.map((ex, idx) => {
          const found = catalog.find((c) => c.id === ex.exerciseId);
          return {
            exercise: found ?? {
              id: ex.exerciseId,
              name: ex.name,
              name_es: ex.name,
              body_part: ex.muscleGroup,
              target: ex.muscleGroup,
              equipment: ex.equipmentName,
              gif_url: ex.gifUrl,
              instructions: [],
              is_active: true,
              is_hidden: false,
              equipment_id: ex.equipmentId,
              equipment_name: ex.equipmentName,
            },
            target_sets: ex.sets,
            rest_seconds: ex.restSeconds,
            rowId: ex.id,
            order_index: idx,
            target_reps_min: ex.repsMin,
            target_reps_max: ex.repsMax,
            dayIndex: 1,
            dayLabel: routine.focusLabel,
          };
        }),
      });
      if (result.ok) {
        onClose?.();
        navigate(TRAIN_PATH);
      }
    },
    [catalog, navigate, onClose, start],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed === "" || busy) return;

      const intent = detectRoutineIntent(trimmed);
      if (intent.isRoutineRequest) {
        setDraft("");
        if (intent.focus && intent.durationStyle) {
          appendRoutineBuilderResult(intent.focus, intent.durationStyle, trimmed);
          return;
        }
        if (intent.focus) {
          const assistantId = crypto.randomUUID();
          setBuilderFocus(intent.focus);
          setBuilderStepByMsgId((prev) => ({ ...prev, [assistantId]: "choose_duration" }));
          const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: trimmed,
            timestamp: Date.now(),
          };
          const step2Msg: ChatMessage = {
            id: assistantId,
            role: "assistant",
            content:
              "Paso 2 de 3 · Perfecto. Ya consideré tu Ficha 360°. ¿Qué duración y estilo prefieres para esta rutina?",
            timestamp: Date.now(),
            isStreaming: false,
          };
          setMessages((prev) => {
            const next = [...prev, userMsg, step2Msg];
            persist(next);
            return next;
          });
          return;
        }
        startGuidedRoutineWizard(trimmed);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      const withUser = [...messages, userMessage];
      setMessages(withUser);
      setDraft("");
      setBusy(true);

      // Guarda la pregunta antes de que llegue la respuesta: si la pestaña se cierra
      // a mitad del stream, el usuario no pierde lo que preguntó.
      void saveChat(withUser);

      const assistantId = crypto.randomUUID();

      void askCoach(
        {
          userMessage: trimmed,
          context: assistantContext,
          conversationHistory: toConversationTurns(messages),
          ...(selectTools(trimmed) ? { tools: [...EXERCISE_TOOLS] } : {}),
        },
        (chunk) => {
          setMessages((current) => {
            const existing = current.find((m) => m.id === assistantId);
            if (existing) {
              return current.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + chunk } : m,
              );
            }
            return [
              ...current,
              {
                id: assistantId,
                role: "assistant",
                content: chunk,
                timestamp: Date.now(),
                isStreaming: true,
              },
            ];
          });
        },
        controller.signal,
      )
        .then((response) => {
          if (response.toolCalls && response.toolCalls.length > 0) {
            handleToolCalls(response.toolCalls);
          }
          setMessages((current) => {
            const next = finalize(current, assistantId, response);
            persist(next);
            return next;
          });
          if (response.action?.type === "routine_proposal") {
            setProposedRoutine(response.action.routine);
          }
        })
        .catch((cause: unknown) => {
          if (isAbort(cause, controller.signal)) {
            setMessages((current) => {
              const next = finalize(current, assistantId);
              persist(next);
              return next;
            });
            return;
          }

          const error = classify(cause);
          setMessages((current) => {
            const next = [
              ...finalize(current, assistantId),
              {
                id: crypto.randomUUID(),
                role: "error" as const,
                content: T.chatErrors[error.code] ?? T.chatErrors.SERVICE_UNAVAILABLE,
                timestamp: Date.now(),
                errorCode: error.code,
              },
            ];
            persist(next);
            return next;
          });
        })
        .finally(() => {
          abortRef.current = null;
          setBusy(false);
        });
    },
    [assistantContext, busy, messages, persist],
  );

  const handleToolCalls = (toolCalls: ToolCall[]) => {
    for (const tc of toolCalls) {
      if (tc.function.name === "createRoutine") {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          setProposedRoutineError("Respuesta no válida de Cronos.");
          return;
        }
        const parsed = parseRoutinePayload(JSON.stringify(args));
        const routine = validateRoutine(parsed);
        if (routine) {
          setProposedRoutine(routine);
        } else {
          setProposedRoutineError("La rutina propuesta no tiene el formato esperado.");
        }
      }
    }
  };

  const dismissProposed = () => {
    setProposedRoutine(null);
    setProposedRoutineError(null);
  };

  const savingProposedRef = useRef(false);

  const saveProposed = async () => {
    if (!proposedRoutine || savingProposedRef.current) return;
    savingProposedRef.current = true;
    try {
      const ok = await saveGeneratedRoutine(userId, proposedRoutine);
      if (ok) {
        setProposedRoutine(null);
        setProposedRoutineError(null);
      } else {
        setProposedRoutineError("No se pudo guardar la rutina en tu cuenta. Inténtalo de nuevo.");
      }
    } finally {
      savingProposedRef.current = false;
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  const stop = () => abortRef.current?.abort();

  const tooLong = draft.length > MAX_USER_MESSAGE_CHARS;

  const containerStyle: React.CSSProperties = fullScreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#000000",
        color: TEXT.primary,
      }
    : {
        backgroundColor: "transparent",
      };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${SPACE.lg} ${SPACE.xl}`,
    borderBottom: fullScreen ? `1px solid ${TEXT.tertiary}22` : undefined,
    minHeight: fullScreen ? 60 : undefined,
  };

  const headerLeftStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: SPACE.sm,
  };

  const titleStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: SPACE.xs,
    margin: 0,
    fontSize: TYPE.title2.size,
    fontWeight: TYPE.title2.weight,
    color: TEXT.primary,
  };

  const closeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: RADIUS.control,
    border: `1px solid ${TEXT.tertiary}33`,
    backgroundColor: SCRIM.recessed,
    color: TEXT.primary,
    cursor: "pointer",
  };

  const scrollStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: SPACE.xl,
    display: "flex",
    flexDirection: "column",
    gap: SPACE.sm,
  };

  const chipsStyle: React.CSSProperties = {
    display: "flex",
    gap: SPACE.xs,
    overflowX: "auto",
    paddingBottom: SPACE.md,
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: "x mandatory",
    paddingLeft: SPACE.xl,
    paddingRight: SPACE.xl,
  };

  const chipStyle = (): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: SPACE.xs,
    minHeight: MOTION.minTouchTarget,
    padding: `${SPACE.xs} ${SPACE.md}`,
    borderRadius: RADIUS.pill,
    border: "1px solid rgba(39,39,42,0.5)",
    backgroundColor: "rgba(24,24,27,0.8)",
    color: TEXT.secondary,
    fontSize: TYPE.caption.size,
    fontWeight: TYPE.subhead.weight,
    whiteSpace: "nowrap",
    cursor: "pointer",
    flexShrink: 0,
    scrollSnapAlign: "start",
    transition: `transform ${MOTION.fast} ${MOTION.spring}`,
  });

  const inputAreaStyle: React.CSSProperties = {
    padding: `${SPACE.lg} ${SPACE.xl}`,
    borderTop: "1px solid rgba(255,255,255,0.04)",
    backgroundColor: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  };

  // --------------------------------------------------------------- historial

  const historyPanelStyle: React.CSSProperties = {
    position: "absolute",
    top: fullScreen ? 60 : 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    backgroundColor: SURFACE.base,
    borderBottom: `1px solid ${TEXT.tertiary}22`,
    padding: SPACE.xl,
    zIndex: 10,
    overflowY: "auto",
  };

  return (
    <div style={containerStyle}>
      {fullScreen && onClose && (
        <>
          <div className="w-11 h-1 rounded-full bg-white/20 mx-auto mt-2.5 mb-1 shrink-0" />
          <header style={headerStyle}>
            <div style={headerLeftStyle}>
              <span
                aria-hidden="true"
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: ACCENT.subtle, color: ACCENT.base }}
              >
                <Sparkles size={16} />
              </span>
              <h2 style={titleStyle}>Cronos Intelligence</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                aria-label="Historial de conversaciones"
                style={closeStyle}
              >
                <History size={18} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar Cronos Intelligence"
                style={closeStyle}
              >
                <X size={20} strokeWidth={1.8} />
              </button>
            </div>
          </header>
        </>
      )}

      {!fullScreen ? (
        <div style={{ padding: SPACE.md }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: SPACE.md,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600 }}>
                {T.chatTitle}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                {T.chatSubtitle}
              </p>
            </div>
            {messages.length > 0 && (
              <div style={{ display: "flex", gap: SPACE.xs }}>
                <button
                  type="button"
                  onClick={handleNewSession}
                  aria-label={T.chatNewSession}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: MOTION.minTouchTarget,
                    height: MOTION.minTouchTarget,
                    flexShrink: 0,
                    borderRadius: RADIUS.control,
                    border: "1px solid transparent",
                    backgroundColor: "transparent",
                    color: TEXT.tertiary,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ marginRight: 4 }}>{"+"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label={T.chatClear}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: MOTION.minTouchTarget,
                    height: MOTION.minTouchTarget,
                    flexShrink: 0,
                    borderRadius: RADIUS.control,
                    border: "1px solid transparent",
                    backgroundColor: "transparent",
                    color: TEXT.tertiary,
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ paddingLeft: SPACE.xl, paddingRight: SPACE.xl, paddingBottom: SPACE.md }}>
          <div style={{ marginBottom: SPACE.md, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
            Cronos está contigo
          </div>
        </div>
      )}

      {showHistory && fullScreen && (
        <div style={historyPanelStyle}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3
              style={{
                margin: 0,
                fontSize: TYPE.subhead.size,
                fontWeight: 600,
                color: TEXT.primary,
              }}
            >
              {T.chatSessionsTitle}
            </h3>
            <button
              type="button"
              onClick={handleNewSession}
              className="h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold"
              style={{
                backgroundColor: ACCENT.base,
                color: TEXT.onAccent,
              }}
            >
              <Plus size={14} aria-hidden="true" />
              <span>Nueva conversación</span>
            </button>
          </div>
          {threads.length === 0 ? (
            <p className="text-xs" style={{ color: TEXT.tertiary }}>
              Aún no hay conversaciones guardadas.
            </p>
          ) : (
            <ul className="space-y-2">
              {threads.map((th) => {
                const isActive = th.id === activeThreadId;
                return (
                  <li
                    key={th.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-2xl"
                    style={{
                      backgroundColor: isActive ? ACCENT.subtle : SOLID.card,
                      border: `1px solid ${isActive ? ACCENT.border : GLASS.border}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectThread(th)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: TEXT.primary }}
                      >
                        {th.title}
                      </p>
                      <p className="text-[11px]" style={{ color: TEXT.tertiary }}>
                        {th.messages.length} mensajes · {th.updatedAt.slice(0, 10)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteThread(th.id)}
                      aria-label={`Eliminar conversación ${th.title}`}
                      className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ color: TEXT.tertiary }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="relative flex-1 flex flex-col min-h-0">
        <div
          ref={scrollContainerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            setShowScrollBottom(distFromBottom > 120);
          }}
          style={scrollStyle}
          aria-live="polite"
          aria-busy={busy}
        >
          {!loaded ? (
            <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
              {T.loading}
            </p>
          ) : messages.length === 0 ? (
            <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
              {T.chatEmpty}
            </p>
          ) : (
            messages.map((message, idx) => {
              const prevUser =
                message.role === "assistant"
                  ? [...messages.slice(0, idx)]
                      .reverse()
                      .find((m) => m.role === "user")?.content ?? ""
                  : "";
              const recommended =
                message.role === "assistant" && !message.isStreaming
                  ? resolveRecommendedExercisesFromAIResponse(
                      message.content,
                      prevUser,
                      catalog,
                      { limit: 3 },
                    )
                  : [];
              return (
                <Bubble
                  key={message.id}
                  message={message}
                  recommended={recommended}
                  feedback={feedbackByMsgId[message.id] ?? null}
                  onFeedback={(vote) => handleFeedback(message.id, vote)}
                  builderStep={builderStepByMsgId[message.id] ?? null}
                  onSelectFocus={handleSelectBuilderFocus}
                  onSelectDuration={handleSelectBuilderDuration}
                  guidedRoutine={guidedRoutinesByMsgId[message.id] ?? null}
                  onRenameGuidedRoutine={(nextName) => {
                    setGuidedRoutinesByMsgId((prev) => {
                      const cur = prev[message.id];
                      if (!cur) return prev;
                      return { ...prev, [message.id]: { ...cur, name: nextName } };
                    });
                  }}
                  onSwapGuidedExercise={(exIdx) => {
                    setGuidedRoutinesByMsgId((prev) => {
                      const cur = prev[message.id];
                      if (!cur) return prev;
                      return {
                        ...prev,
                        [message.id]: swapGuidedRoutineExercise(cur, exIdx, catalog),
                      };
                    });
                  }}
                  onSaveGuidedRoutine={async (r) => {
                    await saveGuidedRoutineToUserLibrary(userId, r);
                  }}
                  onStartGuidedRoutine={handleStartGeneratedRoutine}
                  onGoToRoutines={() => {
                    onClose?.();
                    navigate(ROUTINES_PATH);
                  }}
                />
              );
            })
          )}
          <div ref={listEndRef} />
        </div>

        {showScrollBottom ? (
          <button
            type="button"
            onClick={() => {
              const el = scrollContainerRef.current;
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            }}
            aria-label="Bajar al último mensaje"
            className="absolute bottom-3 right-4 h-9 w-9 rounded-full flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: SOLID.card,
              border: `1px solid ${GLASS.borderStrong}`,
              color: TEXT.primary,
            }}
          >
            <ArrowDown size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div style={chipsStyle}>
        <button
          type="button"
          onClick={() => startGuidedRoutineWizard("Crear rutina paso a paso")}
          aria-label="Crear rutina paso a paso"
          style={{
            ...chipStyle(),
            borderColor: ACCENT.border,
            backgroundColor: ACCENT.subtle,
            color: ACCENT.text,
            fontWeight: 600,
          }}
        >
          <Layers size={13} aria-hidden="true" />
          <span>Crear rutina paso a paso</span>
        </button>
        {[
          "¿Cómo uso esta máquina?",
          "Dame una variante para pecho",
          "¿Qué me toca hoy?",
          ...T.chatSuggestions,
        ].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/50 active:scale-95 transition-transform"
            onClick={() => {
              setDraft(suggestion);
              send(suggestion);
            }}
            aria-label={suggestion}
            style={chipStyle()}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form onSubmit={submit} style={inputAreaStyle}>
        <label
          htmlFor="coach-chat-input"
          className="sr-only"
        >
          Pregunta lo que quieras a Cronos
        </label>
        <div
          className="flex items-end gap-2 rounded-full px-4 py-2"
          style={{
            backgroundColor: SOLID.card,
            border: `1px solid ${tooLong ? STATUS.warning.text : focused ? ACCENT.border : GLASS.borderStrong}`,
          }}
        >
          <textarea
            id="coach-chat-input"
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            maxLength={MAX_USER_MESSAGE_CHARS + 1}
            placeholder="Pregunta lo que quieras a Cronos"
            aria-describedby="coach-chat-disclaimer"
            className="flex-1 bg-transparent resize-none outline-none text-sm py-1.5"
            style={{ color: TEXT.primary }}
          />

          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label={T.chatStop}
              className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: GLASS.fillRaised,
                color: TEXT.primary,
              }}
            >
              <Square size={14} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={draft.trim() === "" || tooLong}
              aria-label={T.chatSend}
              className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: draft.trim() === "" || tooLong ? GLASS.fillRaised : ACCENT.base,
                color: draft.trim() === "" || tooLong ? TEXT.tertiary : TEXT.onAccent,
              }}
            >
              <ArrowUp size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {(tooLong || !persisted) && (
          <p className="text-[11px] mt-1 px-2" style={{ color: TEXT.tertiary }}>
            {tooLong ? `${draft.length} / ${MAX_USER_MESSAGE_CHARS}` : T.chatNotSaved}
          </p>
        )}
      </form>

      <p
        id="coach-chat-disclaimer"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          margin: `${SPACE.md}px 0 0`,
          fontSize: TYPE.label.size,
          lineHeight: 1.5,
          color: TEXT.tertiary,
        }}
      >
        <AlertTriangle size={13} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        {T.chatDisclaimer}
      </p>

      {proposedRoutineError && (
        <div
          role="alert"
          style={{
            marginTop: SPACE.md,
            padding: "9px 12px",
            borderRadius: RADIUS.control,
            border: `1px solid #f871712e`,
            backgroundColor: "#f8717112",
            fontSize: TYPE.caption.size,
            color: TEXT.primary,
          }}
        >
          {proposedRoutineError}
          <button
            type="button"
            onClick={dismissProposed}
            style={{
              marginLeft: 8,
              border: "none",
              background: "transparent",
              color: ACCENT.text,
              fontSize: TYPE.caption.size,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>
      )}

      {proposedRoutine && (
        <ProposedRoutineCard
          routine={proposedRoutine}
          onSave={saveProposed}
          onClose={dismissProposed}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------- bubble

function Bubble({
  message,
  recommended = [],
  feedback = null,
  onFeedback,
  builderStep = null,
  onSelectFocus,
  onSelectDuration,
  guidedRoutine = null,
  onRenameGuidedRoutine,
  onSwapGuidedExercise,
  onSaveGuidedRoutine,
  onStartGuidedRoutine,
  onGoToRoutines,
}: {
  message: ChatMessage;
  recommended?: ReturnType<typeof resolveRecommendedExercisesFromAIResponse>;
  feedback?: "up" | "down" | null;
  onFeedback?: (vote: "up" | "down") => void;
  builderStep?: "choose_focus" | "choose_duration" | null;
  onSelectFocus?: (focusId: RoutineFocusId, label: string) => void;
  onSelectDuration?: (durationStyle: RoutineDurationStyleId, label: string) => void;
  guidedRoutine?: GuidedRoutineResult | null;
  onRenameGuidedRoutine?: (nextName: string) => void;
  onSwapGuidedExercise?: (index: number) => void;
  onSaveGuidedRoutine?: (routine: GuidedRoutineResult) => Promise<void> | void;
  onStartGuidedRoutine?: (routine: GuidedRoutineResult) => void;
  onGoToRoutines?: () => void;
}) {
  const authModal = useAuthModal();

  if (message.role === "error") {
    const recoverable = message.errorCode === "AUTH_ERROR";
    return (
      <div
        role="alert"
        style={{
          alignSelf: "stretch",
          borderRadius: RADIUS.control,
          border: `1px solid ${STATUS.warning.border}`,
          backgroundColor: STATUS.warning.muted,
          padding: "9px 12px",
          fontSize: TYPE.caption.size,
          color: TEXT.primary,
        }}
      >
        <p style={{ margin: 0 }}>{message.content}</p>
        {recoverable && (
          <div style={{ marginTop: 8 }}>
            <GlassButton type="button" variant="primary" onClick={authModal.open}>
              {T.chatSignInAgain}
            </GlassButton>
          </div>
        )}
      </div>
    );
  }

  const mine = message.role === "user";
  const displayText = mine ? message.content : stripExerciseTags(message.content);

  if (mine) {
    return (
      <div
        className="self-end max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5"
        style={{
          backgroundColor: ACCENT.subtle,
          border: `1px solid ${ACCENT.border}`,
          color: TEXT.primary,
        }}
      >
        <p style={{ margin: 0, fontSize: TYPE.subhead.size, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {displayText}
        </p>
      </div>
    );
  }

  return (
    <div className="self-start w-full max-w-[96%] space-y-2.5 py-1">
      {recommended.length > 0 ? (
        <div className="space-y-2">
          {recommended.map((match) => (
            <RecommendedExerciseCard key={match.id} match={match} />
          ))}
        </div>
      ) : null}

      <div
        className="rounded-2xl rounded-bl-sm px-3.5 py-3"
        style={{
          backgroundColor: SCRIM.recessed,
          border: `1px solid ${GLASS.border}`,
          color: TEXT.primary,
        }}
      >
        <p style={{ margin: 0, fontSize: TYPE.subhead.size, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {displayText}
          {message.isStreaming && (
            <span
              aria-hidden="true"
              className="cronos-chat--caret"
              style={{
                display: "inline-block",
                width: 6,
                height: 13,
                marginLeft: 2,
                verticalAlign: "-2px",
                backgroundColor: ACCENT.text,
                animation: `cronos-caret ${MOTION.loop.caret} steps(2, start) infinite`,
              }}
            />
          )}
        </p>

        {builderStep === "choose_focus" && onSelectFocus ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {ROUTINE_FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectFocus(opt.id, opt.label)}
                className="px-3 py-2 rounded-full text-xs font-medium text-left"
                style={{
                  backgroundColor: SOLID.card,
                  color: TEXT.primary,
                  border: `1px solid ${GLASS.borderStrong}`,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}

        {builderStep === "choose_duration" && onSelectDuration ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {ROUTINE_DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectDuration(opt.id, opt.label)}
                className="px-3 py-2 rounded-full text-xs font-medium text-left"
                style={{
                  backgroundColor: SOLID.card,
                  color: TEXT.primary,
                  border: `1px solid ${GLASS.borderStrong}`,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}

        {message.action && message.action.type !== "routine_proposal" && (
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${GLASS.border}`,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: TYPE.label.size,
                textTransform: "uppercase",
                letterSpacing: TYPE.label.tracking,
                color: ACCENT.text,
              }}
            >
              {T.chatActions[message.action.type] ?? message.action.type}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.secondary }}>
              {describeAction(message.action)}
            </p>
          </div>
        )}

        {!message.isStreaming && onFeedback ? (
          <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: `1px solid ${GLASS.border}` }}>
            <button
              type="button"
              onClick={() => onFeedback("up")}
              aria-label="Respuesta útil"
              aria-pressed={feedback === "up"}
              className="h-7 w-7 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: feedback === "up" ? ACCENT.subtle : "transparent",
                color: feedback === "up" ? ACCENT.text : TEXT.tertiary,
              }}
            >
              <ThumbsUp size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onFeedback("down")}
              aria-label="Respuesta poco útil"
              aria-pressed={feedback === "down"}
              className="h-7 w-7 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: feedback === "down" ? STATUS.warning.muted : "transparent",
                color: feedback === "down" ? STATUS.warning.text : TEXT.tertiary,
              }}
            >
              <ThumbsDown size={13} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      {guidedRoutine && onSaveGuidedRoutine && onStartGuidedRoutine ? (
        <GeneratedRoutineCard
          routine={guidedRoutine}
          onRename={onRenameGuidedRoutine}
          onSwapExercise={onSwapGuidedExercise}
          onSaveToRoutines={onSaveGuidedRoutine}
          onStartNow={onStartGuidedRoutine}
          onGoToRoutines={onGoToRoutines}
        />
      ) : null}
    </div>
  );
}

function describeAction(action: NonNullable<ChatMessage["action"]>): string {
  switch (action.type) {
    case "exercise_swap":
      return `${action.fromExercise} → ${action.toExercise}. ${action.reason}`;
    case "training_adjustment":
      return `${action.field} ${action.delta > 0 ? "+" : ""}${action.delta}. ${action.reason}`;
    case "calorie_adjustment":
      return `${action.deltaKcal > 0 ? "+" : ""}${action.deltaKcal} kcal. ${action.reason}`;
    case "deload_suggestion":
      return `${action.durationWeeks} ${action.durationWeeks === 1 ? "semana" : "semanas"}. ${action.reason}`;
    case "routine_proposal":
      return "Rutina propuesta por Cronos IA. Usa Guardar en mis rutinas para añadirla a tu biblioteca.";
  }
}

// --------------------------------------------------------------- finalize

function finalize(
  current: ChatMessage[],
  assistantId: string,
  response?: AssistantResponse,
): ChatMessage[] {
  const bubble: ChatMessage = {
    id: assistantId,
    role: "assistant",
    content: response?.message ?? "",
    timestamp: Date.now(),
    isStreaming: false,
    ...(response?.action ? { action: response.action } : {}),
  };

  if (current.some((message) => message.id === assistantId)) {
    return current.map((message) =>
      message.id === assistantId
        ? {
            ...bubble,
            content: bubble.content !== "" ? bubble.content : message.content,
          }
        : message,
    );
  }
  return response === undefined ? current : [...current, bubble];
}

// --------------------------------------------------------------- errors

function isAbort(cause: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return cause instanceof Error && cause.name === "AbortError";
}

function classify(cause: unknown): CoachError {
  if (typeof cause === "object" && cause !== null && "detail" in cause) {
    const detail = (cause as { detail: unknown }).detail;
    if (typeof detail === "object" && detail !== null && "code" in detail) {
      return detail as CoachError;
    }
  }
  return { code: "SERVICE_UNAVAILABLE" };
}

// --------------------------------------------------------------- proposed

function ProposedRoutineCard({
  routine,
  onSave,
  onClose,
}: {
  routine: GeneratedRoutine;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        marginTop: SPACE.md,
        padding: "9px 12px",
        borderRadius: RADIUS.control,
        border: `1px solid ${ACCENT.border}`,
        backgroundColor: `${ACCENT.base}14`,
      }}
    >
      <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: ACCENT.text }}>
        Cronos propuso una rutina
      </p>
      <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
        {routine.name} · {routine.days.length} día{routine.days.length === 1 ? "" : "s"}
      </p>
      <div style={{ marginTop: 8, display: "flex", gap: SPACE.sm }}>
        <GlassButton variant="primary" onClick={onSave}>
          Guardar en mis rutinas
        </GlassButton>
        <GlassButton variant="ghost" onClick={onClose}>
          Descartar
        </GlassButton>
      </div>
    </div>
  );
}

