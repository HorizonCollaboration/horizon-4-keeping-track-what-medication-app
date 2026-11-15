import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { medicine, medicineChange, user } from "@/db/schema";
import { lastChecked, loadMedicines, loadSampleMedicines } from "@/lib/data/medicines";
import { refreshShortages, shortageSource, toMedicine, type ShortageSource } from "@/lib/data/shortages";
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
const later = new Date("2026-03-10T22:00:00Z");

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

/** A pretend shortage list: signs in, then answers each search with these reports (or fails). */
function listSaying(reports: Record<string, unknown>[] | "down") {
  return vi.fn(async (url: string | URL | Request) => {
    const address = String(url);

    if (reports === "down") {
      return new Response("Service unavailable", { status: 503 });
    }

    if (address.endsWith("/login")) {
      return new Response("{}", { status: 200, headers: { "auth-token": "token-1" } });
    }

    const status = new URL(address).searchParams.get("filter_status");

    return Response.json({ data: reports.filter((item) => item.status === status), total: reports.length });
  }) as unknown as typeof fetch;
}

let db: Database;

beforeEach(async () => {
  told.length = 0;
  db = await testDatabase();
});

describe("the real shortage list", () => {
  it("is only used when its account is set up", () => {
    expect(shortageSource({})).toBeNull();
    expect(shortageSource({ SHORTAGES_EMAIL: "app@example.com" })).toBeNull();
    expect(shortageSource({ SHORTAGES_EMAIL: "app@example.com", SHORTAGES_PASSWORD: "secret" })?.url).toBe("https://www.healthproductshortages.ca/api/v1");
  });

  it("keeps the sample medicines when it isn't set up", async () => {
    vi.stubEnv("SHORTAGES_EMAIL", "");

    await loadMedicines(db);

    expect(await db.$count(medicine)).toBe(sampleMedicines.length);
    vi.unstubAllEnvs();
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

    await refreshShortages(db, source, { now, fetcher: listSaying([report(), report({ id: 1002, din: "00067890", en_drug_brand_name: "SALBU-TEST", status: "anticipated_shortage" })]) });

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

    await refreshShortages(db, source, { now: later, fetcher: listSaying([report({ status: "active_confirmed", updated_date: "2026-03-10T20:00:00Z" })]) });

    const [row] = await db.select().from(medicine).where(eq(medicine.id, "hps-00012345"));
    const history = await db.select().from(medicineChange).where(eq(medicineChange.medicineId, "hps-00012345"));
    expect(row.status).toBe("shortage");
    expect(history.map((change) => change.status).sort()).toEqual(["expected", "shortage"]);
    expect(told).toEqual(["medicine_changed: AMOXI-TEST (AMOXICILLIN) 250 mg/5 mL is now: short supply."]);
  });

  it("marks a medicine available once it's off the list of shortages", async () => {
    await refreshShortages(db, source, { now, fetcher: listSaying([report(), report({ id: 1002, din: "00067890" })]) });

    await refreshShortages(db, source, { now: later, fetcher: listSaying([report({ id: 1002, din: "00067890" })]) });

    const [row] = await db.select().from(medicine).where(eq(medicine.id, "hps-00012345"));
    expect(row.status).toBe("available");
    expect(told).toEqual([]);
  });

  it("keeps what it said last time when the list can't be reached", async () => {
    await refreshShortages(db, source, { now, fetcher: listSaying([report()]) });

    await refreshShortages(db, source, { now: later, fetcher: listSaying("down") });

    expect((await db.select().from(medicine)).map((row) => row.status)).toEqual(["shortage"]);
    expect(await lastChecked(db)).toEqual(now);
  });

  it("checks no more than every few hours", async () => {
    const fetcher = listSaying([report()]);

    await refreshShortages(db, source, { now, fetcher });
    await refreshShortages(db, source, { now: new Date(now.getTime() + 60 * 60 * 1000), fetcher });

    expect(vi.mocked(fetcher).mock.calls.filter(([url]) => String(url).endsWith("/login"))).toHaveLength(1);
  });
});
