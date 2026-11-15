/*
 * The medicine list is a copy of Health Canada's public "Tier 3 drug
 * shortages" page: the shortages it rates most serious. It needs no account.
 * The page is read after someone opens a page of the app, when the last good
 * read is more than a few hours old, so nobody waits for it. If the page
 * can't be read, people see what it said last time, never anything made up.
 */
import { and, eq, inArray, like, lt } from "drizzle-orm";
import type { Database } from "@/db";
import { listCheck, medicine, medicineChange, trackedMedicine } from "@/db/schema";
import { calendarDate } from "@/lib/dates";
import type { Status } from "@/lib/statuses";
import { notify } from "@/lib/updates";

/** The page the list is copied from. */
export const tier3Page = "https://www.canada.ca/en/health-canada/services/drugs-health-products/drug-products/drug-shortages/tier-3-shortages.html";

/** When the page was last read in full and saved: only a good read counts. */
export const lastGoodRead = "tier3-list";

/** Held by the one read under way, for a short while, so two pages don't read at once. */
const reading = "tier3-reading";

/** How long a good read is trusted before the page is read again. */
export const readEveryHours = 6;

/** How long a read holds the list before another may try, if it failed or never finished. */
export const leaseMinutes = 10;

/**
 * Fewer rows than this means the page probably changed shape and wasn't read
 * properly, so nothing is saved. Health Canada's list has had around 30.
 */
export const fewestRows = 5;

/** Medicines from the list have ids starting with this. */
const prefix = "t3-";

/** The made-up medicines and the first real-data try that earlier versions kept: never shown now. */
const retiredIds = [
  "amoxicillin-liquid",
  "salbutamol-inhaler",
  "methylphenidate-er",
  "levothyroxine",
  "semaglutide-pen",
  "insulin-glargine",
  "metformin",
  "estradiol-patch",
  "sertraline",
  "epinephrine-autoinjector",
  "ibuprofen-children",
  "ranitidine",
  "lisdexamfetamine",
  "atorvastatin",
];

/** One row of Health Canada's table. */
export type Tier3Row = {
  id: string;
  name: string;
  tier3Since: string | null;
  usedForCovid: boolean | null;
};

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘" };

/** An HTML fragment as plain text: no tags, entities decoded, spaces tidied. */
function plain(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        return String.fromCodePoint(parseInt(code.slice(2), 16));
      }

      if (code.startsWith("#")) {
        return String.fromCodePoint(parseInt(code.slice(1), 10));
      }

      return entities[code.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** The contents of each element with this tag inside some HTML. */
function each(html: string, tag: string): string[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((match) => match[1]);
}

/** A medicine's id from its name: the same name always gives the same id. */
export function idFor(name: string): string {
  return `${prefix}${name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`.slice(0, 100);
}

/** Looks like a date or a plain number rather than a medicine's name. */
function isDateLike(text: string): boolean {
  return /^[\d\s/.:-]+$/.test(text);
}

/** The share of rows that must look right (a name and a Tier 3 date) for a read to count. */
export const rowsThatMustLookRight = 0.8;

/**
 * The rows of the Tier 3 table on Health Canada's page. Finds the table by
 * its headings, so it still works if the page around it changes, and reads
 * each row's cells whether they're marked up as data or as row headings.
 * Rows without a drug name are left out; a medicine listed twice keeps its
 * newest date. Throws if there's no such table, or if the rows don't look
 * right (most must have a name and a Tier 3 date), since then the columns
 * were probably read wrongly.
 */
export function readTier3Table(html: string): Tier3Row[] {
  for (const table of each(html, "table")) {
    const tableRows = each(table, "tr");
    const headingRow = tableRows.findIndex((row) => /<th\b/i.test(row) && !/<td\b/i.test(row));

    if (headingRow === -1) {
      continue;
    }

    const headings = each(tableRows[headingRow], "th").map(plain);
    const nameAt = headings.findIndex((heading) => /drug/i.test(heading) && /active ingredient/i.test(heading));
    const dateAt = headings.findIndex((heading) => /date/i.test(heading) && /tier\s*3/i.test(heading));
    const covidAt = headings.findIndex((heading) => /covid/i.test(heading));

    if (nameAt === -1 || dateAt === -1) {
      continue;
    }

    const rows = new Map<string, Tier3Row>();
    let read = 0;
    let lookRight = 0;

    for (const row of tableRows.slice(headingRow + 1)) {
      const cells = each(row, "t[hd]").map(plain);
      const name = cells[nameAt]?.slice(0, 200);

      if (!name) {
        continue;
      }

      const tier3Since = cells[dateAt]?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
      const covid = covidAt === -1 ? "" : (cells[covidAt] ?? "");
      const id = idFor(name);
      const seen = rows.get(id);

      read += 1;

      if (tier3Since && !isDateLike(name)) {
        lookRight += 1;
      }

      if (!seen || (tier3Since !== null && (seen.tier3Since === null || tier3Since > seen.tier3Since))) {
        rows.set(id, { id, name, tier3Since, usedForCovid: /^yes\b/i.test(covid) ? true : /^no\b/i.test(covid) ? false : null });
      }
    }

    if (read > 0 && lookRight < read * rowsThatMustLookRight) {
      throw new Error(`Only ${lookRight} of the ${read} rows in Health Canada's Tier 3 table had a name and a date, so it wasn't read.`);
    }

    return [...rows.values()];
  }

  throw new Error("Couldn't find the Tier 3 table on Health Canada's page.");
}

/** Reads Health Canada's page. Throws if it can't. */
export async function fetchTier3Page(fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher(tier3Page, {
    headers: {
      // Says who is asking. canada.ca has held back requests without an accept-language and user-agent.
      "user-agent": "Mozilla/5.0 (compatible; MedicineWatch/1.0; +https://github.com/HorizonCollaboration)",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-CA,en;q=0.9",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Couldn't read Health Canada's page (${response.status}).`);
  }

  return response.text();
}

/** When the list was last read in full and saved, or null if it never has been. */
export async function lastRead(db: Database): Promise<Date | null> {
  const [row] = await db.select().from(listCheck).where(eq(listCheck.id, lastGoodRead));

  return row?.checkedAt ?? null;
}

/** Whether a read is due: no good read in the last few hours. */
export async function isDue(db: Database, now: Date): Promise<boolean> {
  const good = await lastRead(db);

  return good === null || now.getTime() - good.getTime() >= readEveryHours * 60 * 60 * 1000;
}

/** Takes the short lease on reading, or false if another read holds it. */
async function claimLease(db: Database, now: Date): Promise<boolean> {
  const expired = new Date(now.getTime() - leaseMinutes * 60 * 1000);
  const [inserted] = await db.insert(listCheck).values({ id: reading, checkedAt: now }).onConflictDoNothing().returning();

  if (inserted) {
    return true;
  }

  const [claimed] = await db
    .update(listCheck)
    .set({ checkedAt: now })
    .where(and(eq(listCheck.id, reading), lt(listCheck.checkedAt, expired)))
    .returning();

  return claimed !== undefined;
}

/** Takes out the made-up medicines (earlier versions' and the tests') and the first real-data try, with anyone's tracking of them. */
export async function removeRetiredMedicines(db: Database): Promise<void> {
  await db.delete(medicine).where(inArray(medicine.id, retiredIds));
  await db.delete(medicine).where(like(medicine.id, "hps-%"));
  // The tests' made-up medicines, should they ever reach a real database.
  await db.delete(medicine).where(like(medicine.id, "t3-sample-%"));
}

type Update = { kind: "medicine_changed" | "tier3_added"; summary: string };

/**
 * Brings the list up to date with Health Canada's page, if it's due. Records
 * each change in a medicine's history, and tells people when a medicine
 * someone tracks joins or leaves the list, and when a new one is added. A
 * medicine only counts as off the list when the whole table was read and
 * looks complete. Never throws.
 */
export async function refreshTier3(db: Database, { now = new Date(), fetcher = fetch }: { now?: Date; fetcher?: typeof fetch } = {}): Promise<void> {
  try {
    if (!(await isDue(db, now)) || !(await claimLease(db, now))) {
      return;
    }

    const rows = readTier3Table(await fetchTier3Page(fetcher));

    if (rows.length < fewestRows) {
      // Far fewer than the list has: the page probably changed shape. Try again once the lease is up.
      console.error(`Health Canada's Tier 3 table had only ${rows.length} rows, so it wasn't saved.`);
      return;
    }

    const updates = await db.transaction(async (tx) => {
      const made = await saveRows(tx as unknown as Database, rows, now);

      await tx
        .insert(listCheck)
        .values({ id: lastGoodRead, checkedAt: now })
        .onConflictDoUpdate({ target: listCheck.id, set: { checkedAt: now } });

      return made;
    });

    // Only once it's all saved, so nobody hears about a change that didn't happen.
    for (const update of updates) {
      await notify(db, update.kind, update.summary);
    }
  } catch (error) {
    console.error("Couldn't read Health Canada's Tier 3 list:", error);
  }
}

/** The most medicines one read may take off the list: more at once is more likely a fault than real. */
export const mostDropOffs = 5;

/** A name reduced to its letters and digits, so small wording changes compare equal. */
function squashed(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The first word of a name, in lower case. */
function firstWord(name: string): string {
  return name.toLowerCase().match(/[a-z0-9]+/)?.[0] ?? "";
}

/** Whether two names on the same date are probably Health Canada rewording one medicine. */
function isRewording(a: string, b: string): boolean {
  return squashed(a) === squashed(b) || (firstWord(a) !== "" && firstWord(a) === firstWord(b));
}

type Known = { id: string; name: string; status: string; tier3Since: string | null; usedForCovid: boolean | null };

/** Saves the table, and returns what to tell people. */
async function saveRows(db: Database, rows: Tier3Row[], now: Date): Promise<Update[]> {
  await removeRetiredMedicines(db);

  const known: Known[] = await db
    .select({ id: medicine.id, name: medicine.name, status: medicine.status, tier3Since: medicine.tier3Since, usedForCovid: medicine.usedForCovid })
    .from(medicine)
    .where(like(medicine.id, `${prefix}%`));
  // Matched by name, as it's saved now: a renamed medicine keeps its first id, so tracking it carries on.
  const byName = new Map(known.map((row) => [idFor(row.name), row]));
  const tracked = new Set((await db.selectDistinct({ id: trackedMedicine.medicineId }).from(trackedMedicine)).map((row) => row.id));
  const isFirstRead = known.length === 0;
  const updates: Update[] = [];

  // A listed medicine whose name has gone, and a new name with the same Tier 3 date and a similar name, is Health Canada rewording it.
  const onPage = new Set(rows.map((row) => row.id));
  const missing = known.filter((row) => row.status === "listed" && !onPage.has(idFor(row.name)));
  const renamed = new Map<string, Known>();

  for (const row of rows.filter((item) => !byName.has(item.id))) {
    const matches = missing.filter((was) => was.tier3Since !== null && was.tier3Since === row.tier3Since && isRewording(was.name, row.name) && ![...renamed.values()].includes(was));

    if (matches.length === 1) {
      renamed.set(row.id, matches[0]);
    }
  }

  for (const row of rows) {
    const was = byName.get(row.id) ?? renamed.get(row.id);

    if (!was) {
      const addedAt = row.tier3Since && !isFirstRead ? now : row.tier3Since ? new Date(`${row.tier3Since}T12:00:00Z`) : now;

      await db
        .insert(medicine)
        .values({ id: row.id, name: row.name, strength: "", form: "", maker: "", status: "listed", tier3Since: row.tier3Since, usedForCovid: row.usedForCovid, lastChangedAt: addedAt })
        .onConflictDoNothing();
      await db.insert(medicineChange).values({ medicineId: row.id, status: "listed", note: addedNote(row), changedAt: addedAt });

      // On the very first read every medicine is new, which isn't news.
      if (!isFirstRead) {
        updates.push({ kind: "tier3_added", summary: `${row.name} was added to Health Canada's Tier 3 list, its most serious drug shortages.` });
      }

      continue;
    }

    if (was.tier3Since !== row.tier3Since || was.usedForCovid !== row.usedForCovid || was.name !== row.name) {
      await db.update(medicine).set({ name: row.name, tier3Since: row.tier3Since, usedForCovid: row.usedForCovid }).where(eq(medicine.id, was.id));
    }

    if (was.status !== "listed") {
      await changeStatus(db, was.id, "listed", "Back on the Tier 3 list.", now);

      if (tracked.has(was.id)) {
        updates.push({ kind: "medicine_changed", summary: `${row.name} is back on Health Canada's Tier 3 list of the most serious drug shortages.` });
      }
    }
  }

  // Off the list now. Only judged when the table looks whole: nearly as long as the list it replaces, and only a few gone at once.
  const listed = known.filter((row) => row.status === "listed");
  const renamedIds = new Set([...renamed.values()].map((row) => row.id));
  const gone = missing.filter((row) => !renamedIds.has(row.id));

  if (gone.length > 0 && (rows.length < listed.length * rowsThatMustLookRight || gone.length > mostDropOffs)) {
    console.error(`Health Canada's Tier 3 table would take ${gone.length} of ${listed.length} medicines off the list with ${rows.length} rows, so none were taken off this time.`);
  } else {
    for (const row of gone) {
      await changeStatus(db, row.id, "delisted", "Taken off the Tier 3 list.", now);

      if (tracked.has(row.id)) {
        updates.push({ kind: "medicine_changed", summary: `${row.name} is no longer on Health Canada's Tier 3 list of the most serious drug shortages.` });
      }
    }
  }

  return updates;
}

function addedNote(row: Tier3Row): string {
  return row.tier3Since ? `Added to the Tier 3 list on ${calendarDate(row.tier3Since)}.` : "Added to the Tier 3 list.";
}

async function changeStatus(db: Database, medicineId: string, status: Status, note: string, changedAt: Date): Promise<void> {
  await db.update(medicine).set({ status, lastChangedAt: changedAt }).where(eq(medicine.id, medicineId));
  await db.insert(medicineChange).values({ medicineId, status, note, changedAt });
}
