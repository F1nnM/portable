import { useDb } from "../../utils/db";
import { todos } from "../../db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));

  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid ID" });
  }

  const db = useDb();
  const [deleted] = await db.delete(todos).where(eq(todos.id, id)).returning();

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Todo not found" });
  }

  return { success: true };
});
