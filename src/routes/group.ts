import { Elysia, t } from 'elysia';
import { groupsTable, belongingTable } from '../db/schema';
import { sql, eq, and } from 'drizzle-orm';
import { db, isAuthenticated } from '../util';

const group_routes = (app: Elysia) => app
.get("/", async ({ request, status }) => {
  const user_groups = await db.select().from(groupsTable).where(eq(groupsTable.owner_id, request.id));
  return status(200, { data: user_groups });
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
.post("/", async ({ request, body, status }) => {
  const owner_id = request.id;
  const name = body.name;
  const group_check = await db.select().from(groupsTable).where(and(eq(groupsTable.owner_id, owner_id), eq(groupsTable.name, name))); 
  if(group_check.length > 0){
    console.info(group_check);
    return status(409, "Conflict: Group Name already exists for current user");
  }
  const new_group = await db.insert(groupsTable).values({ owner_id, name }).returning().get();

  const belonging_group = await db.insert(belongingTable).values({ user_id: owner_id, group_id: new_group.id })

  return status(201, { "message": "Successfully created group!", data: new_group })
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
  const groups = await db.select({
    count: sql<number>`cast(count(${belongingTable.id}) as int)`
  })
  .from(groupsTable)
  .innerJoin(belongingTable, eq(groupsTable.id, belongingTable.group_id))
  .where(
    eq(groupsTable.id, id)
  );
  return status(200, groups);
}, {
  params: t.Object({
    id: t.Number()
  })
})

export { group_routes };
