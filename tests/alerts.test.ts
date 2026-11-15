import { describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import { getEmailAlert, saveEmailAlert, turnOffEmailAlert } from "@/lib/data/alerts";
import { testDatabase } from "./db";

async function withPeople() {
  const db = await testDatabase();
  await db.insert(user).values([
    { id: "sam", name: "Sam", email: "sam@example.com" },
    { id: "ana", name: "Ana", email: "ana@example.com" },
  ]);

  return db;
}

describe("email alerts", () => {
  it("are off until someone turns them on", async () => {
    const db = await withPeople();

    expect(await getEmailAlert(db, "sam")).toEqual({ on: false, often: "changes" });
  });

  it("save each person's own choice, without changing anyone else's", async () => {
    const db = await withPeople();

    await saveEmailAlert(db, "sam", "weekly");

    expect(await getEmailAlert(db, "sam")).toEqual({ on: true, often: "weekly" });
    expect(await getEmailAlert(db, "ana")).toEqual({ on: false, often: "changes" });
  });

  it("turn off, remembering how often for next time", async () => {
    const db = await withPeople();
    await saveEmailAlert(db, "sam", "weekly");
    await saveEmailAlert(db, "ana", "changes");

    await turnOffEmailAlert(db, "sam");

    expect(await getEmailAlert(db, "sam")).toEqual({ on: false, often: "weekly" });
    expect(await getEmailAlert(db, "ana")).toEqual({ on: true, often: "changes" });
  });
});
