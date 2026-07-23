import { Elysia, t } from 'elysia';
import { db, isAuthenticated } from '../util';
import { belongingTable, groupsTable } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const INVITATION_SECRET = process.env.INVITATION_SECRET!;

const invite_routes = (app: Elysia) => app
.get("/invite", () => "Hello from Invites!")
.post("/invite", async ({ body, request, status }) => {
  const target_user_id = body.target_user_id;
  const current_id = request.id;
  const group_id = body.group_id;
  
  const group = await db.select().from(groupsTable).where(eq(groupsTable.id, group_id)).get();
  if(group.owner_id !== current_id){
    return status(403, "Forbidden: Not the owner of the group!")
  }

  const token = await jwt.sign({ 
    sub: group_id,
    aud: target_user_id,
    iat: Math.floor(Date.now() / 1000) - 30,
    exp: Math.floor(Date.now() / 1000) + (60 * 60)
  }, INVITATION_SECRET);

  return status(200, { data: `/join/${token}`});
}, {
  beforeHandle: ({ request, headers, status }) => {
    const id = isAuthenticated(headers["x-access-token"]);
    if(id){
      request.id = id;
    } else {
      return status(401, "Unauthorized")
    }
  },
  body: t.Object({
    target_user_id: t.Number(),
    group_id: t.Number()
  })
})
.post("/join/:token", async ({ params: { token }, request, status}) => {
  let decoded;
  try {
    decoded = jwt.verify(token, INVITATION_SECRET);
  } catch(err){
    return status(400, "Invalid token!")
  }

  const { sub: group_id, aud: target_user_id } = decoded;

  if(target_user_id !== request.id) {
    return status(401, "Unauthorized! Not target user!");
  }


  const belonging_check = await db.select().from(belongingTable).where(and(eq(belongingTable.group_id, group_id), eq(belongingTable.user_id, target_user_id)));
  if(belonging_check.length > 0){
    return status(409, "Conflict: User already belongs to group!")
  }

  const add_belonging = await db.insert(belongingTable).values({
    group_id,
    user_id: request.id
  }).returning().get();

  return status(201, { "message": "Successfully joined group!", data: add_belonging});

}, {
  beforeHandle: ({ request, headers, status }) => {
    const id = isAuthenticated(headers["x-access-token"]);
    if(id){
      request.id = id;
    } else {
      return status(401, "Unauthorized")
    }
  },
  params: t.Object({
    token: t.String()
  })
})

export { invite_routes };
