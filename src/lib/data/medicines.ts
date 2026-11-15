import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { after } from "next/server";
import type { Database } from "@/db";
import { medicine, medicineChange } from "@/db/schema";
import { daysBefore } from "@/lib/dates";
import { urgency, type Status } from "@/lib/statuses";
import { sampleMedicines } from "@/sampleData";
import { lastRead, refreshTier3, removeRetiredMedicines } from "./tier3";

export type Medicine = typeof medicine.$inferSelect;

/** On the Tier 3 list first, then by name. */
export function byUrgency(a: Medicine, b: Medicine): number {
  return urgency(a.status) - urgency(b.status) || a.name.localeCompare(b.name);
}

/** The medicine's name, with its strength when it has one. */
export function fullName(item: { name: string; strength: string }): string {
  return `${item.name} ${item.strength}`.trim();
}

/**
 * For the tests only: fills an empty list with the made-up sample medicines,
 * with their dates counted from now. The app itself never shows them.
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
        strength: "",
        form: "",
        maker: "",
        status: item.history[0].status,
        tier3Since: item.tier3Since,
        usedForCovid: item.usedForCovid,
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
}

/**
 * Gets the list ready before a page shows it. It's a copy of Health Canada's
 * Tier 3 list: never anything made up. The very first time, the page waits
 * for the first read (a few seconds at most); after that, the list is read
 * again after the page has been sent, when it's due, so nobody waits.
 */
export async function loadMedicines(
  db: Database,
  { later = after, read = refreshTier3 }: { later?: (work: () => Promise<void>) => void; read?: (db: Database) => Promise<void> } = {},
): Promise<void> {
  await removeRetiredMedicines(db);

  if ((await lastRead(db)) === null) {
    await read(db);
  } else {
    later(() => read(db));
  }
}

/** When Health Canada's list was last read in full, or null if it never has been. */
export async function lastChecked(db: Database): Promise<Date | null> {
  return lastRead(db);
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
