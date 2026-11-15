import { describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import { loadSampleMedicines } from "@/lib/data/medicines";
import { changesToTracked, listTracked, stopTracking, trackMedicine, trackedIds } from "@/lib/data/tracking";
import { daysBefore } from "@/lib/dates";
import { testDatabase } from "./db";

const now = new Date("2026-03-10T15:00:00Z");

async function withPeople() {
  const db = await testDatabase();
  await db.insert(user).values([
    { id: "sam", name: "Sam", email: "sam@example.com" },
    { id: "ana", name: "Ana", email: "ana@example.com" },
  ]);
  await loadSampleMedicines(db, now);

  return db;
}

describe("tracking medicines", () => {
  it("keeps each person's list to themselves", async () => {
    const db = await withPeople();

    await trackMedicine(db, "sam", "t3-sample-salbutamol-inhaler");
    await trackMedicine(db, "sam", "t3-sample-amoxicillin-liquid");

    expect((await listTracked(db, "sam")).map((item) => item.id)).toEqual(["t3-sample-amoxicillin-liquid", "t3-sample-salbutamol-inhaler"]);
    expect(await listTracked(db, "ana")).toEqual([]);
  });

  it("tracks a medicine once, however often it's pressed", async () => {
    const db = await withPeople();

    await trackMedicine(db, "sam", "t3-sample-metformin");
    await trackMedicine(db, "sam", "t3-sample-metformin");

    expect(await trackedIds(db, "sam")).toEqual(new Set(["t3-sample-metformin"]));
  });

  it("won't track a medicine that isn't on the list", async () => {
    const db = await withPeople();

    expect(await trackMedicine(db, "sam", "made-up-medicine")).toBeNull();
    expect(await listTracked(db, "sam")).toEqual([]);
  });

  it("only lets people stop tracking on their own list", async () => {
    const db = await withPeople();
    await trackMedicine(db, "sam", "t3-sample-metformin");
    await trackMedicine(db, "ana", "t3-sample-metformin");

    await stopTracking(db, "ana", "t3-sample-metformin");

    expect(await trackedIds(db, "sam")).toEqual(new Set(["t3-sample-metformin"]));
    expect(await trackedIds(db, "ana")).toEqual(new Set());
  });

  it("shows changes only to the medicines someone tracks, newest first", async () => {
    const db = await withPeople();
    await trackMedicine(db, "sam", "t3-sample-amoxicillin-liquid");
    await trackMedicine(db, "sam", "t3-sample-salbutamol-inhaler");
    await trackMedicine(db, "ana", "t3-sample-methylphenidate");

    const changes = await changesToTracked(db, "sam", daysBefore(now, 7));

    expect(changes.map((change) => [change.medicineId, change.status])).toEqual([
      ["t3-sample-salbutamol-inhaler", "delisted"],
    ]);
  });
});
