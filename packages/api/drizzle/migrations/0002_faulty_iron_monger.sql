CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `address` text;