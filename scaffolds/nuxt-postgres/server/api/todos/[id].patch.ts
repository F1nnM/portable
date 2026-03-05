import { useDb } from "../../utils/db";
import { todos } from "../../db/schema";
import { eq, not } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));

  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid ID" });
  }

  const db = useDb();
  const [updated] = await db
    .update(todos)
    .set({ completed: not(todos.completed) })
    .where(eq(todos.id, id))
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: "Todo not found" });
  }

  return updated;
});
