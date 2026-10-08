CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`start_month_day` text NOT NULL,
	`end_month_day` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `crossing_fees` ADD `agreement` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `crossing_fees` ADD `season` text;--> statement-breakpoint
ALTER TABLE `crossing_fees` ADD `bracket` text;