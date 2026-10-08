CREATE TABLE `basket_items` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`match_rule` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_run_id` integer NOT NULL,
	`date` text NOT NULL,
	`sek_to_dkk` real NOT NULL,
	`source` text NOT NULL,
	`imported_at` text NOT NULL,
	FOREIGN KEY (`import_run_id`) REFERENCES `import_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text NOT NULL,
	`outcome` text NOT NULL,
	`observation_count` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `price_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_run_id` integer NOT NULL,
	`source` text NOT NULL,
	`retailer_id` text NOT NULL,
	`store_id` text,
	`product_id` text NOT NULL,
	`product_text` text NOT NULL,
	`found_by` text DEFAULT '[]' NOT NULL,
	`price` real NOT NULL,
	`currency` text NOT NULL,
	`pieces` real,
	`size` real,
	`unit` text,
	`deposit` real,
	`kind` text NOT NULL,
	`member_only` integer DEFAULT false NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`imported_at` text NOT NULL,
	FOREIGN KEY (`import_run_id`) REFERENCES `import_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `retailers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`member_offer_phrases` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`retailer_id` text NOT NULL,
	`destination_id` text NOT NULL,
	`name` text NOT NULL,
	`tjek_dealer_id` text,
	`tjek_store_id` text,
	`willys_store_id` text,
	FOREIGN KEY (`retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE no action
);
