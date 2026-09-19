export type ShotTypeId =
  | "forehand-dink"
  | "backhand-dink"
  | "forehand-drive"
  | "backhand-drive"
  | "forehand-volley"
  | "backhand-volley"
  | "reset"
  | "third-shot-drop"
  | "serve"
  | "return"
  | "speed-up"
  | "overhead"
  | "roll-volley"
  | "block"
  | "lob";

export type MechanicId =
  | "kneeBend"
  | "contactHeight"
  | "elbowExtension"
  | "headStability"
  | "followThrough"
  | "shoulderTurn"
  | "contactInFront"
  | "weightTransfer"
  | "compactSwing"
  | "paddleStability"
  | "stanceWidth"
  | "torsoControl"
  | "reach"
  | "load"
  | "finishHeight";

export type MechanicDefinition = {
  id: MechanicId;
  label: string;
  weight: number;
  cue: string;
};

export type ShotDefinition = {
  id: ShotTypeId;
  name: string;
  shortName: string;
  icon: string;
  family: "soft" | "groundstroke" | "volley" | "serve-return" | "offense" | "defense";
  status: "active" | "planned";
  description: string;
  mechanics: MechanicDefinition[];
};

const M = (
  id: MechanicId,
  label: string,
  weight: number,
  cue: string,
): MechanicDefinition => ({ id, label, weight, cue });

const DINK_MECHANICS: MechanicDefinition[] = [
  M("kneeBend", "Knee bend", 0.25, "Sit into an athletic base and keep your level through contact."),
  M("contactHeight", "Contact height", 0.25, "Let the ball drop below hip height and meet it in front."),
  M("elbowExtension", "Arm structure", 0.2, "Create space from your body and use a quiet, long arm."),
  M("headStability", "Head stability", 0.15, "Keep your eyes level and chest quiet through the ball."),
  M("followThrough", "Follow-through", 0.15, "Guide the paddle a short distance toward the target."),
];

export const SHOT_CATALOG: ShotDefinition[] = [
  { id: "forehand-dink", name: "Forehand Dink", shortName: "FH Dink", icon: "↗", family: "soft", status: "active", description: "Quiet touch and repeatable shape at the kitchen.", mechanics: DINK_MECHANICS },
  { id: "backhand-dink", name: "Backhand Dink", shortName: "BH Dink", icon: "↖", family: "soft", status: "active", description: "Stable face and clean spacing on the backhand side.", mechanics: DINK_MECHANICS },
  { id: "forehand-drive", name: "Forehand Drive", shortName: "FH Drive", icon: "➜", family: "groundstroke", status: "planned", description: "Athletic load, contact in front, and balanced finish.", mechanics: [M("load", "Athletic load", .22, "Load through the outside leg."), M("shoulderTurn", "Shoulder turn", .2, "Turn as one unit."), M("contactInFront", "Contact in front", .25, "Meet the ball ahead of the lead hip."), M("weightTransfer", "Weight transfer", .18, "Move through the ball."), M("followThrough", "Finish", .15, "Finish on balance.")] },
  { id: "backhand-drive", name: "Backhand Drive", shortName: "BH Drive", icon: "←", family: "groundstroke", status: "planned", description: "Compact preparation and strong contact spacing.", mechanics: [M("load", "Athletic load", .2, "Load before the bounce."), M("shoulderTurn", "Shoulder turn", .22, "Show your shoulder to the ball."), M("contactInFront", "Contact in front", .25, "Reach contact before the lead hip."), M("weightTransfer", "Weight transfer", .18, "Drive from the ground."), M("followThrough", "Finish", .15, "Finish without falling away.")] },
  { id: "forehand-volley", name: "Forehand Volley", shortName: "FH Volley", icon: "◆", family: "volley", status: "planned", description: "Compact punch with a stable paddle face.", mechanics: [M("kneeBend", "Ready base", .2, "Stay loaded."), M("compactSwing", "Compact swing", .3, "Punch, do not wind up."), M("contactInFront", "Contact in front", .25, "Catch it in front."), M("paddleStability", "Paddle stability", .25, "Hold the face through contact.")] },
  { id: "backhand-volley", name: "Backhand Volley", shortName: "BH Volley", icon: "◇", family: "volley", status: "planned", description: "Firm structure and early contact at the kitchen.", mechanics: [M("kneeBend", "Ready base", .2, "Stay loaded."), M("compactSwing", "Compact swing", .3, "Keep the hand in front."), M("contactInFront", "Contact in front", .25, "Reach before the body."), M("paddleStability", "Paddle stability", .25, "Keep the wrist quiet.")] },
  { id: "reset", name: "Reset", shortName: "Reset", icon: "⌁", family: "defense", status: "planned", description: "Absorb pace and land the ball softly in the kitchen.", mechanics: [M("kneeBend", "Base height", .25, "Get below the ball."), M("contactInFront", "Contact in front", .2, "Create space before contact."), M("paddleStability", "Paddle face", .25, "Hold a quiet face."), M("torsoControl", "Body control", .2, "Stop the body before contact."), M("followThrough", "Soft finish", .1, "Finish short and calm.")] },
  { id: "third-shot-drop", name: "Third-Shot Drop", shortName: "3rd Drop", icon: "③", family: "soft", status: "planned", description: "Lift with margin and land the ball in the kitchen.", mechanics: [M("kneeBend", "Leg lift", .22, "Lift from the legs."), M("contactHeight", "Contact height", .2, "Let the ball enter your strike zone."), M("contactInFront", "Contact in front", .22, "Meet it in front."), M("headStability", "Head stability", .16, "Stay down through contact."), M("followThrough", "Target finish", .2, "Finish toward the kitchen.")] },
  { id: "serve", name: "Serve", shortName: "Serve", icon: "↑", family: "serve-return", status: "planned", description: "Legal-looking low-to-high motion with depth and balance.", mechanics: [M("stanceWidth", "Stable stance", .15, "Build a balanced base."), M("load", "Athletic load", .2, "Load before accelerating."), M("contactInFront", "Contact in front", .25, "Strike in front of the lead hip."), M("weightTransfer", "Weight transfer", .2, "Move forward through contact."), M("finishHeight", "Finish height", .2, "Finish up and through the target.")] },
  { id: "return", name: "Return", shortName: "Return", icon: "↓", family: "serve-return", status: "planned", description: "Balanced groundstroke with time to move forward.", mechanics: [M("load", "Split and load", .2, "Land the split before the bounce."), M("shoulderTurn", "Preparation", .2, "Turn early."), M("contactInFront", "Contact in front", .25, "Take it ahead of the body."), M("weightTransfer", "Forward balance", .2, "Finish moving toward the kitchen."), M("followThrough", "Finish", .15, "Extend through the target.")] },
  { id: "speed-up", name: "Speed-Up", shortName: "Speed-Up", icon: "⚡", family: "offense", status: "planned", description: "Disguise, compact acceleration, and recovery.", mechanics: [M("kneeBend", "Low base", .15, "Stay in your dink posture."), M("compactSwing", "Disguise", .3, "Use the same setup as a dink."), M("contactInFront", "Contact point", .25, "Catch it out front."), M("paddleStability", "Paddle control", .15, "Control the face."), M("followThrough", "Recovery", .15, "Finish compact and reload.")] },
  { id: "overhead", name: "Overhead", shortName: "Overhead", icon: "☄", family: "offense", status: "planned", description: "Early preparation, reach, and balanced power.", mechanics: [M("shoulderTurn", "Side turn", .2, "Turn and point early."), M("load", "Load", .15, "Set the feet under the ball."), M("reach", "Reach", .3, "Contact at full comfortable extension."), M("contactInFront", "Contact in front", .2, "Strike slightly in front."), M("followThrough", "Finish", .15, "Finish across on balance.")] },
  { id: "roll-volley", name: "Roll Volley", shortName: "Roll Volley", icon: "⟳", family: "volley", status: "planned", description: "Low base, brushing path, and compact recovery.", mechanics: [M("kneeBend", "Low base", .2, "Get under the ball."), M("contactInFront", "Contact in front", .25, "Reach into the volley."), M("compactSwing", "Compact path", .2, "Keep the path small."), M("finishHeight", "Brush finish", .2, "Finish slightly up."), M("headStability", "Head stability", .15, "Stay quiet through contact.")] },
  { id: "block", name: "Block", shortName: "Block", icon: "▣", family: "defense", status: "planned", description: "Stable base, quiet hands, and clean absorption.", mechanics: [M("kneeBend", "Ready base", .25, "Stay low and square."), M("paddleStability", "Quiet face", .3, "Hold the paddle in front."), M("compactSwing", "No backswing", .25, "Let the ball supply the pace."), M("torsoControl", "Body control", .2, "Stay balanced through impact.")] },
  { id: "lob", name: "Lob", shortName: "Lob", icon: "⌒", family: "offense", status: "planned", description: "Disguised setup and controlled upward extension.", mechanics: [M("kneeBend", "Low setup", .2, "Start from your normal dink base."), M("compactSwing", "Disguise", .2, "Hide the intent."), M("contactHeight", "Contact height", .2, "Contact under the ball."), M("finishHeight", "Lift", .25, "Extend upward through the target."), M("headStability", "Balance", .15, "Stay centered as you lift.")] },
];

export type BenchmarkProfile = {
  id: string;
  label: string;
  shotType: ShotTypeId;
  status: "provisional";
  targets: Partial<Record<MechanicId, { min: number; max: number; unit: "degrees" | "ratio" }>>;
};

export const BENCHMARKS: BenchmarkProfile[] = [
  {
    id: "elite-reference-a-forehand-dink",
    label: "Elite Reference A",
    shotType: "forehand-dink",
    status: "provisional",
    targets: {
      kneeBend: { min: 130, max: 155, unit: "degrees" },
      contactHeight: { min: -0.05, max: 0.75, unit: "ratio" },
      elbowExtension: { min: 140, max: 170, unit: "degrees" },
      headStability: { min: 0, max: 0.34, unit: "ratio" },
      followThrough: { min: 0.16, max: 0.52, unit: "ratio" },
    },
  },
  {
    id: "elite-reference-b-backhand-dink",
    label: "Elite Reference B",
    shotType: "backhand-dink",
    status: "provisional",
    targets: {
      kneeBend: { min: 128, max: 154, unit: "degrees" },
      contactHeight: { min: -0.08, max: 0.72, unit: "ratio" },
      elbowExtension: { min: 138, max: 172, unit: "degrees" },
      headStability: { min: 0, max: 0.36, unit: "ratio" },
      followThrough: { min: 0.14, max: 0.5, unit: "ratio" },
    },
  },
];

export type DrillDefinition = {
  id: string;
  name: string;
  shotTypes: ShotTypeId[];
  minutes: number;
  reps: number;
  difficulty: "Foundation" | "Build" | "Pressure";
  instruction: string;
  success: string;
};

export const DRILLS: DrillDefinition[] = [
  { id: "dink-shape-20", name: "Dink Shape 20", shotTypes: ["forehand-dink", "backhand-dink"], minutes: 8, reps: 20, difficulty: "Foundation", instruction: "Alternate crosscourt dinks from a quiet, low base.", success: "16 of 20 land softly beyond the kitchen midpoint." },
  { id: "contact-window", name: "Contact Window", shotTypes: ["forehand-dink", "backhand-dink"], minutes: 10, reps: 24, difficulty: "Build", instruction: "Pause in ready position, then meet every ball below the hip and in front.", success: "Average 75+ for contact height and arm structure." },
  { id: "pressure-ladder", name: "Pressure Ladder", shotTypes: ["forehand-dink", "backhand-dink"], minutes: 12, reps: 30, difficulty: "Pressure", instruction: "Complete sets of 5, 10, then 15 without a popup.", success: "Finish the ladder with 80% mechanics consistency." },
  { id: "soft-hands-reset", name: "Soft Hands Reset", shotTypes: ["reset"], minutes: 10, reps: 20, difficulty: "Build", instruction: "Absorb transition-zone feeds into a wide kitchen target.", success: "14 of 20 resets land unattackable." },
  { id: "deep-serve-12", name: "Deep Serve 12", shotTypes: ["serve"], minutes: 8, reps: 12, difficulty: "Foundation", instruction: "Serve with safe net margin into the final three feet.", success: "9 of 12 land deep and in." },
];

export const PRICING = { monthly: 9.99, yearly: 59.99, currency: "USD" } as const;

export const ANALYTICS_EVENTS = [
  "onboarding_started", "onboarding_completed", "practice_started", "video_selected",
  "analysis_started", "rep_detected", "rep_deleted", "rep_reclassified", "session_completed",
  "drill_opened", "drill_completed", "reference_opened", "paywall_opened", "subscription_selected",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
