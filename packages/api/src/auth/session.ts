import { nanoid } from 'nanoid';
import { eq, lt } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

const SESSION_EXPIRY_DAYS = 7;

type Db = DrizzleD1Database<typeof schema>;

export async function createSession(db: Db, companyId: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(schema.adminSessions).values({
    id: token,
    companyId,
    expiresAt,
  });
  return token;
}

export async function validateSession(db: Db, token: string): Promise<{ companyId: string; role: string } | null> {
  const now = new Date().toISOString();

  // Clean up expired sessions
  await db.delete(schema.adminSessions).where(lt(schema.adminSessions.expiresAt, now));

  const rows = await db
    .select({
      companyId: schema.adminSessions.companyId,
      expiresAt: schema.adminSessions.expiresAt,
      role: schema.companies.role,
    })
    .from(schema.adminSessions)
    .innerJoin(schema.companies, eq(schema.adminSessions.companyId, schema.companies.id))
    .where(eq(schema.adminSessions.id, token))
    .limit(1);

  if (rows.length === 0) return null;
  if (rows[0].expiresAt < now) return null;
  return { companyId: rows[0].companyId, role: rows[0].role };
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, token));
}
