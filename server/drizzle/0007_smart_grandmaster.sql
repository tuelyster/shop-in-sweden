CREATE TABLE `lost_deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`max_litres` real,
	`amount_sek` real NOT NULL,
	`valid_from` text NOT NULL,
	`source` text NOT NULL
);
