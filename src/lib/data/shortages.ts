/*
 * The real list of medicine shortages, from Health Canada's Health Product
 * Shortages Canada (formerly Drug Shortages Canada), where companies must
 * report shortages and discontinuations. It needs an account, so it's only
 * used when OUTSIDE_SHORTAGES_EMAIL and OUTSIDE_SHORTAGES_PASSWORD are set;
 * without them the app keeps its made-up sample medicines.
 *
 * The list is checked after a page has been sent, when the last good check
 * is more than a few hours old, so nobody waits for it. If the list can't be
 * reached, people see what it said last time.
 */
import { and, eq, inArray, like, lt } from "drizzle-orm";
import type { Database } from "@/db";
import { listCheck, medicine, medicineChange, trackedMedicine } from "@/db/schema";
import { statusLabel, type Status } from "@/lib/statuses";
import { notify } from "@/lib/updates";
import { sampleMedicines } from "@/sampleData";

/** The list's row in list_check, shared with the sample data: what pages show as "last checked". */
const governmentList = "government-list";

/** When the real list was last read in full and saved: only a good check counts. */
const lastGoodCheck = "shortages-synced";

/** Held by the one check under way, for a short while, so two pages don't check at once. */
const checking = "shortages-checking";

/** How long a good check is trusted before the list is checked again. */
export const checkEveryHours = 6;

/** How long a check holds the list before another may try, if it failed or never finished. */
export const leaseMinutes = 10;

/** Real medicines' ids start with this, so they never clash with the sample ones. */
export const realPrefix = "hps-";

/** The most reports read in one check, so a check can never run away. */
const mostReports = 5000;
const perPage = 500;

/** The kinds of report worth reading: shortages now or coming, and medicines no longer made. */
const statusesToRead = ["active_confirmed", "anticipated_shortage", "to_be_discontinued", "discontinued"];

export type ShortageSource = { url: string; email: string; password: string };

/** Where the list is and the account to read it with, or null when it isn't set up (or its address isn't https). */
export function shortageSource(
  env: Record<string, string | undefined> = {
    OUTSIDE_SHORTAGES_EMAIL: process.env.OUTSIDE_SHORTAGES_EMAIL,
    OUTSIDE_SHORTAGES_PASSWORD: process.env.OUTSIDE_SHORTAGES_PASSWORD,
    OUTSIDE_SHORTAGES_API_URL: process.env.OUTSIDE_SHORTAGES_API_URL,
  },
): ShortageSource | null {
  const email = env.OUTSIDE_SHORTAGES_EMAIL?.trim();
  const password = env.OUTSIDE_SHORTAGES_PASSWORD;
  const url = (env.OUTSIDE_SHORTAGES_API_URL?.trim() || "https://www.healthproductshortages.ca/api/v1").replace(/\/$/, "");

  if (!email || !password || !url.startsWith("https://")) {
    return null;
  }

  return { url, email, password };
}

/** One medicine as the app keeps it, from a report. */
export type ReportedMedicine = {
  id: string;
  name: string;
  strength: string;
  form: string;
  maker: string;
  status: Status;
  reason: string | null;
  expectedBack: string | null;
  changedAt: Date;
};

type Report = Record<string, unknown>;

/** The first of these that's a non-empty string, looking inside objects with a dotted path. */
function text(report: Report, ...paths: string[]): string | null {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((at, key) => (at !== null && typeof at === "object" ? (at as Report)[key] : undefined), report);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

/** A report's status in the app's words, or null for one the app doesn't show. */
export function statusOf(reportStatus: string | null): Status | null {
  switch (reportStatus?.toLowerCase()) {
    case "active_confirmed":
      return "shortage";
    case "anticipated_shortage":
    case "to_be_discontinued":
      return "expected";
    case "discontinued":
      return "discontinued";
    case "resolved":
    case "avoided_shortage":
    case "reversed":
      return "available";
    default:
      return null;
  }
}

/** Just the date, as YYYY-MM-DD, or null. */
function dateOnly(value: string | null): string | null {
  const match = value?.match(/^\d{4}-\d{2}-\d{2}/);

  return match ? match[0] : null;
}

/** The medicine a report is about, by its DIN (the number on its box), or null if it can't tell. */
function medicineIdOf(report: Report): string | null {
  const din = text(report, "din", "drug.din");
  const reportId = text(report, "id", "report_id");

  if (!din && !reportId) {
    return null;
  }

  return `${realPrefix}${(din ?? `report-${reportId}`).replace(/[^\w-]/g, "")}`.slice(0, 100);
}

/** When a report last changed, or null if it doesn't say. */
function changedAtOf(report: Report): Date | null {
  const changed = new Date(text(report, "updated_date", "actual_start_date", "anticipated_start_date", "created_date") ?? "");

  return Number.isNaN(changed.getTime()) ? null : changed;
}

/** A report as one of the app's medicines, or null if it can't be read. */
export function toMedicine(report: Report): ReportedMedicine | null {
  const id = medicineIdOf(report);
  const status = statusOf(text(report, "status", "status.value"));
  const name = text(report, "en_drug_brand_name", "drug.brand_name", "en_drug_common_name", "drug.common_name", "brand_name");

  if (!id || !status || !name) {
    return null;
  }

  const common = text(report, "en_drug_common_name", "drug.common_name");

  return {
    id,
    name: (common && common.toLowerCase() !== name.toLowerCase() ? `${name} (${common})` : name).slice(0, 200),
    strength: (text(report, "drug_strength", "drug.strength") ?? "").slice(0, 100),
    form: (text(report, "drug_dosage_form", "en_drug_dosage_form", "drug.dosage_form") ?? "Medicine").slice(0, 100),
    maker: (text(report, "company_name", "company.name") ?? "Not given").slice(0, 200),
    status,
    reason: text(report, "shortage_reason.en_reason", "en_reason", "discontinuance_reason.en_reason")?.slice(0, 500) ?? null,
    expectedBack: status === "available" || status === "discontinued" ? null : dateOnly(text(report, "estimated_end_date")),
    changedAt: changedAtOf(report) ?? new Date(),
  };
}

/** What one check read: the reports, and whether every kind was read to the end. */
export type Reading = { reports: Report[]; complete: boolean };

/**
 * Signs in to the list and reads its reports. Throws if it can't. A kind of
 * report only counts as read in full when the list says how many there are
 * and every one was read.
 */
export async function readReports(source: ShortageSource, fetcher: typeof fetch = fetch): Promise<Reading> {
  const signedIn = await fetcher(`${source.url}/login`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email: source.email, password: source.password }),
    signal: AbortSignal.timeout(15_000),
  });
  const token = signedIn.headers.get("auth-token");

  if (!signedIn.ok || !token) {
    throw new Error(`Couldn't sign in to the shortage list (${signedIn.status}).`);
  }

  const reports = new Map<string, Report>();
  let complete = true;

  for (const status of statusesToRead) {
    let read = 0;
    let total: number | null = null;
    let reachedEnd = false;

    for (let offset = 0; offset < mostReports; offset += perPage) {
      if (reports.size >= mostReports) {
        break;
      }

      const query = new URLSearchParams({ filter_status: status, limit: String(perPage), offset: String(offset), orderby: "updated_date", order: "desc" });
      const response = await fetcher(`${source.url}/search?${query}`, {
        headers: { "auth-token": token, accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        throw new Error(`Couldn't read the shortage list (${response.status}).`);
      }

      const body = (await response.json()) as { data?: unknown; total?: unknown };
      const page = Array.isArray(body.data) ? (body.data.filter((item) => item !== null && typeof item === "object") as Report[]) : [];
      total = typeof body.total === "number" ? body.total : null;
      read += page.length;

      for (const report of page) {
        reports.set(text(report, "id", "report_id") ?? `${status}-${offset}-${reports.size}`, report);
      }

      if (page.length < perPage || (total !== null && read >= total)) {
        reachedEnd = true;
        break;
      }
    }

    if (!reachedEnd || total === null || read < total) {
      complete = false;
    }
  }

  return { reports: [...reports.values()], complete };
}

/** What a check found: each medicine from its newest report, and every medicine any report mentioned. */
function byMedicine(reports: Report[]): { medicines: ReportedMedicine[]; mentioned: Set<string> } {
  const newest = new Map<string, Report>();

  for (const report of reports) {
    const id = medicineIdOf(report);

    if (!id) {
      continue;
    }

    const seen = newest.get(id);

    if (!seen || (changedAtOf(report)?.getTime() ?? 0) > (changedAtOf(seen)?.getTime() ?? 0)) {
      newest.set(id, report);
    }
  }

  // A medicine whose newest report can't be read is left as it is: never changed from an older report, never taken off.
  const medicines = [...newest.values()].map(toMedicine).filter((item): item is ReportedMedicine => item !== null);

  return { medicines, mentioned: new Set(newest.keys()) };
}

/** When the list was last read in full and saved, or null. */
async function lastGood(db: Database): Promise<Date | null> {
  const [row] = await db.select().from(listCheck).where(eq(listCheck.id, lastGoodCheck));

  return row?.checkedAt ?? null;
}

/** Whether a check is due: no good check in the last few hours. */
export async function isDue(db: Database, now: Date): Promise<boolean> {
  const good = await lastGood(db);

  return good === null || now.getTime() - good.getTime() >= checkEveryHours * 60 * 60 * 1000;
}

/** Takes the short lease on checking, or false if another check holds it. */
async function claimLease(db: Database, now: Date): Promise<boolean> {
  const expired = new Date(now.getTime() - leaseMinutes * 60 * 1000);
  const [inserted] = await db.insert(listCheck).values({ id: checking, checkedAt: now }).onConflictDoNothing().returning();

  if (inserted) {
    return true;
  }

  const [claimed] = await db
    .update(listCheck)
    .set({ checkedAt: now })
    .where(and(eq(listCheck.id, checking), lt(listCheck.checkedAt, expired)))
    .returning();

  return claimed !== undefined;
}

/**
 * Brings the medicine list up to date with the real one, if it's due. Records
 * each change in a medicine's history, and tells people when a medicine
 * someone tracks changes. A medicine that drops off the list of shortages is
 * available again, but only when the whole list was read. Never throws.
 */
export async function refreshShortages(db: Database, source: ShortageSource, { now = new Date(), fetcher = fetch }: { now?: Date; fetcher?: typeof fetch } = {}): Promise<void> {
  try {
    if (!(await isDue(db, now)) || !(await claimLease(db, now))) {
      return;
    }

    const reading = await readReports(source, fetcher);
    const found = byMedicine(reading.reports);

    if (found.medicines.length === 0) {
      // An empty answer is far more likely a fault than no shortages at all: try again once the lease is up.
      return;
    }

    const changes = await db.transaction(async (tx) => {
      const made = await applyReports(tx as unknown as Database, found, reading.complete, now);

      for (const id of [governmentList, lastGoodCheck]) {
        await tx
          .insert(listCheck)
          .values({ id, checkedAt: now })
          .onConflictDoUpdate({ target: listCheck.id, set: { checkedAt: now } });
      }

      return made;
    });

    // Only once it's all saved, so nobody hears about a change that didn't happen.
    for (const summary of changes) {
      await notify(db, "medicine_changed", summary);
    }
  } catch (error) {
    console.error("Couldn't refresh the shortage list:", error);
  }
}

/** Saves what the list says, and returns what to tell people about tracked medicines that changed. */
async function applyReports(db: Database, found: { medicines: ReportedMedicine[]; mentioned: Set<string> }, complete: boolean, now: Date): Promise<string[]> {
  // The made-up medicines go once the real list arrives, so nobody mistakes one for a real shortage.
  await db.delete(medicine).where(
    inArray(
      medicine.id,
      sampleMedicines.map((item) => item.id),
    ),
  );

  const rows = await db.select({ id: medicine.id, status: medicine.status, reason: medicine.reason, expectedBack: medicine.expectedBack, maker: medicine.maker }).from(medicine);
  const before = new Map(rows.map((row) => [row.id, row]));
  const tracked = new Set((await db.selectDistinct({ id: trackedMedicine.medicineId }).from(trackedMedicine)).map((row) => row.id));
  const fresh = found.medicines.filter((item) => !before.has(item.id));
  const changes: string[] = [];

  for (let start = 0; start < fresh.length; start += 500) {
    const batch = fresh.slice(start, start + 500);

    await db
      .insert(medicine)
      .values(batch.map(({ changedAt, ...item }) => ({ ...item, lastChangedAt: changedAt })))
      .onConflictDoNothing();
    await db
      .insert(medicineChange)
      .values(batch.map((item) => ({ medicineId: item.id, status: item.status, note: noteFor(item.status, item.reason), changedAt: item.changedAt })));
  }

  for (const item of found.medicines) {
    const was = before.get(item.id);
    const { changedAt, id, ...details } = item;

    if (!was) {
      continue;
    }

    if (was.status === item.status) {
      // Same status: keep the details fresh, without calling it a change.
      if (was.reason !== details.reason || was.expectedBack !== details.expectedBack || was.maker !== details.maker) {
        await db.update(medicine).set({ reason: details.reason, expectedBack: details.expectedBack, maker: details.maker }).where(eq(medicine.id, id));
      }

      continue;
    }

    const summary = await changeStatus(db, id, item.status, noteFor(item.status, item.reason), changedAt, details);

    if (summary && tracked.has(id)) {
      changes.push(summary);
    }
  }

  // Off the list now, so no longer short (one that's no longer made stays that way). Only when the whole list was read.
  if (complete) {
    const gone = rows.filter((row) => row.id.startsWith(realPrefix) && !found.mentioned.has(row.id) && (row.status === "shortage" || row.status === "expected"));

    for (const row of gone) {
      const summary = await changeStatus(db, row.id, "available", "Taken off the shortage list: it should be available again.", now, { expectedBack: null, reason: null });

      if (summary && tracked.has(row.id)) {
        changes.push(summary);
      }
    }
  }

  return changes;
}

/** Changes a medicine's status and records it. Returns what to tell people, or null if there was no such medicine. */
async function changeStatus(db: Database, medicineId: string, status: Status, note: string, changedAt: Date, details: Partial<Omit<ReportedMedicine, "id" | "changedAt">>): Promise<string | null> {
  const [updated] = await db
    .update(medicine)
    .set({ ...details, status, lastChangedAt: changedAt })
    .where(eq(medicine.id, medicineId))
    .returning();

  if (!updated) {
    return null;
  }

  await db.insert(medicineChange).values({ medicineId, status, note, changedAt });

  return `${`${updated.name} ${updated.strength}`.trim()} is now: ${statusLabel(status).toLowerCase()}.`;
}

function noteFor(status: Status, reason: string | null): string {
  const said = {
    shortage: "Reported in short supply.",
    expected: "A shortage or discontinuation is expected.",
    discontinued: "No longer made.",
    available: "Reported available again.",
  }[status];

  return reason ? `${said} ${reason}`.slice(0, 500) : said;
}

/** Whether the list holds real medicines from the shortage list, so pages can say where it comes from. */
export async function hasRealMedicines(db: Database): Promise<boolean> {
  const [row] = await db
    .select({ id: medicine.id })
    .from(medicine)
    .where(like(medicine.id, `${realPrefix}%`))
    .limit(1);

  return row !== undefined;
}
