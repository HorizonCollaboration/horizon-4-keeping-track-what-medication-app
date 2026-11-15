/*
 * The real list of medicine shortages, from Health Canada's Health Product
 * Shortages Canada (formerly Drug Shortages Canada), where companies must
 * report shortages and discontinuations. It needs an account, so it's only
 * used when SHORTAGES_EMAIL and SHORTAGES_PASSWORD are set; without them the
 * app keeps its made-up sample medicines.
 *
 * The list is checked when someone opens a page and it's older than a few
 * hours. Nothing here ever fails a page: if the list can't be reached, people
 * see what it said last time.
 */
import { and, eq, inArray, lt } from "drizzle-orm";
import type { Database } from "@/db";
import { listCheck, medicine, medicineChange, trackedMedicine } from "@/db/schema";
import { statusLabel, type Status } from "@/lib/statuses";
import { notify } from "@/lib/updates";
import { sampleMedicines } from "@/sampleData";

/** The list's row in list_check, shared with the sample data, saying when it was last checked. */
const governmentList = "government-list";

/** A second row in list_check, so only one page at a time checks the list. */
const checking = "government-list-checking";

/** How long the list is trusted before it's checked again. */
export const checkEveryHours = 6;

/** Real medicines' ids start with this, so they never clash with the sample ones. */
const realPrefix = "hps-";

/** The most reports read in one check, so a check can never run away. */
const mostReports = 5000;
const perPage = 500;

/** The kinds of report worth reading: shortages now or coming, and medicines no longer made. */
const statusesToRead = ["active_confirmed", "anticipated_shortage", "to_be_discontinued", "discontinued"];

export type ShortageSource = { url: string; email: string; password: string };

/** Where the list is and the account to read it with, or null when it isn't set up. */
export function shortageSource(
  env: Record<string, string | undefined> = {
    SHORTAGES_EMAIL: process.env.SHORTAGES_EMAIL,
    SHORTAGES_PASSWORD: process.env.SHORTAGES_PASSWORD,
    SHORTAGES_API_URL: process.env.SHORTAGES_API_URL,
  },
): ShortageSource | null {
  const email = env.SHORTAGES_EMAIL?.trim();
  const password = env.SHORTAGES_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return { url: (env.SHORTAGES_API_URL?.trim() || "https://www.healthproductshortages.ca/api/v1").replace(/\/$/, ""), email, password };
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

/**
 * A report as one of the app's medicines, or null if it can't be read. A
 * medicine is known by its DIN (the number on its box), so its reports
 * become one medicine.
 */
export function toMedicine(report: Report): ReportedMedicine | null {
  const status = statusOf(text(report, "status", "status.value"));
  const din = text(report, "din", "drug.din");
  const reportId = text(report, "id", "report_id");
  const name = text(report, "en_drug_brand_name", "drug.brand_name", "en_drug_common_name", "drug.common_name", "brand_name");

  if (!status || !name || (!din && !reportId)) {
    return null;
  }

  const common = text(report, "en_drug_common_name", "drug.common_name");
  const changed = new Date(text(report, "updated_date", "actual_start_date", "anticipated_start_date", "created_date") ?? "");

  return {
    id: `${realPrefix}${(din ?? `report-${reportId}`).replace(/[^\w-]/g, "")}`.slice(0, 100),
    name: (common && common.toLowerCase() !== name.toLowerCase() ? `${name} (${common})` : name).slice(0, 200),
    strength: (text(report, "drug_strength", "drug.strength") ?? "").slice(0, 100),
    form: (text(report, "drug_dosage_form", "en_drug_dosage_form", "drug.dosage_form") ?? "Medicine").slice(0, 100),
    maker: (text(report, "company_name", "company.name") ?? "Not given").slice(0, 200),
    status,
    reason: text(report, "shortage_reason.en_reason", "en_reason", "discontinuance_reason.en_reason")?.slice(0, 500) ?? null,
    expectedBack: status === "available" || status === "discontinued" ? null : dateOnly(text(report, "estimated_end_date")),
    changedAt: Number.isNaN(changed.getTime()) ? new Date() : changed,
  };
}

/** Signs in to the list and reads its reports. Throws if it can't. */
export async function readReports(source: ShortageSource, fetcher: typeof fetch = fetch): Promise<Report[]> {
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

  for (const status of statusesToRead) {
    for (let offset = 0; offset < mostReports && reports.size < mostReports; offset += perPage) {
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

      for (const report of page) {
        reports.set(text(report, "id", "report_id") ?? `${status}-${offset}-${reports.size}`, report);
      }

      if (page.length < perPage || (typeof body.total === "number" && offset + perPage >= body.total)) {
        break;
      }
    }
  }

  return [...reports.values()];
}

/**
 * Each medicine once, from its most recently changed report, so a medicine
 * with an old report and a new one shows what the new one says.
 */
function latestByMedicine(reports: Report[]): ReportedMedicine[] {
  const latest = new Map<string, ReportedMedicine>();

  for (const report of reports) {
    const item = toMedicine(report);
    const seen = item && latest.get(item.id);

    if (item && (!seen || item.changedAt > seen.changedAt)) {
      latest.set(item.id, item);
    }
  }

  return [...latest.values()];
}

/** Claims the next check, or false if another page is checking or the list is fresh enough. */
async function claimCheck(db: Database, now: Date): Promise<boolean> {
  const before = new Date(now.getTime() - checkEveryHours * 60 * 60 * 1000);
  const [inserted] = await db.insert(listCheck).values({ id: checking, checkedAt: now }).onConflictDoNothing().returning();

  if (inserted) {
    return true;
  }

  const [claimed] = await db
    .update(listCheck)
    .set({ checkedAt: now })
    .where(and(eq(listCheck.id, checking), lt(listCheck.checkedAt, before)))
    .returning();

  return claimed !== undefined;
}

/**
 * Brings the medicine list up to date with the real one, if it's due. Records
 * each change in a medicine's history, and tells people when a medicine
 * someone tracks changes. A medicine that drops off the list of shortages is
 * available again. Never throws.
 */
export async function refreshShortages(db: Database, source: ShortageSource, { now = new Date(), fetcher = fetch }: { now?: Date; fetcher?: typeof fetch } = {}): Promise<void> {
  try {
    if (!(await claimCheck(db, now))) {
      return;
    }

    const reported = latestByMedicine(await readReports(source, fetcher));

    if (reported.length === 0) {
      // An empty answer is far more likely a fault than no shortages at all.
      return;
    }

    await applyReports(db, reported, now);
    await db
      .insert(listCheck)
      .values({ id: governmentList, checkedAt: now })
      .onConflictDoUpdate({ target: listCheck.id, set: { checkedAt: now } });
  } catch (error) {
    console.error("Couldn't refresh the shortage list:", error);
  }
}

async function applyReports(db: Database, reported: ReportedMedicine[], now: Date): Promise<void> {
  // The made-up medicines go once the real list arrives, so nobody mistakes one for a real shortage.
  await db.delete(medicine).where(
    inArray(
      medicine.id,
      sampleMedicines.map((item) => item.id),
    ),
  );

  const rows = await db.select({ id: medicine.id, status: medicine.status, reason: medicine.reason, expectedBack: medicine.expectedBack, maker: medicine.maker }).from(medicine);
  const known = new Map(rows.map((row) => [row.id, row.status]));
  const before = new Map(rows.map((row) => [row.id, row]));
  const tracked = new Set((await db.selectDistinct({ id: trackedMedicine.medicineId }).from(trackedMedicine)).map((row) => row.id));
  const fresh = reported.filter((item) => !known.has(item.id));

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

  for (const item of reported.filter((item) => known.has(item.id))) {
    const { changedAt, ...details } = item;

    if (known.get(item.id) === item.status) {
      const was = before.get(item.id);

      // Same status: keep the details fresh, without calling it a change.
      if (was && (was.reason !== details.reason || was.expectedBack !== details.expectedBack || was.maker !== details.maker)) {
        await db.update(medicine).set({ reason: details.reason, expectedBack: details.expectedBack, maker: details.maker }).where(eq(medicine.id, item.id));
      }

      continue;
    }

    await changeStatus(db, item.id, item.status, noteFor(item.status, item.reason), changedAt, tracked.has(item.id), details);
  }

  // Off the list now, so no longer short (one that's no longer made stays that way).
  const listed = new Set(reported.map((item) => item.id));
  const gone = [...known.entries()].filter(([id, status]) => id.startsWith(realPrefix) && !listed.has(id) && (status === "shortage" || status === "expected"));

  for (const [id] of gone) {
    await changeStatus(db, id, "available", "Taken off the shortage list: it should be available again.", now, tracked.has(id), { expectedBack: null, reason: null });
  }
}

/** Changes a medicine's status, records it, and tells people if someone tracks it. */
async function changeStatus(
  db: Database,
  medicineId: string,
  status: Status,
  note: string,
  changedAt: Date,
  isTracked: boolean,
  details: Partial<Omit<ReportedMedicine, "id" | "changedAt">>,
): Promise<void> {
  const [updated] = await db
    .update(medicine)
    .set({ ...details, status, lastChangedAt: changedAt })
    .where(eq(medicine.id, medicineId))
    .returning();

  if (!updated) {
    return;
  }

  await db.insert(medicineChange).values({ medicineId, status, note, changedAt });

  if (isTracked) {
    await notify(db, "medicine_changed", `${updated.name} ${updated.strength}`.trim() + ` is now: ${statusLabel(status).toLowerCase()}.`);
  }
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
