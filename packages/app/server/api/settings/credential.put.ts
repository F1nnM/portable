import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { encrypt } from "../../utils/crypto";
import { useDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody<{ credential?: string }>(event);

  if (!body || typeof body.credential !== "string") {
    throw createError({ statusCode: 400, statusMessage: "credential must be a string" });
  }

  const db = useDb();
  const config = useRuntimeConfig();

  if (body.credential === "") {
    // Remove credential
    await db
      .update(users)
      .set({ encryptedAnthropicKey: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  } else {
    const encrypted = encrypt(body.credential, config.encryptionKey);
    await db
      .update(users)
      .set({ encryptedAnthropicKey: encrypted, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  return { ok: true };
});
