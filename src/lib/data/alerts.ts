import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { emailAlert } from "@/db/schema";

/** "changes": only when something changes. "weekly": also a weekly note when nothing has. */
export const alertOptions = ["changes", "weekly"] as const;

export type AlertOften = (typeof alertOptions)[number];

export type EmailAlert = { on: boolean; often: AlertOften };

/** This person's email alert choice. Off until they turn it on. */
export async function getEmailAlert(db: Database, userId: string): Promise<EmailAlert> {
  const [row] = await db.select().from(emailAlert).where(eq(emailAlert.userId, userId));

  return { on: row?.on ?? false, often: row?.often === "weekly" ? "weekly" : "changes" };
}

/** Turns this person's email alerts on, as often as they chose. */
export async function saveEmailAlert(db: Database, userId: string, often: AlertOften): Promise<void> {
  await db
    .insert(emailAlert)
    .values({ userId, on: true, often })
    .onConflictDoUpdate({ target: emailAlert.userId, set: { on: true, often, updatedAt: new Date() } });
}

/** Turns this person's email alerts off, keeping how often they chose for next time. */
export async function turnOffEmailAlert(db: Database, userId: string): Promise<void> {
  await db
    .insert(emailAlert)
    .values({ userId, on: false })
    .onConflictDoUpdate({ target: emailAlert.userId, set: { on: false, updatedAt: new Date() } });
}
