/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Profile } from "@/lib/profile";
import type { DashboardSession } from "@/lib/dashboard/dashboardMetrics";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import { DashboardPage } from "./DashboardPage";

const mockStart = vi.fn();
const mockNavigate = vi.fn();
const mockEnd = vi.fn();

const mockAnnouncements = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());

const FIXED_NOW = new Date("2026-10-05T12:00:00").getTime();

const mockState = vi.hoisted(() => {
  const profile: Profile = {
    user_id: "user-1",
    display_name: "Test",
    birth_date: null,
    sex: null,
    height_cm: null,
    weight_kg: null,
    unit_system: "metric",
    experience_level: "beginner",
    activity_level: "moderate",
    goal: "maintain",
    guardian_consent_at: null,
    onboarding_completed_at: "2026-01-01T00:00:00Z",
  };

  const routine: RoutineWithExercises = {
    id: "r-1",
    title: "Full Body",
    exercises: [
      {
        exercise: {
          id: "e-1",
          name: "Squat",
          body_part: "quads",
          target: "quadriceps",
          equipment: "barbell",
          gif_url: "",
          instructions: ["stand", "squat"],
          name_es: null,
          is_active: true,
          is_hidden: false,
        },
        target_sets: 3,
        rest_seconds: 90,
        rowId: "row-e1",
        order_index: 0,
        target_reps_min: null,
        target_reps_max: null,
        dayIndex: 0,
        dayLabel: "Pecho",
      },
    ],
    is_favorite: false,
    user_id: "user-1",
    description: null,
    created_at: "2026-01-01T00:00:00Z",
    source: "user",
    authored_by_coach: null,
    is_template: false,
  };

  const session: DashboardSession = {
    id: "s-1",
    startedAt: "2026-10-03T10:00:00",
    completedAt: "2026-10-03T10:45:00",
    routineId: "r-1",
    routineTitle: "Full Body",
    sets: [
      {
        id: "set-1",
        exerciseId: "e-1",
        exerciseName: "Squat",
        weight: 100,
        reps: 8,
        isWarmup: false,
        bodyPart: "quads",
      },
    ],
  };

  return {
    profile: profile as Profile | null,
    profileLoading: false,
    profileError: null as string | null,
    routines: [routine] as RoutineWithExercises[],
    routinesLoading: false,
    routinesError: null as string | null,
    sessions: [session] as DashboardSession[],
    sessionsLoading: false,
    sessionsError: null as string | null,
    isActive: false,
    session: null as null | {
      routineId: string | null;
      title: string;
      startedAt: string;
      routineDayId: string | null;
      dayLabel: string | null;
      planned: any[];
    },
  };
});

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mockState.profile,
    energy: null,
    loading: mockState.profileLoading,
    saving: false,
    error: mockState.profileError,
    refresh: vi.fn(),
    update: vi.fn(),
  }),
}));

vi.mock("@/hooks/useGymData", () => ({
  useRoutines: () => ({
    routines: mockState.routines,
    loading: mockState.routinesLoading,
    error: mockState.routinesError,
    refresh: vi.fn(),
    toggleFavorite: vi.fn(),
    pendingIds: new Set(),
  }),
}));

vi.mock("@/hooks/useDashboardSessions", () => ({
  useDashboardSessions: () => ({
    sessions: mockState.sessions,
    loading: mockState.sessionsLoading,
    error: mockState.sessionsError,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/context/ActiveSessionContext", () => ({
  useActiveSession: () => ({
    session: mockState.session,
    isActive: mockState.isActive,
    rehydrating: false,
    recoverableDraft: null,
    start: mockStart,
    end: mockEnd,
    restoreDraft: vi.fn(),
    discardDraft: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mockAnnouncements,
  } as any,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

afterEach(() => cleanup());

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW });
  mockSelect.mockReturnValue({
    order: () => Promise.resolve({ data: [], error: null }),
  });
  mockAnnouncements.mockReturnValue({
    select: mockSelect,
  });
  mockState.profile = {
    user_id: "user-1",
    display_name: "Test",
    birth_date: null,
    sex: null,
    height_cm: null,
    weight_kg: null,
    unit_system: "metric",
    experience_level: "beginner",
    activity_level: "moderate",
    goal: "maintain",
    guardian_consent_at: null,
    onboarding_completed_at: "2026-01-01T00:00:00Z",
  };
  mockState.profileLoading = false;
  mockState.profileError = null;
  mockState.routines = [
    {
      id: "r-1",
      title: "Full Body",
      exercises: [
        {
          exercise: {
            id: "e-1",
            name: "Squat",
            body_part: "quads",
            target: "quads",
            equipment: "barbell",
            gif_url: "",
            instructions: ["stand", "squat"],
            name_es: null,
            is_active: true,
            is_hidden: false,
          },
          target_sets: 3,
          rest_seconds: 90,
          rowId: "row-e1",
          order_index: 0,
          target_reps_min: null,
          target_reps_max: null,
          dayIndex: 0,
          dayLabel: "Pecho",
        },
      ],
      is_favorite: false,
      user_id: "user-1",
      description: null,
      created_at: "2026-01-01T00:00:00Z",
      source: "user",
      authored_by_coach: null,
      is_template: false,
    },
  ];
  mockState.routinesLoading = false;
  mockState.routinesError = null;
  mockState.sessions = [
    {
      id: "s-prior",
      startedAt: "2026-09-25T10:00:00",
      completedAt: "2026-09-25T10:45:00",
      routineId: "r-1",
      routineTitle: "Full Body",
      sets: [
        {
          id: "set-0",
          exerciseId: "e-1",
          exerciseName: "Squat",
          weight: 90,
          reps: 8,
          isWarmup: false,
          bodyPart: "quads",
        },
      ],
    },
    {
      id: "s-1",
      startedAt: "2026-10-03T10:00:00",
      completedAt: "2026-10-03T10:45:00",
      routineId: "r-1",
      routineTitle: "Full Body",
      sets: [
        {
          id: "set-1",
          exerciseId: "e-1",
          exerciseName: "Squat",
          weight: 100,
          reps: 8,
          isWarmup: false,
          bodyPart: "quads",
        },
      ],
    },
  ];
  mockState.sessionsLoading = false;
  mockState.sessionsError = null;
  mockState.isActive = false;
  mockState.session = null;
  mockStart.mockClear();
  mockNavigate.mockClear();
  mockEnd.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DashboardPage", () => {
  it("renders loading skeleton and hides the CTA while any source is loading", () => {
    mockState.profileLoading = true;

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Comenzar entrenamiento")).toBeFalsy();
    expect(screen.queryByText("Full Body")).toBeFalsy();
  });

  it("renders the hero with greeting, quest HUD and a single primary CTA", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Buenas tardes, Test/)).toBeTruthy();
    expect(screen.getByText("Empezar entrenamiento de hoy")).toBeTruthy();
    // Un solo CTA prominente primario.
    expect(screen.getAllByText("Empezar entrenamiento de hoy").length).toBe(1);
    // HUD de misiones iniciales visible con progreso factual.
    expect(screen.getByText("Completa tus 4 misiones iniciales")).toBeTruthy();
    // Ningun simbolo de mojibake en pantalla.
    expect(document.body.textContent).not.toMatch(/Ã|\uFFFD/);
  });

  it("starts a session and navigates to training when the primary CTA is clicked", () => {
    mockStart.mockReturnValue({ ok: true });
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Empezar entrenamiento de hoy"));
    expect(mockStart).toHaveBeenCalledWith({
      routine: { id: "r-1", title: "Full Body" },
      routineDayId: expect.any(String),
      dayLabel: "Pecho",
      planned: expect.arrayContaining([
        expect.objectContaining({ dayIndex: 0, dayLabel: "Pecho" }),
      ]),
    });
    expect(mockStart).toHaveBeenCalledTimes(1);
    const planned = mockStart.mock.calls[0][0].planned;
    expect(planned).toHaveLength(1); // Solo el ejercicio de hoy (Lunes/Pecho), no otros días
    expect(mockNavigate).toHaveBeenCalledWith("/entrenar");
  });

  it("día de descanso: CTA no inicia sesión cuando hoy es descanso", () => {
    mockStart.mockReturnValue({ ok: true });
    mockState.routines = [
      {
        id: "r-rest",
        title: "Rutina solo descanso",
        exercises: [],
        is_favorite: false,
        user_id: "user-1",
        description: JSON.stringify({
          v: 1,
          text: "Rutina solo descanso",
          mode: "weekly",
          days: Array.from({ length: 7 }, (_, i) => ({
            id: crypto.randomUUID(),
            order: i,
            weekday: i,
            label: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i],
            kind: "rest",
          })),
        }),
        created_at: "2026-01-01T00:00:00Z",
        source: "user",
        authored_by_coach: null,
        is_template: false,
      },
    ];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    // Hoy es Lunes (FIXED_NOW): todos los días son descanso, así que
    // el CTA principal no inicia sesión.
    const cta = screen.getByRole("button", { name: /Empezar entrenamiento de hoy/i });
    fireEvent.click(cta);
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("resumes active session and navigates to /entrenar when a session is active", () => {
    mockState.isActive = true;
    mockState.session = {
      routineId: "r-1",
      title: "Full Body",
      startedAt: "2026-10-05T10:00:00",
      routineDayId: null,
      dayLabel: null,
      planned: [],
    };

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    const cta = screen.getByRole("button", { name: /Empezar entrenamiento de hoy/i });
    fireEvent.click(cta);
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/entrenar");
  });

  it("navigates to /progreso when today's session is already completed", () => {
    mockState.sessions = [
      {
        id: "s-today",
        startedAt: "2026-10-05T10:00:00",
        completedAt: "2026-10-05T10:45:00",
        routineId: "r-1",
        routineTitle: "Full Body",
        sets: [
          {
            id: "set-1",
            exerciseId: "e-1",
            exerciseName: "Squat",
            weight: 100,
            reps: 8,
            isWarmup: false,
            bodyPart: "quads",
          },
        ],
      },
    ];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Empezar entrenamiento de hoy"));
    expect(mockNavigate).toHaveBeenCalledWith("/progreso");
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("routes to /rutinas and shows 0/4 quest progress when no routine or workout exists", () => {
    window.localStorage.clear();
    mockState.routines = [];
    mockState.sessions = [];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("0 de 4 misiones · 0 / 1000 XP")).toBeTruthy();
    fireEvent.click(screen.getByText("Empezar entrenamiento de hoy"));
    expect(mockNavigate).toHaveBeenCalledWith("/rutinas");
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("shows 1/4 quest progress when a routine exists without completed sessions", () => {
    window.localStorage.clear();
    mockState.sessions = [];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("1 de 4 misiones · 250 / 1000 XP")).toBeTruthy();
  });

  it("advances quest progress to 3/4 once a session is completed this week", () => {
    mockState.sessions = [
      {
        id: "s-today",
        startedAt: "2026-10-05T10:00:00",
        completedAt: "2026-10-05T10:45:00",
        routineId: "r-1",
        routineTitle: "Full Body",
        sets: [
          {
            id: "set-1",
            exerciseId: "e-1",
            exerciseName: "Squat",
            weight: 100,
            reps: 8,
            isWarmup: false,
            bodyPart: "quads",
          },
        ],
      },
    ];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("3 de 4 misiones · 750 / 1000 XP")).toBeTruthy();
  });

  it("renders the active announcements feed with Avisos del Gimnasio", async () => {
    mockSelect.mockReturnValue({
      order: () =>
        Promise.resolve({
          data: [
            {
              id: "a-1",
              title: "Mantenimiento del gimnasio",
              message: "El gimnasio cierra a las 22 h.",
              kind: "notice",
              starts_at: "2026-10-01T00:00:00Z",
              expires_at: "2026-10-31T23:59:59Z",
            },
          ],
          error: null,
        }),
    });

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    await act(async () => {});

    expect(screen.getByText("Mantenimiento del gimnasio")).toBeTruthy();
    expect(screen.getByText("El gimnasio cierra a las 22 h.")).toBeTruthy();
    expect(screen.getByText("Avisos del Gimnasio")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Ã|\uFFFD/);
  });

  it("hides Avisos del Gimnasio when there are no announcements", async () => {
    window.localStorage.setItem("cronos-announcements", "[]");
    mockSelect.mockReturnValue({
      order: () => Promise.resolve({ data: [], error: null }),
    });

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    await act(async () => {});

    expect(screen.queryByText("Avisos del Gimnasio")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Ã|\uFFFD/);
  });

  it("sanitizes the display name: mich_nsqk -> Mich in the greeting", () => {
    mockState.profile = {
      ...mockState.profile,
      display_name: "mich_nsqk",
    } as Profile;

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Buenas tardes, Mich/)).toBeTruthy();
  });

  it("uses dayLabel Pecho when starting a routine titled xd", () => {
    mockStart.mockReturnValue({ ok: true });
    mockState.routines = [
      {
        ...mockState.routines[0],
        title: "xd",
      },
    ];

    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Empezar entrenamiento de hoy"));
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({
        dayLabel: "Pecho",
      }),
    );
    expect(screen.queryByText("xd")).toBeFalsy();
  });

  it("opens welcome tour modal from quest 04 button", async () => {
    window.localStorage.clear();
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Domina Cronos IA y el modo Offline"));
    expect(screen.getByRole("dialog", { name: "Guía interactiva de Cronos Gym" })).toBeTruthy();
  });

  it("renders no mojibake symbols anywhere on screen", () => {
    render(
      <MemoryRouter>
        <DashboardPage userId="user-1" />
      </MemoryRouter>,
    );

    expect(document.body.textContent).not.toMatch(/Ã©|Â·|Ã³|Ã¡|Ã­|Ã±|\uFFFD/);
  });
});
