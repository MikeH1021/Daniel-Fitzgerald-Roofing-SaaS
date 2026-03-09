CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`logo_url` text,
	`primary_color` text DEFAULT '#2563eb',
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE TABLE `pricing_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`material_key` text NOT NULL,
	`cost_low` real,
	`cost_high` real,
	`pitch_flat` real,
	`pitch_low` real,
	`pitch_medium` real,
	`pitch_steep` real,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
