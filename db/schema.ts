import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  subscriptionStatus: text("subscription_status").notNull().default("free"),
  ...timestamps,
});

export const playerProfiles = sqliteTable("player_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  skillLevel: text("skill_level").notNull(),
  dominantHand: text("dominant_hand").notNull(),
  goalsJson: text("goals_json").notNull(),
  weaknessesJson: text("weaknesses_json").notNull(),
  playFrequency: text("play_frequency").notNull(),
  ...timestamps,
});

export const shotTypes = sqliteTable("shot_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  family: text("family").notNull(),
  modelStatus: text("model_status").notNull(),
});

export const mechanics = sqliteTable("mechanics", {
  id: text("id").primaryKey(),
  shotTypeId: text("shot_type_id").notNull().references(() => shotTypes.id),
  name: text("name").notNull(),
  weight: real("weight").notNull(),
  benchmarkJson: text("benchmark_json"),
  coachingCue: text("coaching_cue").notNull(),
});

export const drills = sqliteTable("drills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shotTypesJson: text("shot_types_json").notNull(),
  minutes: integer("minutes").notNull(),
  targetReps: integer("target_reps").notNull(),
  difficulty: text("difficulty").notNull(),
  instruction: text("instruction").notNull(),
  successStandard: text("success_standard").notNull(),
});

export const practiceSessions = sqliteTable("practice_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  shotTypeId: text("shot_type_id").notNull().references(() => shotTypes.id),
  drillId: text("drill_id").references(() => drills.id),
  durationSeconds: real("duration_seconds").notNull(),
  plannedMinutes: integer("planned_minutes").notNull(),
  averageScore: integer("average_score").notNull(),
  consistencyScore: integer("consistency_score").notNull(),
  improvementScore: integer("improvement_score").notNull(),
  rawVideoStored: integer("raw_video_stored", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const reps = sqliteTable("reps", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => practiceSessions.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  detectedShotTypeId: text("detected_shot_type_id").notNull().references(() => shotTypes.id),
  manualShotTypeId: text("manual_shot_type_id").references(() => shotTypes.id),
  score: integer("score").notNull(),
  contactTimeMs: real("contact_time_ms").notNull(),
  detectionConfidence: real("detection_confidence").notNull(),
  classificationConfidence: real("classification_confidence").notNull(),
  metricsJson: text("metrics_json").notNull(),
  contactFrameUrl: text("contact_frame_url"),
  deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const mechanicScores = sqliteTable("mechanic_scores", {
  id: text("id").primaryKey(),
  repId: text("rep_id").notNull().references(() => reps.id, { onDelete: "cascade" }),
  mechanicId: text("mechanic_id").notNull().references(() => mechanics.id),
  score: integer("score").notNull(),
  issue: text("issue"),
  correction: text("correction"),
});

export const shotScores = sqliteTable("shot_scores", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shotTypeId: text("shot_type_id").notNull().references(() => shotTypes.id),
  score: integer("score").notNull(),
  sampleSize: integer("sample_size").notNull(),
  measuredAt: text("measured_at").notNull(),
});

export const recommendations = sqliteTable("recommendations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceSessionId: text("source_session_id").references(() => practiceSessions.id),
  drillId: text("drill_id").notNull().references(() => drills.id),
  mechanicId: text("mechanic_id").references(() => mechanics.id),
  reason: text("reason").notNull(),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});

export const practicePlans = sqliteTable("practice_plans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: text("week_start").notNull(),
  taskJson: text("task_json").notNull(),
  completionPercent: integer("completion_percent").notNull().default(0),
  ...timestamps,
});

export const progressMetrics = sqliteTable("progress_metrics", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  metric: text("metric").notNull(),
  scopeId: text("scope_id"),
  value: real("value").notNull(),
  measuredAt: text("measured_at").notNull(),
});

export const referencePlayers = sqliteTable("reference_players", {
  id: text("id").primaryKey(),
  publicLabel: text("public_label").notNull(),
  status: text("status").notNull().default("provisional"),
});

export const referenceShots = sqliteTable("reference_shots", {
  id: text("id").primaryKey(),
  referencePlayerId: text("reference_player_id").notNull().references(() => referencePlayers.id),
  shotTypeId: text("shot_type_id").notNull().references(() => shotTypes.id),
  benchmarkJson: text("benchmark_json").notNull(),
});

export const referenceReps = sqliteTable("reference_reps", {
  id: text("id").primaryKey(),
  referenceShotId: text("reference_shot_id").notNull().references(() => referenceShots.id),
  metricsJson: text("metrics_json").notNull(),
  sourceConsentId: text("source_consent_id"),
});

export const referenceMatches = sqliteTable("reference_matches", {
  id: text("id").primaryKey(),
  repId: text("rep_id").notNull().references(() => reps.id, { onDelete: "cascade" }),
  referenceRepId: text("reference_rep_id").notNull().references(() => referenceReps.id),
  similarity: real("similarity").notNull(),
  comparisonJson: text("comparison_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const achievements = sqliteTable("achievements", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  unlockedAt: text("unlocked_at").notNull(),
});

export const userFeedback = sqliteTable("user_feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: text("session_id").references(() => practiceSessions.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});
