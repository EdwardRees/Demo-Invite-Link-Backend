import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const authTable = sqliteTable("auth_table", {
  id: int().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  password: text().notNull()
});

export const userTable = sqliteTable("users_table", {
  id: int('id').primaryKey({ autoIncrement: true }).references(() => authTable.id),
  name: text().notNull() 
})

export const groupsTable = sqliteTable("groups_table", {
  id: int().primaryKey({ autoIncrement: true }),
  owner_id: int().notNull().references(() => userTable.id),
  name: text().notNull()
});

export const belongingTable = sqliteTable("belonging_table", {
  id: int().primaryKey({ autoIncrement: true }),
  group_id: int().notNull().references(() => groupsTable.id),
  user_id: int().notNull().references(() => userTable.id)
})

export const chatsTable = sqliteTable("chats_table", {
  id: int('id').primaryKey(),
  groupId: int('group_id').notNull().references(() => groupsTable.id),
  userId: int('user_id').notNull().references(() => userTable.id),
  text: text('text').notNull(),
  createdAt: int('created_at', { mode: 'timestamp' }).notNull(),
});
