CREATE TABLE `auth_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`email` text NOT NULL UNIQUE,
	`password` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users_table` ADD `name` text NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	CONSTRAINT `fk_users_table_id_auth_table_id_fk` FOREIGN KEY (`id`) REFERENCES `auth_table`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_users_table`(`id`) SELECT `id` FROM `users_table`;--> statement-breakpoint
DROP TABLE `users_table`;--> statement-breakpoint
ALTER TABLE `__new_users_table` RENAME TO `users_table`;--> statement-breakpoint
PRAGMA foreign_keys=ON;