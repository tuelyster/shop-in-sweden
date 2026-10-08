CREATE TABLE `postcode_distances` (
	`postcode` text NOT NULL,
	`name` text NOT NULL,
	`destination_id` text NOT NULL,
	`km` real NOT NULL,
	PRIMARY KEY(`postcode`, `destination_id`),
	FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE no action
);
