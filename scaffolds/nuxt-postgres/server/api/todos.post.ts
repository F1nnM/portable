import { useDb } from "../utils/db";
import { todos } from "../db/schema";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ title: string }>(event);

  if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: "Title is required" });
  }

  const db = useDb();
  const [todo] = await db.insert(todos).values({ title: body.title.trim() }).returning();
  return todo;
});
