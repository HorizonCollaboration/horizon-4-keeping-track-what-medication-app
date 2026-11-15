import { and, desc, eq, gte } from "drizzle-orm";
import type { Database } from "@/db";
import { medicine, medicineChange, trackedMedicine } from "@/db/schema";
import { byUrgency, type Medicine } from "./medicines";

/** The medicines this person tracks, most urgent first. */
export async function listTracked(db: Database, userId: string): Promise<Medicine[]> {
  const rows = await db
    .select({ medicine })
    .from(trackedMedicine)
    .innerJoin(medicine, eq(trackedMedicine.medicineId, medicine.id))
    .where(eq(trackedMedicine.userId, userId));

  return rows.map((row) => row.medicine).sort(byUrgency);
}

/** The ids of the medicines this person tracks. */
export async function trackedIds(db: Database, userId: string): Promise<Set<string>> {
  const rows = await db.select({ medicineId: trackedMedicine.medicineId }).from(trackedMedicine).where(eq(trackedMedicine.userId, userId));

  return new Set(rows.map((row) => row.medicineId));
}

/** Starts tracking a medicine. The medicine, or null if there's no such medicine. Tracking it twice changes nothing. */
export async function trackMedicine(db: Database, userId: string, medicineId: string): Promise<Medicine | null> {
  const [found] = await db.select().from(medicine).where(eq(medicine.id, medicineId));

  if (!found) {
    return null;
  }

  await db.insert(trackedMedicine).values({ userId, medicineId }).onConflictDoNothing();

  return found;
}

/** Stops this person tracking a medicine; nobody else's list changes. The medicine, or null if there's no such medicine. */
export async function stopTracking(db: Database, userId: string, medicineId: string): Promise<Medicine | null> {
  const [found] = await db.select().from(medicine).where(eq(medicine.id, medicineId));

  await db.delete(trackedMedicine).where(and(eq(trackedMedicine.userId, userId), eq(trackedMedicine.medicineId, medicineId)));

  return found ?? null;
}

export type TrackedChange = {
  id: string;
  medicineId: string;
  name: string;
  strength: string;
  status: string;
  note: string;
  changedAt: Date;
};

/** Every change since then to the medicines this person tracks, newest first. */
export async function changesToTracked(db: Database, userId: string, since: Date): Promise<TrackedChange[]> {
  return db
    .select({
      id: medicineChange.id,
      medicineId: medicine.id,
      name: medicine.name,
      strength: medicine.strength,
      status: medicineChange.status,
      note: medicineChange.note,
      changedAt: medicineChange.changedAt,
    })
    .from(medicineChange)
    .innerJoin(trackedMedicine, eq(trackedMedicine.medicineId, medicineChange.medicineId))
    .innerJoin(medicine, eq(medicine.id, medicineChange.medicineId))
    .where(and(eq(trackedMedicine.userId, userId), gte(medicineChange.changedAt, since)))
    .orderBy(desc(medicineChange.changedAt));
}
