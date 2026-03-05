import { randomBytes } from "node:crypto";
import * as arctic from "arctic";
import { eq } from "drizzle-orm";
import { sessions, users } from "../db/schema";
import { useDb } from "./db";

const SESSION_EXPIRY_DAYS = 30;

export function createGitHubClient(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): arctic.GitHub {
  return new arctic.GitHub(clientId, clientSecret, redirectUri);
}

export function useGitHubClient(): arctic.GitHub {
  const config = useRuntimeConfig();
  const callbackUrl = `${config.baseUrl}/auth/github/callback`;
  return createGitHubClient(config.githubClientId, config.githubClientSecret, callbackUrl);
}

export async function createSession(userId: string): Promise<string> {
  const db = useDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
  });

  return token;
}

export interface SessionUser {
  id: string;
  githubId: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export async function validateSession(token: string): Promise<SessionUser | null> {
  const db = useDb();

  const result = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      githubId: users.githubId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const row = result[0];

  if (row.expiresAt < new Date()) {
    // Session expired, clean it up
    await deleteSession(token);
    return null;
  }

  return {
    id: row.userId,
    githubId: row.githubId,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  };
}

export async function deleteSession(token: string): Promise<void> {
  const db = useDb();
  await db.delete(sessions).where(eq(sessions.id, token));
}
