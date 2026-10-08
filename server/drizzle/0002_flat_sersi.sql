CREATE TABLE `vehicle_defaults` (
	`energy_type` text PRIMARY KEY NOT NULL,
	`consumption_per_100_km` real NOT NULL,
	`consumption_source` text NOT NULL,
	`energy_price_dkk` real NOT NULL,
	`price_source` text NOT NULL,
	`price_date` text NOT NULL
);
