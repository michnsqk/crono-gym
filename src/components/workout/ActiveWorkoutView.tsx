/**
 * ActiveWorkoutView.tsx — the immersive workout screen, with top-bar chrome and a
 * save-first finish flow.
 *
 * Wraps `ActiveWorkout` and adds:
 *  - Top bar: session clock, settings, "Terminar"
 *  - "Terminar" opens `WorkoutSummaryModal` instead of ending outright
 *  - The session ends only when the summary is saved or dismissed, so the
 *    summary survives the finish
 *  - Summary modal saves via `queueAndSync` (workout_logs + completed_sets)
 */

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PlannedExercise } from "../../hooks/useGymData";
import type { DraftExercise } from "../../lib/offlineStore";
import { useActiveSession } from "../../context/ActiveSessionContext";
import { HOME_PATH } from "../shell/navItems";
import { ActiveWorkout } from "../ActiveWorkout";
import { ErrorBoundary } from "../ErrorBoundary";
import { WorkoutSummaryModal } from "./WorkoutSummaryModal";

export interface ActiveWorkoutViewProps {
  userId: string;
  routineId: string | null;
  routineTitle: string;
  planned: PlannedExercise[];
  onFinished: () => void;
}

export function ActiveWorkoutView({
  userId,
  routineId,
  routineTitle,
  planned,
  onFinished: onLeftWorkout,
}: ActiveWorkoutViewProps) {
  const { session, end } = useActiveSession();
  const navigate = useNavigate();
  const [summaryOpen, setSummaryOpen] = useState(false);
  /**
   * The session exactly as it was finished.
   *
   * The logger is the only component that ever held these rows, so the summary
   * would otherwise render a session of zero sets and zero volume. They arrive
   * once and stay: the summary is read-only from here on.
   */
  const [finishedExercises, setFinishedExercises] = useState<readonly DraftExercise[]>([]);

  const startedAt = session?.startedAt ?? new Date().toISOString();
  const completedAt = new Date().toISOString();

  const handleFinish = useCallback((exercises: readonly DraftExercise[]) => {
    setFinishedExercises(exercises);
    setSummaryOpen(true);
  }, []);

  /**
   * Leaves the workout.
   *
   * The logger no longer ends the session when the last set is logged -- doing
   * so unmounted this screen (and the summary) from `TrainView` before the
   * summary could paint. The session ends here instead: on save, on `LISTO`, or
   * on dismissal. All three are the athlete leaving the workout for good, and
   * all three land on the home screen rather than on the training route, which
   * would otherwise render the home view anyway and leave the URL lying about
   * where the athlete is.
   */
  const handleLeave = useCallback(() => {
    setSummaryOpen(false);
    end();
    onLeftWorkout();
    navigate(HOME_PATH, { replace: true });
  }, [end, onLeftWorkout, navigate]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <ErrorBoundary>
        <ActiveWorkout
          userId={userId}
          routineId={routineId}
          routineTitle={routineTitle}
          planned={planned}
          onFinished={handleFinish}
        />
      </ErrorBoundary>

      <WorkoutSummaryModal
        isOpen={summaryOpen}
        onClose={handleLeave}
        routineTitle={routineTitle}
        startedAt={startedAt}
        completedAt={completedAt}
        exercises={finishedExercises}
        userId={userId}
        routineId={routineId}
        onSaved={handleLeave}
        onDone={handleLeave}
      />
    </div>
  );
}
