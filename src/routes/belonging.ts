import { Elysia, t } from 'elysia';
import { belongingTable, groupsTable } from '../db/schema';
import { eq, innerJoin } from 'drizzle-orm';
import { db, isAuthenticated } from '../util';

const belonging_routes = (app: Elysia) => app
.get("/", async ({ request, status }) => {
  const user_groups = await db.select({
    group_id: belongingTable.group_id,
    group_name: groupsTable.name
  }).from(belongingTable).innerJoin(groupsTable, eq(belongingTable.group_id, groupsTable.id)).where(eq(belongingTable.user_id, request.id));

  return status(200, user_groups);

}, {
  beforeHandle({ request, headers, status }) {
    const auth = isAuthenticated(headers["x-access-token"]);
    if(auth !== null){
      request.id = auth;
    } else {
      return status(401, "Unauthorized") 
    }
  }
})

export { belonging_routes };
