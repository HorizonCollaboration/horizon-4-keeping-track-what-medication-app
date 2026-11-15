import { describe, expect, it } from "vitest";
import { getMedicine, loadSampleMedicines, searchMedicines } from "@/lib/data/medicines";
import { medicine } from "@/db/schema";
import { dayLabel, lastDays } from "@/lib/dates";
import { sampleMedicines } from "@/sampleData";
import { testDatabase } from "./db";

const now = new Date("2026-03-10T15:00:00Z");

describe("the medicine list", () => {
  it("loads the sample medicines for tests once, however often it's loaded", async () => {
    const db = await testDatabase();

    await loadSampleMedicines(db, now);
    await loadSampleMedicines(db, now);

    expect(await db.$count(medicine)).toBe(sampleMedicines.length);
  });

  it("finds medicines by any word of their name, ignoring capitals", async () => {
    const db = await testDatabase();
    await loadSampleMedicines(db, now);

    const found = await searchMedicines(db, { query: "AMOXICILLIN liquid", status: "all" });

    expect(found.map((item) => item.id)).toEqual(["t3-sample-amoxicillin-liquid"]);
  });

  it("filters by status, and finds nothing for a search that matches nothing", async () => {
    const db = await testDatabase();
    await loadSampleMedicines(db, now);

    const off = await searchMedicines(db, { query: "", status: "delisted" });

    expect(off.map((item) => item.id)).toEqual(["t3-sample-salbutamol-inhaler"]);
    expect(await searchMedicines(db, { query: "zzz", status: "all" })).toEqual([]);
    expect(await searchMedicines(db, { query: "%", status: "all" })).toEqual([]);
  });

  it("lists the ones on the Tier 3 list first", async () => {
    const db = await testDatabase();
    await loadSampleMedicines(db, now);

    const all = await searchMedicines(db, { query: "", status: "all" });

    expect(all[0].status).toBe("listed");
    expect(all.at(-1)?.status).toBe("delisted");
  });

  it("shows a medicine's details and its history, newest first", async () => {
    const db = await testDatabase();
    await loadSampleMedicines(db, now);

    const salbutamol = await getMedicine(db, "t3-sample-salbutamol-inhaler");

    expect(salbutamol).toMatchObject({ status: "delisted", tier3Since: "2026-01-05", usedForCovid: true });
    expect(salbutamol?.history.map((change) => change.status)).toEqual(["delisted", "listed"]);
    expect(await getMedicine(db, "no-such-medicine")).toBeNull();
  });
});

describe("days", () => {
  it("counts each of the last week's days once, even when the clocks change", () => {
    // The clocks went forward in Canada on Sunday 8 March 2026.
    const days = lastDays(new Date("2026-03-09T04:30:00Z"), 3).map((date) => dayLabel(date, new Date("2026-03-09T04:30:00Z")));

    expect(days).toEqual(["Today", "Yesterday", "Sat 7 Mar"]);
  });
});
