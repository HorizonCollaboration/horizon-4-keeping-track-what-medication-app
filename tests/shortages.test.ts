import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { medicine, medicineChange, user } from "@/db/schema";
import { lastChecked, loadMedicines, loadSampleMedicines } from "@/lib/data/medicines";
import { hasRealMedicines, refreshShortages, shortageSource, toMedicine, type ShortageSource } from "@/lib/data/shortages";
import { trackMedicine } from "@/lib/data/tracking";
import { sampleMedicines } from "@/sampleData";
import { testDatabase } from "./db";

const told: string[] = [];

vi.mock("@/lib/updates", () => ({
  notify: async (_db: unknown, kind: string, summary: string) => {
    told.push(`${kind}: ${summary}`);
  },
}));

const source: ShortageSource = { url: "https://shortages.test/api/v1", email: "app@example.com", password: "secret" };
const now = new Date("2026-03-10T15:00:00Z");
const minutesLater = (minutes: number) => new Date(now.getTime() + minutes * 60 * 1000);

/** A made-up report, shaped like the shortage list's. */
function report(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001,
    din: "00012345",
    en_drug_brand_name: "AMOXI-TEST",
    en_drug_common_name: "AMOXICILLIN",
    drug_strength: "250 mg/5 mL",
    drug_dosage_form: "Suspension",
    company_name: "Test Pharma Inc",
    status: "active_confirmed",
    shortage_reason: { en_reason: "Demand increase for the drug." },
    estimated_end_date: "2026-04-01",
    updated_date: "2026-03-09T10:00:00Z",
    ...overrides,
  };
}

const other = { id: 1002, din: "00067890", en_drug_brand_name: "SALBU-TEST", en_drug_common_name: "SALBUTAMOL" };

/**
 * A pretend shortage list: signs in, then answers each search with these
 * reports, saying how many there are unless told not to (or it's down).
 */
function listSaying(reports: Record<string, unknown>[] | "down", { saysTotal = true } = {}) {
  return vi.fn(async (url: string | URL | Request) => {
    const address = String(url);

    if (reports === "down") {
      return new Response("Service unavailable", { status: 503 });
    }

    if (address.endsWith("/login")) {
      return new Response("{}", { status: 200, headers: { "auth-token": "token-1" } });
    }

    const data = reports.filter((item) => item.status === new URL(address).searchParams.get("filter_status"));

    return Response.json(saysTotal ? { data, total: data.length } : { data });
  }) as unknown as typeof fetch;
}

async function statusOf(db: Database, id: string) {
  const [row] = await db.select().from(medicine).where(eq(medicine.id, id));

  return row?.status;
}

let db: Database;

beforeEach(async () => {
  told.length = 0;
  db = await testDatabase();
});

describe("the real shortage list", () => {
  it("is only used when its account is set up, at an https address", () => {
    expect(shortageSource({})).toBeNull();
    expect(shortageSource({ OUTSIDE_SHORTAGES_EMAIL: "app@example.com" })).toBeNull();
    expect(shortageSource({ OUTSIDE_SHORTAGES_EMAIL: "app@example.com", OUTSIDE_SHORTAGES_PASSWORD: "secret" })?.url).toBe("https://www.healthproductshortages.ca/api/v1");
    expect(shortageSource({ OUTSIDE_SHORTAGES_EMAIL: "app@example.com", OUTSIDE_SHORTAGES_PASSWORD: "secret", OUTSIDE_SHORTAGES_API_URL: "http://shortages.test" })).toBeNull();
  });

  it("keeps the sample medicines when it isn't set up", async () => {
    const later = vi.fn();

    await loadMedicines(db, { source: null, later });

    expect(await db.$count(medicine)).toBe(sampleMedicines.length);
    expect(later).not.toHaveBeenCalled();
    expect(await hasRealMedicines(db)).toBe(false);
  });

  it("shows the sample medicines on a fresh install without waiting, then checks the list after the page is sent", async () => {
    const fetcher = listSaying([report()]);
    const scheduled: (() => Promise<void>)[] = [];

    await loadMedicines(db, { source: { ...source }, later: (work) => scheduled.push(work) });

    expect(await db.$count(medicine)).toBe(sampleMedicines.length);
    expect(scheduled).toHaveLength(1);

    // What the scheduled check does, with the pretend list.
    await refreshShortages(db, source, { now, fetcher });

    expect((await db.select().from(medicine)).map((row) => row.id)).toEqual(["hps-00012345"]);
    expect(await hasRealMedicines(db)).toBe(true);
  });

  it("reads a report as a medicine, by its DIN, in the app's words", () => {
    expect(toMedicine(report())).toMatchObject({
      id: "hps-00012345",
      name: "AMOXI-TEST (AMOXICILLIN)",
      strength: "250 mg/5 mL",
      form: "Suspension",
      maker: "Test Pharma Inc",
      status: "shortage",
      reason: "Demand increase for the drug.",
      expectedBack: "2026-04-01",
    });
    expect(toMedicine(report({ status: "anticipated_shortage" }))?.status).toBe("expected");
    expect(toMedicine(report({ status: "discontinued" }))).toMatchObject({ status: "discontinued", expectedBack: null });
    expect(toMedicine(report({ status: "resolved" }))?.status).toBe("available");
    expect(toMedicine(report({ status: "something_new" }))).toBeNull();
    expect(toMedicine({ status: "active_confirmed" })).toBeNull();
  });

  it("replaces the sample medicines with the real list", async () => {
    await loadSampleMedicines(db, now);

    await refreshShortages(db, source, { now, fetcher: listSaying([report(), report({ ...other, status: "anticipated_shortage" })]) });

    const rows = await db.select().from(medicine);
    expect(rows.map((row) => [row.id, row.status]).sort()).toEqual([
      ["hps-00012345", "shortage"],
      ["hps-00067890", "expected"],
    ]);
    expect(await lastChecked(db)).toEqual(now);
  });

  it("records a change and tells people when a tracked medicine's status changes", async () => {
    await db.insert(user).values({ id: "sam", name: "Sam", email: "sam@example.com" });
    await refreshShortages(db, source, { now, fetcher: listSaying([report({ status: "anticipated_shortage" })]) });
    await trackMedicine(db, "sam", "hps-00012345");

    await refreshShortages(db, source, { now: minutesLater(7 * 60), fetcher: listSaying([report({ updated_date: "2026-03-10T20:00:00Z" })]) });

    const history = await db.select().from(medicineChange).where(eq(medicineChange.medicineId, "hps-00012345"));
    expect(await statusOf(db, "hps-00012345")).toBe("shortage");
    expect(history.map((change) => change.status).sort()).toEqual(["expected", "shortage"]);
    expect(told).toEqual(["medicine_changed: AMOXI-TEST (AMOXICILLIN) 250 mg/5 mL is now: short supply."]);
  });

  it("marks a medicine available once it's off a list that was read in full", async () => {
    await refreshShortages(db, source, { now, fetcher: listSaying([report(), report(other)]) });

    await refreshShortages(db, source, { now: minutesLater(7 * 60), fetcher: listSaying([report(other)]) });

    expect(await statusOf(db, "hps-00012345")).toBe("available");
  });

  it("leaves a medicine as it is when the list wasn't read in full", async () => {
    await refreshShortages(db, source, { now, fetcher: listSaying([report(), report(other)]) });

    await refreshShortages(db, source, { now: minutesLater(7 * 60), fetcher: listSaying([report(other)], { saysTotal: false }) });

    expect(await statusOf(db, "hps-00012345")).toBe("shortage");
  });

  it("leaves a medicine as it is when its newest report can't be read", async () => {
    await refreshShortages(db, source, { now, fetcher: listSaying([report(), report(other)]) });

    await refreshShortages(db, source, {
      now: minutesLater(7 * 60),
      fetcher: listSaying([report(other), report({ id: 1003, en_drug_brand_name: undefined, en_drug_common_name: undefined, updated_date: "2026-03-10T20:00:00Z" })]),
    });

    expect(await statusOf(db, "hps-00012345")).toBe("shortage");
  });

  it("keeps what it said last time when the list can't be reached, and tries again once the lease is up", async () => {
    await refreshShortages(db, source, { now, fetcher: listSaying([report()]) });
    await refreshShortages(db, source, { now: minutesLater(7 * 60), fetcher: listSaying("down") });

    expect(await statusOf(db, "hps-00012345")).toBe("shortage");
    expect(await lastChecked(db)).toEqual(now);

    const retry = listSaying([report({ status: "discontinued", updated_date: "2026-03-10T23:00:00Z" })]);
    await refreshShortages(db, source, { now: minutesLater(7 * 60 + 5), fetcher: retry });
    expect(retry).not.toHaveBeenCalled();

    await refreshShortages(db, source, { now: minutesLater(7 * 60 + 11), fetcher: retry });
    expect(await statusOf(db, "hps-00012345")).toBe("discontinued");
  });

  it("tries again after the lease when the list came back empty", async () => {
    await refreshShortages(db, source, { now, fetcher: listSaying([]) });

    await refreshShortages(db, source, { now: minutesLater(11), fetcher: listSaying([report()]) });

    expect(await statusOf(db, "hps-00012345")).toBe("shortage");
  });

  it("checks no more than every few hours after a good check", async () => {
    const fetcher = listSaying([report()]);

    await refreshShortages(db, source, { now, fetcher });
    await refreshShortages(db, source, { now: minutesLater(60), fetcher });

    expect(vi.mocked(fetcher).mock.calls.filter(([url]) => String(url).endsWith("/login"))).toHaveLength(1);
  });
});
