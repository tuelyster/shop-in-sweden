CREATE TABLE `petrol_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_run_id` integer NOT NULL,
	`country` text NOT NULL,
	`price_per_litre` real NOT NULL,
	`currency` text NOT NULL,
	`price_eur` real NOT NULL,
	`date` text NOT NULL,
	`source` text NOT NULL,
	`imported_at` text NOT NULL,
	FOREIGN KEY (`import_run_id`) REFERENCES `import_runs`(`id`) ON UPDATE no action ON DELETE no action
);
