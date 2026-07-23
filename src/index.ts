import { Elysia } from "elysia";
import 'dotenv/config';
import { auth_routes, user_routes, group_routes, invite_routes, belonging_routes, chat_routes } from './routes';
import { db } from './util/db.ts';

// const db = drizzle(process.env.DB_FILE_NAME!);

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .get("/health", () => "Healthy!")
  .group("/users", (app) => user_routes(app))
  .group("/auth", (app) => auth_routes(app))
  .group("/groups", (app) => group_routes(app))
  .group("/belonging", (app) => belonging_routes(app))
  .use(chat_routes)
  .use(invite_routes)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
