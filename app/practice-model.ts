import type { MechanicId, ShotTypeId } from "./product-config";
import type { RepResult, SubScores } from "./pose-analysis";

export type DominantHand = "right" | "left";
export type LiveCoachingMode = "off" | "important" | "every-few" | "frequent";
export type SessionLength = 5 | 10 | 15 | 30 | 0;

export type OnboardingAnswers = {
  level: string;
  dominantHand: DominantHand | "";
  goals: string[];
  blockers: string[];
  frequency: string;
};

export type PracticeSession = {
  id: string;
  createdAt: string;
  shotType: ShotTypeId;
  drillId: string;
  duration: number;
  plannedMinutes: SessionLength;
  handedness: DominantHand;
  reps: RepResult[];
  average: number;
  consistency: number;
  best: number;
  worst: number;
  subScores: SubScores;
  weakest: keyof SubScores;
  improvement: number;
};

export type PlayerSettings = {
  liveCoaching: LiveCoachingMode;
  saveContactFrames: boolean;
  developerMode: boolean;
};

export type PlayerProgress = {
  totalSessions: number;
  totalReps: number;
  overallFormRating: number | null;
  trend: number;
  weakestMechanic: MechanicId | null;
  strongestMechanic: MechanicId | null;
};

export const DEFAULT_ONBOARDING: OnboardingAnswers = {
  level: "",
  dominantHand: "",
  goals: [],
  blockers: [],
  frequency: "",
};

export const DEFAULT_SETTINGS: PlayerSettings = {
  liveCoaching: "important",
  saveContactFrames: true,
  developerMode: false,
};
