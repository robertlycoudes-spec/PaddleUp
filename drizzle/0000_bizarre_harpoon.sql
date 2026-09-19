CREATE TABLE `achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`unlocked_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `drills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`shot_types_json` text NOT NULL,
	`minutes` integer NOT NULL,
	`target_reps` integer NOT NULL,
	`difficulty` text NOT NULL,
	`instruction` text NOT NULL,
	`success_standard` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mechanic_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`rep_id` text NOT NULL,
	`mechanic_id` text NOT NULL,
	`score` integer NOT NULL,
	`issue` text,
	`correction` text,
	FOREIGN KEY (`rep_id`) REFERENCES `reps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mechanic_id`) REFERENCES `mechanics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mechanics` (
	`id` text PRIMARY KEY NOT NULL,
	`shot_type_id` text NOT NULL,
	`name` text NOT NULL,
	`weight` real NOT NULL,
	`benchmark_json` text,
	`coaching_cue` text NOT NULL,
	FOREIGN KEY (`shot_type_id`) REFERENCES `shot_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `player_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`skill_level` text NOT NULL,
	`dominant_hand` text NOT NULL,
	`goals_json` text NOT NULL,
	`weaknesses_json` text NOT NULL,
	`play_frequency` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `practice_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`task_json` text NOT NULL,
	`completion_percent` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`shot_type_id` text NOT NULL,
	`drill_id` text,
	`duration_seconds` real NOT NULL,
	`planned_minutes` integer NOT NULL,
	`average_score` integer NOT NULL,
	`consistency_score` integer NOT NULL,
	`improvement_score` integer NOT NULL,
	`raw_video_stored` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shot_type_id`) REFERENCES `shot_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`drill_id`) REFERENCES `drills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `progress_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`metric` text NOT NULL,
	`scope_id` text,
	`value` real NOT NULL,
	`measured_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_session_id` text,
	`drill_id` text NOT NULL,
	`mechanic_id` text,
	`reason` text NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`drill_id`) REFERENCES `drills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mechanic_id`) REFERENCES `mechanics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reference_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`rep_id` text NOT NULL,
	`reference_rep_id` text NOT NULL,
	`similarity` real NOT NULL,
	`comparison_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`rep_id`) REFERENCES `reps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reference_rep_id`) REFERENCES `reference_reps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reference_players` (
	`id` text PRIMARY KEY NOT NULL,
	`public_label` text NOT NULL,
	`status` text DEFAULT 'provisional' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reference_reps` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_shot_id` text NOT NULL,
	`metrics_json` text NOT NULL,
	`source_consent_id` text,
	FOREIGN KEY (`reference_shot_id`) REFERENCES `reference_shots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reference_shots` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_player_id` text NOT NULL,
	`shot_type_id` text NOT NULL,
	`benchmark_json` text NOT NULL,
	FOREIGN KEY (`reference_player_id`) REFERENCES `reference_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shot_type_id`) REFERENCES `shot_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reps` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`detected_shot_type_id` text NOT NULL,
	`manual_shot_type_id` text,
	`score` integer NOT NULL,
	`contact_time_ms` real NOT NULL,
	`detection_confidence` real NOT NULL,
	`classification_confidence` real NOT NULL,
	`metrics_json` text NOT NULL,
	`contact_frame_url` text,
	`deleted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`detected_shot_type_id`) REFERENCES `shot_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manual_shot_type_id`) REFERENCES `shot_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shot_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`shot_type_id` text NOT NULL,
	`score` integer NOT NULL,
	`sample_size` integer NOT NULL,
	`measured_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shot_type_id`) REFERENCES `shot_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shot_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`family` text NOT NULL,
	`model_status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`session_id` text,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`subscription_status` text DEFAULT 'free' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);