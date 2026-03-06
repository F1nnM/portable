import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { encrypt } from "../../utils/crypto";
import { useDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody<{ key?: string }>(event);

  if (!body || typeof body.key !== "string") {
    throw createError({ statusCode: 400, statusMessage: "key must be a string" });
  }

  const db = useDb();
  const config = useRuntimeConfig();

  if (body.key === "") {
    await db
      .update(users)
      .set({ encryptedAgeKey: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  } else {
    const encrypted = encrypt(body.key, config.encryptionKey);
    await db
      .update(users)
      .set({ encryptedAgeKey: encrypted, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  return { ok: true };
});
