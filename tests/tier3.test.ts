import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { medicine, medicineChange, trackedMedicine, user } from "@/db/schema";
import { lastChecked, loadMedicines, loadSampleMedicines } from "@/lib/data/medicines";
import { fewestRows, idFor, mostDropOffs, readTier3Table, refreshTier3, removeRetiredMedicines, tier3Page } from "@/lib/data/tier3";
import { trackMedicine } from "@/lib/data/tracking";
import page from "./fixtures/tier-3-shortages.html?raw";
import { testDatabase } from "./db";

const told: string[] = [];

vi.mock("@/lib/updates", () => ({
  notify: async (_db: unknown, kind: string, summary: string) => {
    told.push(`${kind}: ${summary}`);
  },
}));

const now = new Date("2026-11-15T15:00:00Z");
const hoursLater = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);

/** Health Canada's page as read on 15 Nov 2026: 29 medicines. */
const realRows = readTier3Table(page);

/** A Tier 3 table holding these medicines, laid out as Health Canada's is. */
function tableOf(names: string[], date = "2026-10-01"): string {
  const rows = names.map((name) => `<tr><td>${name}</td><td>${date}</td><td>Health Canada</td><td>No</td></tr>`).join("\n");

  return `<table><thead><tr><th>Drug (Active Ingredient)</th><th>Date of Tier 3 Determination</th><th>TAC Committee Membership</th><th>Used in the treatment of COVID-19 and/or related conditions (Yes/No)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const names = (count: number) => Array.from({ length: count }, (_, index) => `Test Medicine ${index + 1}`);

/** A pretend canada.ca: answers with this page, or fails. */
function canadaSaying(html: string | "down") {
  return vi.fn(async (url: string | URL | Request) => {
    expect(String(url)).toBe(tier3Page);

    return html === "down" ? new Response("Service unavailable", { status: 503 }) : new Response(html, { status: 200 });
  }) as unknown as typeof fetch;
}

async function statusOf(db: Database, name: string) {
  const [row] = await db.select().from(medicine).where(eq(medicine.id, idFor(name)));

  return row?.status;
}

let db: Database;

beforeEach(async () => {
  told.length = 0;
  db = await testDatabase();
});

describe("reading Health Canada's Tier 3 page", () => {
  it("reads every medicine in the table, with its date and COVID-19 answer", () => {
    expect(realRows).toHaveLength(29);
    expect(realRows[0]).toEqual({ id: "t3-estrogen-transdermal-patches", name: "Estrogen Transdermal Patches", tier3Since: "2026-10-28", usedForCovid: false });
    expect(realRows.map((row) => row.name)).toContain("Bicillin L-A (Penicillin G benzathine)");
    expect(realRows.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.tier3Since ?? ""))).toBe(true);
  });

  it("never keeps the committee members", () => {
    expect(JSON.stringify(realRows)).not.toContain("Canadian Medical Association");
  });

  it("leaves out rows without a drug name, and decodes the page's text", () => {
    const rows = readTier3Table(tableOf(["", "Lidocaine 2% with Epinephrine &amp; Saline"]));

    expect(rows.map((row) => row.name)).toEqual(["Lidocaine 2% with Epinephrine & Saline"]);
  });

  it("reads the table the same when each row's first cell is a row heading", () => {
    const withRowHeadings = page.replace(/<tr>\s*<td>([\s\S]*?)<\/td>/g, '<tr>\n      <th scope="row">$1</th>');

    expect(withRowHeadings).not.toEqual(page);
    expect(readTier3Table(withRowHeadings)).toEqual(realRows);
  });

  it("refuses a table whose columns were read wrongly, rather than saving dates as medicines", () => {
    const shifted = page.replace(/<tr>\s*<td>[\s\S]*?<\/td>/g, "<tr>");

    expect(() => readTier3Table(shifted)).toThrow("had a name and a date");
  });

  it("keeps the newest date for a medicine listed twice", () => {
    const table = tableOf(["Test Medicine 1"], "2026-01-01").replace("</tbody>", "<tr><td>Test Medicine 1</td><td>2026-05-01</td><td></td><td>No</td></tr></tbody>");

    expect(readTier3Table(table).map((row) => row.tier3Since)).toEqual(["2026-05-01"]);
  });

  it("fails when the page has no Tier 3 table", () => {
    expect(() => readTier3Table("<table><tr><th>Something else</th></tr></table>")).toThrow("Couldn't find the Tier 3 table");
  });
});

describe("the medicine list", () => {
  it("is Health Canada's list once read, never anything made up", async () => {
    await refreshTier3(db, { now, fetcher: canadaSaying(page) });

    expect(await db.$count(medicine)).toBe(29);
    expect(await lastChecked(db)).toEqual(now);
    expect(told).toEqual([]);
  });

  it("takes out the made-up medicines earlier versions kept, with anyone's tracking of them", async () => {
    await db.insert(user).values({ id: "sam", name: "Sam", email: "sam@example.com" });
    await db.insert(medicine).values({ id: "amoxicillin-liquid", name: "Amoxicillin", strength: "250 mg/5 mL", form: "Liquid", maker: "Northbay Pharma", status: "shortage" });
    await trackMedicine(db, "sam", "amoxicillin-liquid");

    await removeRetiredMedicines(db);

    expect(await db.$count(medicine)).toBe(0);
    expect(await db.$count(trackedMedicine)).toBe(0);
  });

  it("takes out the tests' sample medicines, should they ever reach a real database", async () => {
    await loadSampleMedicines(db, now);

    await removeRetiredMedicines(db);

    expect(await db.$count(medicine)).toBe(0);
  });

  it("waits for the first read, then reads again only after the page is sent", async () => {
    const read = vi.fn(async () => {});
    const later = vi.fn();

    await loadMedicines(db, { read, later });
    expect(read).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();

    await refreshTier3(db, { now, fetcher: canadaSaying(page) });
    await loadMedicines(db, { read, later });
    expect(read).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it("shows nothing at all when the page has never been read", async () => {
    await refreshTier3(db, { now, fetcher: canadaSaying("down") });

    expect(await db.$count(medicine)).toBe(0);
    expect(await lastChecked(db)).toBeNull();
  });

  it("keeps the last list when a later read fails, and tries again once the lease is up", async () => {
    await refreshTier3(db, { now, fetcher: canadaSaying(page) });
    await refreshTier3(db, { now: hoursLater(7), fetcher: canadaSaying("down") });

    expect(await db.$count(medicine)).toBe(29);
    expect(await lastChecked(db)).toEqual(now);

    const retry = canadaSaying(page);
    await refreshTier3(db, { now: hoursLater(7.1), fetcher: retry });
    expect(retry).not.toHaveBeenCalled();

    await refreshTier3(db, { now: hoursLater(7.2), fetcher: retry });
    expect(await lastChecked(db)).toEqual(hoursLater(7.2));
  });

  it("reads the page no more than every few hours", async () => {
    const fetcher = canadaSaying(page);

    await refreshTier3(db, { now, fetcher });
    await refreshTier3(db, { now: hoursLater(1), fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("saves nothing from a table far too small to be the real list", async () => {
    await refreshTier3(db, { now, fetcher: canadaSaying(tableOf(names(fewestRows - 1))) });

    expect(await db.$count(medicine)).toBe(0);
    expect(await lastChecked(db)).toBeNull();
  });
});

describe("medicines joining and leaving the list", () => {
  beforeEach(async () => {
    await db.insert(user).values({ id: "sam", name: "Sam", email: "sam@example.com" });
    await refreshTier3(db, { now, fetcher: canadaSaying(tableOf(names(10))) });
    await trackMedicine(db, "sam", idFor("Test Medicine 1"));
  });

  it("marks a medicine that's left the list, and tells people who track it", async () => {
    await refreshTier3(db, { now: hoursLater(7), fetcher: canadaSaying(tableOf(names(10).slice(1))) });

    const history = await db.select().from(medicineChange).where(eq(medicineChange.medicineId, idFor("Test Medicine 1")));
    expect(await statusOf(db, "Test Medicine 1")).toBe("delisted");
    expect(history.map((change) => change.status).sort()).toEqual(["delisted", "listed"]);
    expect(told).toEqual(["medicine_changed: Test Medicine 1 is no longer on Health Canada's Tier 3 list of the most serious drug shortages."]);
  });

  it("doesn't take medicines off when the table is much smaller than the list", async () => {
    await refreshTier3(db, { now: hoursLater(7), fetcher: canadaSaying(tableOf(names(10).slice(6))) });

    expect(await statusOf(db, "Test Medicine 1")).toBe("listed");
    expect(told).toEqual([]);
  });

  it(`doesn't take more than ${mostDropOffs} medicines off at once, but still adds new ones`, async () => {
    const swapped = [...names(10).slice(mostDropOffs + 1), ...Array.from({ length: mostDropOffs + 1 }, (_, index) => `Other Medicine ${index + 1}`)];

    await refreshTier3(db, { now: hoursLater(7), fetcher: canadaSaying(tableOf(swapped)) });

    expect(await statusOf(db, "Test Medicine 1")).toBe("listed");
    expect(await statusOf(db, "Other Medicine 1")).toBe("listed");
  });

  it("treats Health Canada rewording a medicine's name as the same medicine, without telling anyone", async () => {
    await refreshTier3(db, { now: hoursLater(7), fetcher: canadaSaying(tableOf(["TestMedicine-1", ...names(10).slice(1)])) });

    const [renamed] = await db.select().from(medicine).where(eq(medicine.id, idFor("Test Medicine 1")));
    expect(renamed).toMatchObject({ name: "TestMedicine-1", status: "listed" });
    expect(await db.$count(medicine)).toBe(10);
    expect(await db.$count(trackedMedicine)).toBe(1);
    expect(told).toEqual([]);

    // Read again later under its new name, it's still the same medicine.
    await refreshTier3(db, { now: hoursLater(14), fetcher: canadaSaying(tableOf(["TestMedicine-1", ...names(10).slice(1)])) });
    expect(await db.$count(medicine)).toBe(10);
    expect(told).toEqual([]);
  });

  it("tells people when a medicine joins the list, or a tracked one comes back", async () => {
    await refreshTier3(db, { now: hoursLater(7), fetcher: canadaSaying(tableOf(names(10).slice(1))) });
    told.length = 0;

    await refreshTier3(db, { now: hoursLater(14), fetcher: canadaSaying(tableOf([...names(10), "Test Medicine 11"])) });

    expect(await statusOf(db, "Test Medicine 1")).toBe("listed");
    expect(told).toEqual([
      "medicine_changed: Test Medicine 1 is back on Health Canada's Tier 3 list of the most serious drug shortages.",
      "tier3_added: Test Medicine 11 was added to Health Canada's Tier 3 list, its most serious drug shortages.",
    ]);
  });
});
