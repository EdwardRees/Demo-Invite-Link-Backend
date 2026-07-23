import { Elysia, t } from 'elysia';
import { db, isAuthenticated } from '../util';
import jwt from 'jsonwebtoken';
import { userTable } from '../db/schema';
import { eq } from 'drizzle-orm'

const user_routes = (app) => 
  app
  .get("/", () => "Hello from Users")
  .post("/", async ({ body, request, status }) => {
    const id = request.id;
    const user_check = await db.select().from(userTable).where(eq(userTable.id, id));
    if(user_check.length > 0){
      return status(409, "Conflict: User already has an account")
    }
    const new_user = await db.insert(userTable).values({ id: id, name: body.name }).returning().get();
    
    return status(201, { message: "Successfully created user!", user: new_user });
  }, {
    beforeHandle({ request, headers, status }) {
      const auth = isAuthenticated(headers["x-access-token"]);
      if(auth !== null){
        request.id = auth;
      } else {
        return status(401, "Unauthorized") 
      }
    },
    body: t.Object({
      name: t.String()
    })
  })
  .get("/:id", async ({ params: { id }, status }) => {
    const user = await db.select().from(userTable).where(eq(userTable.id, id)).get();
    return status(200, user);
  }, {
    params: t.Object({
      id: t.String()
    })
  })
;

export { user_routes };
