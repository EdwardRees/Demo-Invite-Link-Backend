import { Elysia, t } from 'elysia';

import { db } from '../util';
import { authTable } from '../db/schema'
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

const auth_routes = (app: Elysia) => app.get("/", () => "Hello from auth")
.post("/signup", async ({ body, status, cookie }) => {
  const registryCheck = await db.select().from(authTable).where(eq(authTable.email, body.email));
  if(registryCheck.length !== 0){
    return status(409, "Invalid email")
  }
  const salt = bcrypt.genSaltSync(10);
  const hashed_password = bcrypt.hashSync(body.password, salt);

  const new_user = await db.insert(authTable).values({ email: body.email, password: hashed_password }).returning();

  const access_token = jwt.sign({ sub: new_user[0].id, iat: Math.floor(Date.now() / 1000) - 30, exp: Math.floor(Date.now() / 1000) + (60 * 60) }, ACCESS_TOKEN_SECRET);
  const refresh_token = jwt.sign({ sub: new_user[0].id, iat: Math.floor(Date.now() / 1000) - 30, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 14) }, REFRESH_TOKEN_SECRET);

  cookie["x-refresh-token"].set({
    value: refresh_token,
    httpOnly: true,
    maxAge: 60*60*60*24*14,
    path: "/"
  });

  return status(201, { "x-access-token": access_token})
}, {
  body: t.Object({
    email: t.String(),
    password: t.String()
  }),
  cookie: t.Optional(t.Object({
    "x-refresh-token": t.String()
  }))
})
.post("/login", async ({ body, status, cookie }) => {
  const salt = bcrypt.genSaltSync(10);
  const hashed_password = bcrypt.hashSync(body.password, salt);

  const found_user = await db.select().from(authTable).where(eq(authTable.email, body.email));
  if(!found_user){
    return status(404, "User not found")
  }

  const verified = await bcrypt.compare(body.password, found_user[0].password);
  if(!verified){
    return status(401, "Unauthorized");
  }

  const access_token = jwt.sign({ sub: found_user[0].id, iat: Math.floor(Date.now() / 1000) - 30, exp: Math.floor(Date.now() / 1000) + (60 * 60) }, ACCESS_TOKEN_SECRET);
  const refresh_token = jwt.sign({ sub: found_user[0].id, iat: Math.floor(Date.now() / 1000) - 30, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 14) }, REFRESH_TOKEN_SECRET);

  cookie["x-refresh-token"].set({
    value: refresh_token,
    httpOnly: true,
    maxAge: 60*60*60*24*14,
    path: "/"
  });

  return status(200, { "x-access-token": access_token})
}, {
  body: t.Object({
    email: t.String(),
    password: t.String()
  }),
  cookie: t.Optional(t.Object({
    "x-refresh-token": t.String()
  }))
})
.post("/refresh", async ({ status, cookie }) => {
  const original_token = cookie['x-refresh-token'].value
  let id;
  try {
    id = jwt.verify(original_token, REFRESH_TOKEN_SECRET).sub;
  } catch(verificationError){
    return status(401, `Invalid refresh token: ${verificationError}`)
  }

  const access_token = jwt.sign({ sub: id, iat: Math.floor(Date.now() / 1000) - 30, exp: Math.floor(Date.now() / 1000) + (60 * 60) }, ACCESS_TOKEN_SECRET);
  const refresh_token = jwt.sign({ sub: id, iat: Math.floor(Date.now() / 1000) - 30, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 14) }, REFRESH_TOKEN_SECRET);

  cookie["x-refresh-token"].set({
    value: refresh_token,
    httpOnly: true,
    maxAge: 60*60*60*24*14,
    path: "/"
  });

  return status(200, { "x-access-token": access_token})
}, {
  cookie: t.Object({
    "x-refresh-token": t.String()
  })
})

export { auth_routes };
