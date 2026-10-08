CREATE TABLE `crossing_fees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`crossing_id` text NOT NULL,
	`kind` text NOT NULL,
	`price_dkk` real NOT NULL,
	`valid_from` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`crossing_id`) REFERENCES `crossings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `crossings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `destinations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`crossing_id` text NOT NULL,
	FOREIGN KEY (`crossing_id`) REFERENCES `crossings`(`id`) ON UPDATE no action ON DELETE no action
);
