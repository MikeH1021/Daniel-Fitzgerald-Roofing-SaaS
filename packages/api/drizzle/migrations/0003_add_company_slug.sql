ALTER TABLE `companies` ADD `slug` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_companies_slug` ON `companies`(`slug`);