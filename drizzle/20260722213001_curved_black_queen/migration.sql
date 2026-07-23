CREATE TABLE `belonging_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`group_id` integer NOT NULL,
	`user_id` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `groups_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`email` text NOT NULL UNIQUE,
	`password` text NOT NULL
);
