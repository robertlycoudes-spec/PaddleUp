import { DRILLS, SHOT_CATALOG, type MechanicId, type ShotTypeId } from "./product-config";
import type { PracticeSession } from "./practice-model";
import type { RepResult, SubScores } from "./pose-analysis";

export const MECHANIC_LABELS: Record<keyof SubScores, string> = {
  kneeBend: "Knee bend",
  contactHeight: "Contact height",
  elbowExtension: "Arm structure",
  headStability: "Head stability",
  followThrough: "Follow-through",
};

export const CORRECTIONS: Record<keyof SubScores, { issue: string; correction: string; cue: string }> = {
  kneeBend: { issue: "Base is too tall", correction: "Lower before the ball arrives and keep your hips level through contact.", cue: "Sit, then strike." },
  contactHeight: { issue: "Contact window drifts", correction: "Let the ball enter a comfortable window below your hip and meet it in front.", cue: "Low and in front." },
  elbowExtension: { issue: "Arm crowds the body", correction: "Create a paddle-width of space and guide with a long, quiet arm.", cue: "Make space." },
  headStability: { issue: "Head moves through contact", correction: "Keep your eyes level and chest quiet until the ball leaves the paddle.", cue: "Quiet head." },
  followThrough: { issue: "Finish changes rep to rep", correction: "Send the paddle a short distance toward the target, then stop under control.", cue: "Short, calm finish." },
};

export function shotDefinition(id: ShotTypeId) {
  return SHOT_CATALOG.find((shot) => shot.id === id) ?? SHOT_CATALOG[0];
}

export function weakestMechanic(scores: SubScores): keyof SubScores {
  return (Object.keys(scores) as Array<keyof SubScores>).reduce((weakest, key) =>
    scores[key] < scores[weakest] ? key : weakest,
  );
}

export function coachingFor(scores: SubScores) {
  const mechanic = weakestMechanic(scores);
  return { mechanic, ...CORRECTIONS[mechanic] };
}

export function recommendDrill(shotType: ShotTypeId, scores?: SubScores) {
  const mechanic = scores ? weakestMechanic(scores) : null;
  if (mechanic === "contactHeight" || mechanic === "elbowExtension") {
    return DRILLS.find((drill) => drill.id === "contact-window")!;
  }
  return DRILLS.find((drill) => drill.shotTypes.includes(shotType)) ?? DRILLS[0];
}

export function sessionProgress(sessions: PracticeSession[]) {
  const active = sessions.filter((session) => session.reps.some((rep) => !rep.deleted));
  if (!active.length) return { totalSessions: 0, totalReps: 0, overallFormRating: null, trend: 0, weakestMechanic: null, strongestMechanic: null };
  const recent = active.slice(0, 3);
  const older = active.slice(3, 6);
  const recentAverage = recent.reduce((sum, item) => sum + item.average, 0) / recent.length;
  const olderAverage = older.length ? older.reduce((sum, item) => sum + item.average, 0) / older.length : recentAverage;
  const mechanics = averageSessionMechanics(active);
  const keys = Object.keys(mechanics) as Array<keyof SubScores>;
  return {
    totalSessions: active.length,
    totalReps: active.reduce((sum, session) => sum + session.reps.filter((rep) => !rep.deleted).length, 0),
    overallFormRating: Math.round(active.reduce((sum, item) => sum + item.average, 0) / active.length),
    trend: Math.round(recentAverage - olderAverage),
    weakestMechanic: keys.reduce((a, b) => mechanics[a] < mechanics[b] ? a : b) as MechanicId,
    strongestMechanic: keys.reduce((a, b) => mechanics[a] > mechanics[b] ? a : b) as MechanicId,
  };
}

function averageSessionMechanics(sessions: PracticeSession[]): SubScores {
  const keys = Object.keys(sessions[0].subScores) as Array<keyof SubScores>;
  return Object.fromEntries(keys.map((key) => [key, Math.round(sessions.reduce((sum, session) => sum + session.subScores[key], 0) / sessions.length)])) as SubScores;
}

export function applyRepCorrection(rep: RepResult, shotType: ShotTypeId): RepResult {
  return { ...rep, manualShotType: shotType, classificationSource: "manual", classificationConfidence: 1 };
}
