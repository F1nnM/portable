import { useDb } from "../utils/db";
import { todos } from "../db/schema";
import { asc } from "drizzle-orm";

export default defineEventHandler(async () => {
  const db = useDb();
  return await db.select().from(todos).orderBy(asc(todos.createdAt));
});
