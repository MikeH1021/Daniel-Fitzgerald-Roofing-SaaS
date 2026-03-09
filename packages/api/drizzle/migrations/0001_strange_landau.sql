CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`consent_given` integer NOT NULL,
	`consent_text` text NOT NULL,
	`sqft` real NOT NULL,
	`pitch` text NOT NULL,
	`material` text NOT NULL,
	`estimate_low` real NOT NULL,
	`estimate_high` real NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
