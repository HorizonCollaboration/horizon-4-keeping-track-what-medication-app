import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { after } from "next/server";
import type { Database } from "@/db";
import { listCheck, medicine, medicineChange } from "@/db/schema";
import { dateFromToday, daysBefore } from "@/lib/dates";
import { urgency, type Status } from "@/lib/statuses";
import { sampleMedicines } from "@/sampleData";
import { refreshShortages, shortageSource, type ShortageSource } from "./shortages";

/** The one shared list, for now: the government's public list of medicine shortages. */
const governmentList = "government-list";

export type Medicine = typeof medicine.$inferSelect;

/** Most urgent first (short supply, then expected, ...), then by name. */
export function byUrgency(a: Medicine, b: Medicine): number {
  return urgency(a.status) - urgency(b.status) || a.name.localeCompare(b.name);
}

/** The medicine's name with its strength, such as "Amoxicillin 250 mg/5 mL". */
export function fullName(item: { name: string; strength: string }): string {
  return `${item.name} ${item.strength}`;
}

/**
 * Fills an empty list with the sample medicines, with their dates counted
 * from now. Does nothing once there are medicines, and is safe to run twice
 * at once. Until the live government list is connected, this is the list.
 */
export async function loadSampleMedicines(db: Database, now = new Date()): Promise<void> {
  if ((await db.$count(medicine)) > 0) {
    return;
  }

  await db
    .insert(medicine)
    .values(
      sampleMedicines.map((item) => ({
        id: item.id,
        name: item.name,
        strength: item.strength,
        form: item.form,
        maker: item.maker,
        status: item.history[0].status,
        reason: item.reason,
        expectedBack: item.backIn === null ? null : dateFromToday(item.backIn, now),
        lastChangedAt: daysBefore(now, item.history[0].ago),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(medicineChange)
    .values(
      sampleMedicines.flatMap((item) =>
        item.history.map((change, index) => ({
          id: `${item.id}-${index}`,
          medicineId: item.id,
          status: change.status,
          note: change.note,
          changedAt: daysBefore(now, change.ago),
        })),
      ),
    )
    .onConflictDoNothing();

  await db.insert(listCheck).values({ id: governmentList, checkedAt: now }).onConflictDoNothing();
}

/**
 * Makes sure there's a medicine list before a page shows it. Without the
 * real shortage list, that's the made-up sample medicines. With it, a fresh
 * install shows the sample medicines straight away, and the real list is
 * checked after the page has been sent (when it's due), so nobody waits for
 * it; the first good check replaces the sample medicines.
 */
export async function loadMedicines(
  db: Database,
  { source = shortageSource(), later = after }: { source?: ShortageSource | null; later?: (work: () => Promise<void>) => void } = {},
): Promise<void> {
  if (!source || (await db.$count(medicine)) === 0) {
    await loadSampleMedicines(db);
  }

  if (source) {
    later(() => refreshShortages(db, source));
  }
}

/** When the list was last checked, or null if it never has been. */
export async function lastChecked(db: Database): Promise<Date | null> {
  const [row] = await db.select().from(listCheck).where(eq(listCheck.id, governmentList));

  return row?.checkedAt ?? null;
}

/** Puts a backslash before the characters that mean "anything" in a LIKE pattern, so they're searched for as they are. */
function literally(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Medicines matching every word searched for (in the name, strength, form or
 * maker), with this status, or every status for "all". Most urgent first.
 */
export async function searchMedicines(db: Database, { query, status }: { query: string; status: Status | "all" }): Promise<Medicine[]> {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 10);
  const conditions = words.map((word) => {
    const pattern = `%${literally(word)}%`;

    return or(ilike(medicine.name, pattern), ilike(medicine.strength, pattern), ilike(medicine.form, pattern), ilike(medicine.maker, pattern));
  });

  if (status !== "all") {
    conditions.push(eq(medicine.status, status));
  }

  const rows = await db
    .select()
    .from(medicine)
    .where(and(...conditions))
    .orderBy(asc(medicine.name));

  return rows.sort(byUrgency);
}

/** One medicine with its history of changes, newest first, or null if there's no such medicine. */
export async function getMedicine(db: Database, medicineId: string) {
  const [found] = await db.select().from(medicine).where(eq(medicine.id, medicineId));

  if (!found) {
    return null;
  }

  const history = await db.select().from(medicineChange).where(eq(medicineChange.medicineId, medicineId)).orderBy(desc(medicineChange.changedAt));

  return { ...found, history };
}
