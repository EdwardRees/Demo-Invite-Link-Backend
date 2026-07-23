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

