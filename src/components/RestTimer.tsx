/**
 * RestTimer.tsx — the rest, as a deadline rather than as a counter.
 *
 * Why a deadline
 * --------------
 * The previous version counted down from a number: `useState(seconds)`
 * with an interval subtracting one. A counter drifts every time the
 * browser throttles a background tab -- which is exactly when the
 * athlete is resting, scrolling their phone -- and a rest that reads
 * "00:05" but has already been "00:05" for a minute is a rest timer
 * lying about the one thing it exists to report. So the clock owns a
 * deadline (`endsAt`, or one derived from `seconds` at mount) and every
 * tick re-reads it. Read late, it still names the same moment.
 *
 * Why the beep is lazy and once
 * -------------------------------
 * The `AudioContext` is created on first use, never on import, and the
 * end-of-rest beep is the only sound this timer makes: one confirmation
 * when the rest ends, not a per-second tick that would make the last
 * fifteen seconds of every rest a metronome. Under
 * `prefers-reduced-motion` it stays silent altogether -- the preference
 * asks for less stimulus, and a surprise tone is stimulus. A record
 * that just broke keeps the speaker: the badge's beep already said what
 * needed saying, and two confirmations at once is noise.
 *
 * What the athlete can do
 * -------------------------
 * Adjust the rest by fifteen seconds in either direction, pause it,
 * skip it, or minimize it to a bar above the navigation so the set
 * table stays in view -- the rest is a means to the next set, not the
 * screen's subject.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronDown, ChevronUp, Minus, Pause, Pencil, Play, Plus, Sparkles, X } from "lucide-react";
import {
  isFinalStretch,
  REST_BEEP_HZ,
  REST_BEEP_MS,
  REST_STEP_MS,
  REST_VIBRATE_MS,
  TICK_MS,
  formatRemaining,
  ringProgress,
  remainingMs,
} from "../lib/workout/restTimer";
import type { SmartRestRecommendation } from "../lib/workout/smartRestAdvisor";
import { isRecordBeepActive, playBeep } from "../lib/audio";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { REST_TIMER_LABELS } from "../lib/i18n";
import {
  ACCENT,
  DIAGRAM,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  STATUS,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "../design/tokens";

export interface RestTimerProps {
  /** The rest's length in seconds, used when `endsAt` is absent. */
  seconds: number;
  /**
   * Epoch milliseconds when the rest ends.
   *
   * Supplied by the caller that started the rest, so a remount -- a
   * navigation, a recovered draft -- does not restart the clock. Derived
   * from `seconds` at mount when absent, which is the counter-less
   * version of "start now".
   */
  endsAt?: number;
  /** Optional exercise label shown in the timer header. */
  exerciseName?: string;
  /** Optional smart rest recommendation (unilateral side rest, machine, core, etc.). */
  smartRecommendation?: SmartRestRecommendation;
  /** Called when the athlete edits or chooses a new rest duration in seconds. */
  onUpdateSeconds?: (nextSeconds: number) => void;
  onClose: () => void;
  onFinished: () => void;
}

/** How far around the ring the hand travels; the ring's geometry, in one place. */
const RING_RADIUS = 54;

export function RestTimer({
  seconds,
  endsAt,
  exerciseName,
  smartRecommendation,
  onUpdateSeconds,
  onClose,
  onFinished,
}: RestTimerProps) {
  const reducedMotion = useReducedMotion();
  // The beep decision travels in a ref so the interval's callback --
  // which outlives the render that scheduled it -- reads the preference
  // as it is now, not as it was when the rest started.
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const [activeTotalMs, setActiveTotalMs] = useState(() => Math.max(seconds, 1) * 1000);
  const deadlineRef = useRef(endsAt ?? Date.now() + Math.max(seconds, 1) * 1000);
  const finishedRef = useRef(false);
  // The remaining time a pause is holding, so resuming rebuilds the
  // deadline rather than restarting the rest.
  const pausedAtRef = useRef<number | null>(null);

  const [remaining, setRemaining] = useState(() =>
    remainingMs(deadlineRef.current, Date.now()),
  );
  const [running, setRunning] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editInput, setEditInput] = useState(() => String(Math.max(10, Math.round(seconds))));

  /**
   * Ends the rest.
   *
   * `beep` is false when the athlete skipped: the beep is the "your rest
   * is over" signal, and someone who tapped "Saltar" is already back.
   * Guarded against a second call -- the interval, the skip button and
   * the zero deadline can all arrive at the same end.
   */
  const finish = useCallback(
    (beep: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      if (beep && !reducedMotionRef.current && !isRecordBeepActive()) {
        // A device that cannot play the tone still says "ready", the way
        // it can: a vibration. Either way the sound is made once.
        if (!playBeep(REST_BEEP_HZ, REST_BEEP_MS)) {
          navigator.vibrate?.(REST_VIBRATE_MS);
        }
      }
      onFinished();
    },
    [onFinished],
  );

  // The clock. One interval, re-reading the deadline, so a throttled
  // background tab costs nothing: the moment the athlete returns, the
  // next tick names the time that actually remains.
  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      const left = remainingMs(deadlineRef.current, Date.now());
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        finish(true);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, finish]);

  // A tab that was hidden does not get a stale numeral on return: the
  // interval above is the real fix, and this is the paint that makes the
  // fix visible the instant the athlete looks back.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setRemaining(remainingMs(deadlineRef.current, Date.now()));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Mantener pantalla activa durante el descanso (best-effort; falla silencioso si no hay soporte).
  useEffect(() => {
    if (!running) return undefined;
    let sentinel: { release?: () => Promise<void> } | null = null;
    let cancelled = false;
    const wl = (navigator as unknown as { wakeLock?: { request?: (t: string) => Promise<{ release?: () => Promise<void> }> } }).wakeLock;
    wl?.request?.("screen")
      .then((lock) => {
        if (cancelled) {
          void lock?.release?.();
        } else {
          sentinel = lock;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void sentinel?.release?.();
    };
  }, [running]);

  /** Moves the deadline, which moves every later tick with it. */
  const adjust = (deltaMs: number) => {
    if (pausedAtRef.current !== null) {
      // Paused: the deadline is a moment already in the past, so
      // moving it changes nothing on screen -- the hold is the
      // clock, and the hold is what moves.
      pausedAtRef.current = Math.max(0, pausedAtRef.current + deltaMs);
      setRemaining(pausedAtRef.current);
      return;
    }
    // Never into the past: a negative remainder would be a rest that is
    // over before the tap lands, and the next tick ends it anyway.
    deadlineRef.current = Math.max(Date.now(), deadlineRef.current + deltaMs);
    setRemaining(remainingMs(deadlineRef.current, Date.now()));
  };

  const toggleRunning = () => {
    if (running) {
      pausedAtRef.current = remainingMs(deadlineRef.current, Date.now());
      setRunning(false);
      return;
    }
    const held = pausedAtRef.current ?? remainingMs(deadlineRef.current, Date.now());
    pausedAtRef.current = null;
    deadlineRef.current = Date.now() + held;
    setRunning(true);
  };

  const applyCustomSeconds = (nextSeconds: number) => {
    const clamped = Math.max(10, Math.min(600, Math.round(nextSeconds)));
    const nextMs = clamped * 1000;
    setActiveTotalMs(nextMs);
    if (pausedAtRef.current !== null) {
      pausedAtRef.current = nextMs;
    } else {
      deadlineRef.current = Date.now() + nextMs;
    }
    setRemaining(nextMs);
    setEditInput(String(clamped));
    setEditing(false);
    onUpdateSeconds?.(clamped);
  };

  const finalStretch = isFinalStretch(remaining);
  const progress = ringProgress(remaining, activeTotalMs);
  const circumference = 2 * Math.PI * RING_RADIUS;
  const dash = circumference * progress;
  // The ring's colour joins the numeral's in the last stretch: one
  // signal, two channels, so the urgency survives being read without
  // colour alone.
  const emphasis = finalStretch ? STATUS.warning.base : ACCENT.base;
  const remainingLabel = REST_TIMER_LABELS.remainingAriaLabel(
    Math.ceil(remaining / 1000),
  );

  if (minimized) {
    return (
      <div role="status" aria-label={remainingLabel} style={barStyle}>
        <span style={barTimeStyle}>{formatRemaining(remaining)}</span>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label={REST_TIMER_LABELS.expandAriaLabel}
          style={barButtonStyle}
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={REST_TIMER_LABELS.closeAriaLabel}
          style={barButtonStyle}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div style={scrimStyle}>
      <div role="dialog" aria-label={REST_TIMER_LABELS.title} style={cardStyle}>
        <button
          type="button"
          onClick={onClose}
          aria-label={REST_TIMER_LABELS.closeAriaLabel}
          style={closeButtonStyle}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <p style={captionStyle}>{REST_TIMER_LABELS.title}</p>
        {exerciseName && (
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 600,
              color: TEXT.primary,
              textAlign: "center",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {exerciseName}
          </p>
        )}
        {smartRecommendation && (
          <button
            type="button"
            onClick={() => applyCustomSeconds(smartRecommendation.betweenSetsSeconds)}
            title={smartRecommendation.detail}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "9999px",
              background: "rgba(215, 0, 21, 0.14)",
              border: "1px solid rgba(215, 0, 21, 0.35)",
              color: "#FCA5A5",
              fontSize: "11px",
              fontWeight: 600,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <Sparkles size={12} aria-hidden="true" />
            <span>{smartRecommendation.shortBadge}</span>
          </button>
        )}

        <div style={ringWrapStyle}>
          <svg
            aria-hidden="true"
            style={ringStyle}
            viewBox="0 0 128 128"
          >
            <circle
              cx="64"
              cy="64"
              r={RING_RADIUS}
              fill="none"
              stroke={DIAGRAM.inert}
              strokeWidth="6"
            />
            <circle
              cx="64"
              cy="64"
              r={RING_RADIUS}
              fill="none"
              stroke={emphasis}
              strokeWidth="6"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeLinecap="round"
              /*
               * `MOTION.easeLinear`, not the bare `linear` keyword. Same
               * value -- but the keyword reads as "no curve thought about
               * here", and this ring is the one place in the app where the
               * linear curve is a deliberate choice: the dash shrinks at a
               * constant rate so the remaining time is readable as distance,
               * and any easing would make the countdown lie about how fast
               * it is going. Under `prefers-reduced-motion` there is no
               * transition at all: the dash steps, because the motion *is*
               * the thing the preference asked to drop.
               */
              style={
                reducedMotion
                  ? undefined
                  : {
                      transition: `stroke-dasharray ${MOTION.loop.rest} ${MOTION.easeLinear}`,
                    }
              }
            />
          </svg>
          <span role="status" aria-label={remainingLabel} style={numeralStyle}>
            <span aria-hidden="true" style={numeralTextStyle}>
              {formatRemaining(remaining)}
            </span>
          </span>
        </div>

        <div style={controlsStyle}>
          <button
            type="button"
            onClick={() => adjust(-REST_STEP_MS)}
            aria-label={REST_TIMER_LABELS.subtractAriaLabel}
            style={controlButtonStyle}
          >
            <Minus size={14} aria-hidden="true" />
            {REST_TIMER_LABELS.stepLabel}
          </button>
          <button
            type="button"
            onClick={toggleRunning}
            aria-label={running ? REST_TIMER_LABELS.pauseAriaLabel : REST_TIMER_LABELS.resumeAriaLabel}
            style={controlButtonStyle}
          >
            {running ? (
              <Pause size={14} aria-hidden="true" />
            ) : (
              <Play size={14} aria-hidden="true" />
            )}
            {running ? REST_TIMER_LABELS.pauseLabel : REST_TIMER_LABELS.resumeLabel}
          </button>
          <button
            type="button"
            onClick={() => adjust(REST_STEP_MS)}
            aria-label={REST_TIMER_LABELS.addAriaLabel}
            style={controlButtonStyle}
          >
            <Plus size={14} aria-hidden="true" />
            {REST_TIMER_LABELS.stepLabel}
          </button>
        </div>

        {/* Modo unilateral (40s por lado) + Edición directa + Presets */}
        {smartRecommendation?.betweenSidesSeconds !== null &&
          smartRecommendation?.betweenSidesSeconds !== undefined && (
          <div style={{ display: "flex", gap: "6px", width: "100%" }}>
            <button
              type="button"
              onClick={() =>
                applyCustomSeconds(smartRecommendation.betweenSidesSeconds ?? 40)
              }
              style={{
                flex: 1,
                padding: "7px 8px",
                borderRadius: "12px",
                border:
                  Math.round(activeTotalMs / 1000) === smartRecommendation.betweenSidesSeconds
                    ? "1px solid #D70015"
                    : "1px solid rgba(255,255,255,0.12)",
                background:
                  Math.round(activeTotalMs / 1000) === smartRecommendation.betweenSidesSeconds
                    ? "rgba(215, 0, 21, 0.18)"
                    : "rgba(255,255,255,0.04)",
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {smartRecommendation.betweenSidesSeconds}s · Otro lado
            </button>
            <button
              type="button"
              onClick={() => applyCustomSeconds(smartRecommendation.betweenSetsSeconds)}
              style={{
                flex: 1,
                padding: "7px 8px",
                borderRadius: "12px",
                border:
                  Math.round(activeTotalMs / 1000) === smartRecommendation.betweenSetsSeconds
                    ? "1px solid #D70015"
                    : "1px solid rgba(255,255,255,0.12)",
                background:
                  Math.round(activeTotalMs / 1000) === smartRecommendation.betweenSetsSeconds
                    ? "rgba(215, 0, 21, 0.18)"
                    : "rgba(255,255,255,0.04)",
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {smartRecommendation.betweenSetsSeconds}s · Serie
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px", width: "100%" }}>
          {[40, 60, 90, 120, 150].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyCustomSeconds(preset)}
              style={{
                padding: "4px 8px",
                borderRadius: "9999px",
                border:
                  Math.round(activeTotalMs / 1000) === preset
                    ? "1px solid #D70015"
                    : "1px solid rgba(255,255,255,0.1)",
                background:
                  Math.round(activeTotalMs / 1000) === preset
                    ? "rgba(215, 0, 21, 0.2)"
                    : "rgba(255,255,255,0.03)",
                color: Math.round(activeTotalMs / 1000) === preset ? "#FFFFFF" : TEXT.secondary,
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {preset}s
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label="Editar tiempo de descanso"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "9999px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: editing ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Pencil size={10} aria-hidden="true" />
            Editar
          </button>
        </div>

        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = Number.parseInt(editInput, 10);
              if (Number.isFinite(parsed) && parsed > 0) {
                applyCustomSeconds(parsed);
              }
            }}
            style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}
          >
            <input
              type="number"
              min={10}
              max={600}
              step={5}
              value={editInput}
              onChange={(e) => setEditInput(e.target.value)}
              aria-label="Segundos de descanso personalizados"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "6px 10px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.45)",
                color: "#FFFFFF",
                fontSize: "12px",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "6px 12px",
                borderRadius: "10px",
                border: "none",
                background: "#D70015",
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Aplicar
            </button>
          </form>
        )}

        <div style={actionsStyle}>
          <button
            type="button"
            onClick={() => finish(false)}
            style={skipButtonStyle}
          >
            {REST_TIMER_LABELS.skipLabel}
          </button>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label={REST_TIMER_LABELS.minimizeAriaLabel}
            style={barButtonStyle}
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

const scrimStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: Z_INDEX.sheet,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: SCRIM.modal,
};

const cardStyle: CSSProperties = {
  position: "relative",
  width: "18rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: SPACE.md,
  padding: SPACE.lg,
  borderRadius: RADIUS.card,
  background: SURFACE.overlay,
  border: `1px solid ${GLASS.borderStrong}`,
  boxShadow: GLASS.shadow,
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: SPACE.sm,
  right: SPACE.sm,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: MOTION.minTouchTarget,
  minHeight: MOTION.minTouchTarget,
  borderRadius: RADIUS.control,
  border: "none",
  background: "transparent",
  color: TEXT.tertiary,
  cursor: "pointer",
};

const captionStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
  color: TEXT.disabled,
};

const ringWrapStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "8rem",
  height: "8rem",
};

const ringStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  transform: "rotate(-90deg)",
};

const numeralStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/** The clock face: mono figures, so a second turning over never shifts the layout. */
const numeralTextStyle: CSSProperties = {
  fontFamily: TYPE.mono.font,
  fontSize: TYPE.title2.size,
  fontWeight: TYPE.mono.weight,
  fontVariantNumeric: "tabular-nums",
  color: TEXT.primary,
};

const controlsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: SPACE.sm,
  flexWrap: "wrap",
};

const controlButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: SPACE.xs,
  minHeight: MOTION.minTouchTarget,
  padding: `0 ${SPACE.md}`,
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.secondary,
  fontSize: TYPE.subhead.size,
  cursor: "pointer",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: SPACE.sm,
  alignSelf: "stretch",
};

const skipButtonStyle: CSSProperties = {
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: MOTION.minTouchTarget,
  borderRadius: RADIUS.control,
  border: "none",
  background: ACCENT.base,
  color: TEXT.onAccent,
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.subhead.weight,
  cursor: "pointer",
};

const barButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: MOTION.minTouchTarget,
  minHeight: MOTION.minTouchTarget,
  borderRadius: RADIUS.control,
  border: "none",
  background: "transparent",
  color: TEXT.secondary,
  cursor: "pointer",
  flexShrink: 0,
};

/** The minimized rest: a bar above the navigation, not a screen. */
const barStyle: CSSProperties = {
  position: "fixed",
  bottom: "5rem",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: Z_INDEX.sheet,
  display: "flex",
  alignItems: "center",
  gap: SPACE.xs,
  padding: `${SPACE.xs} ${SPACE.sm}`,
  borderRadius: RADIUS.pill,
  background: GLASS.fillRaised,
  backdropFilter: "blur(20px) saturate(160%)",
  WebkitBackdropFilter: "blur(20px) saturate(160%)",
  border: `1px solid ${GLASS.borderStrong}`,
  boxShadow: GLASS.shadow,
};

const barTimeStyle: CSSProperties = {
  fontFamily: TYPE.mono.font,
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.mono.weight,
  fontVariantNumeric: "tabular-nums",
  color: TEXT.primary,
  padding: `0 ${SPACE.sm}`,
};
