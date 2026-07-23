import { Elysia, t } from 'elysia';
import { db, isAuthenticated } from '../util';
import { chatsTable } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

const rooms = new Map<string, Set<any>>(); // groupId -> Set<ws>

const chat_routes = (app: Elysia) => app
.resolve(({ query, set }) => {
  const id = isAuthenticated(query["x-access-token"]);
  if(!id){
    set.status = 401;
    throw new Error("Unauthorized")
  }
  return { id };
})

.ws("/ws/:groupId", {
  body: t.Object({
    text: t.String(),
  }),
  async open(ws) {
    const { groupId } = ws.data.params;
    if (!rooms.has(groupId)) rooms.set(groupId, new Set());
    rooms.get(groupId)!.add(ws);
    const history = await db
      .select()
      .from(chatsTable)
      .where(eq(chatsTable.groupId, groupId))
      .orderBy(asc(chatsTable.createdAt))
      .limit(50);

    ws.send(
      JSON.stringify({
        type: 'history',
        messages: history.map((row) => ({
          userId: row.userId,
          text: row.text,
          ts: row.createdAt,
        })),
      })
    );
  },
  async message(ws, message) {
    const { groupId } = ws.data.params;
    const now = Date.now();
    await db.insert(chatsTable).values({
      groupId: groupId,
      userId: ws.data.id,
      text: message.text,
      createdAt: now,
    });

    const payload = JSON.stringify({
      type: 'message',
      userId: ws.data.id,
      text: message.text,
      ts: now,
    });

    rooms.get(groupId)?.forEach((client) => client.send(payload));
    // persist via Drizzle, then broadcast
    rooms.get(groupId)?.forEach(client => client.send(payload));
  },
  close(ws) {
    const { groupId } = ws.data.params;
    rooms.get(groupId)?.delete(ws);
  },
})

export { chat_routes };
