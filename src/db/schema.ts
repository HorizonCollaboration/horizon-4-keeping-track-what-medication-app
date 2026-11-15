/*
 * The app's own tables. Each person is a row in `user` (from the sign-in
 * tables): refer to it with `.references(() => user.id, { onDelete: "cascade" })`.
 * Only ever add tables and columns; never rename or remove one, so a new
 * version never loses what people have entered.
 */
import { boolean, date, index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export { user };

/**
 * The shared list of medicines. Nobody owns it: it's a copy of Health
 * Canada's list of Tier 3 drug shortages. status is one of the keys in
 * src/lib/statuses.ts. strength, form and maker are from an earlier version
 * and left empty now, as the list doesn't give them.
 */
export const medicine = pgTable("medicine", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  strength: text("strength").notNull(),
  form: text("form").notNull(),
  maker: text("maker").notNull(),
  status: text("status").notNull(),
  reason: text("reason"),
  expectedBack: date("expected_back", { mode: "string" }),
  lastChangedAt: timestamp("last_changed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** When Health Canada rated it a Tier 3 shortage, as it says. */
  tier3Since: date("tier3_since", { mode: "string" }),
  /** Whether Health Canada says it's used to treat COVID-19 or related conditions, or null if it doesn't say. */
  usedForCovid: boolean("used_for_covid"),
});

/** Each change to a medicine's status, so people can see its history. */
export const medicineChange = pgTable(
  "medicine_change",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    medicineId: text("medicine_id")
      .notNull()
      .references(() => medicine.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note").notNull(),
    changedAt: timestamp("changed_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("medicine_change_medicine_idx").on(table.medicineId, table.changedAt)],
);

/** When the shared list was last checked against the government's list. One row per list. */
export const listCheck = pgTable("list_check", {
  id: text("id").primaryKey(),
  checkedAt: timestamp("checked_at").notNull(),
});

/** The medicines each person tracks. Private to them. */
export const trackedMedicine = pgTable(
  "tracked_medicine",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    medicineId: text("medicine_id")
      .notNull()
      .references(() => medicine.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("tracked_medicine_user_medicine").on(table.userId, table.medicineId)],
);

/**
 * Each person's email alert choice, sent to the email they signed in with.
 * often is "changes" (only when something changes) or "weekly" (also a
 * weekly note when nothing has). No emails are sent yet.
 */
export const emailAlert = pgTable("email_alert", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  on: boolean("on").notNull().default(false),
  often: text("often").notNull().default("changes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
