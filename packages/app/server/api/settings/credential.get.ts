import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { useDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const db = useDb();

  const result = await db
    .select({ encryptedAnthropicKey: users.encryptedAnthropicKey })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const hasCredential = result.length > 0 && !!result[0].encryptedAnthropicKey;

  return { hasCredential };
});
