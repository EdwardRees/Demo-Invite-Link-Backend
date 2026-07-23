PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_belonging_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`group_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	CONSTRAINT `fk_belonging_table_group_id_groups_table_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups_table`(`id`),
	CONSTRAINT `fk_belonging_table_user_id_users_table_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users_table`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_belonging_table`(`id`, `group_id`, `user_id`) SELECT `id`, `group_id`, `user_id` FROM `belonging_table`;--> statement-breakpoint
DROP TABLE `belonging_table`;--> statement-breakpoint
ALTER TABLE `__new_belonging_table` RENAME TO `belonging_table`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_groups_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT `fk_groups_table_owner_id_users_table_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users_table`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_groups_table`(`id`, `owner_id`, `name`) SELECT `id`, `owner_id`, `name` FROM `groups_table`;--> statement-breakpoint
DROP TABLE `groups_table`;--> statement-breakpoint
ALTER TABLE `__new_groups_table` RENAME TO `groups_table`;--> statement-breakpoint
PRAGMA foreign_keys=ON;