import { describe, expect, it } from "vitest";
import { getMedicine, lastChecked, loadSampleMedicines, searchMedicines } from "@/lib/data/medicines";
import { medicine } from "@/db/schema";
import { dayLabel, lastDays } from "@/lib/dates";
import { sampleMedicines } from "@/sampleData";
import { testDatabase } from "./db";

const now = new Date("2026-03-10T15:00:00Z");

describe("the medicine list", () => {
  it("starts with the sample medicines, once, however often it's loaded", async () => {
    const db = await testDatabase();

    await loadSampleMedicines(db, now);
    await loadSampleMedicines(db, now);

    expect(await db.$count(medicine)).toBe(sampleMedicines.length);
    expect(await lastChecked(db)).toEqual(now);
  });

  it("finds medicines by any word of their name, form or maker, ignoring capitals", async () => {
    const db = await testDatabase();
    await loadSampleMedicines(db, now);

    const found = await searchMedicines(db, { query: "AMOXICILLIN liquid", status: "all" });

    expect(found.map((item) => item.id)).toEqual(["amoxicillin-liquid"]);
  });

  it("filters by status, and finds nothing for a search that matches nothing", async () => {
    const db = await testDatabase();
    await loadSampleMedicines(db, now);

    const short = await searchMedicines(db, { query: "", status: "shortage" });

    expect(short.length).toBeGreaterThan(0);
    expect(short.every((item) => item.status === "shortage")).toBe(true);
    expect(await searchMedicines(db, { query: "zzz", status: "all" })).toEqual([]);
    expect(await searchMedicines(db, { query: "%", status: "all" })).toEqual([]);
  });

  it("lists the most urgent first", async () => {
    const db = await testDatabase();
    await loadSampleMedicines(db, now);

    const all = await searchMedicines(db, { query: "", status: "all" });

    expect(all[0].status).toBe("shortage");
    expect(all.at(-1)?.status).toBe("available");
  });

  it("shows a medicine's details and its history, newest first", async () => {
    const db = await testDatabase();
    await loadSampleMedicines(db, now);

    const amoxicillin = await getMedicine(db, "amoxicillin-liquid");

    expect(amoxicillin?.status).toBe("shortage");
    expect(amoxicillin?.expectedBack).toBe("2026-03-31");
    expect(amoxicillin?.history.map((change) => change.status)).toEqual(["shortage", "expected", "available"]);
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
