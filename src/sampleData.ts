/*
 * Made-up data for the tests only: the app never shows it. Shaped like
 * Health Canada's list of Tier 3 drug shortages, but every medicine, date and
 * change here is invented: none of it is a real shortage.
 *
 * "ago" is how many days before the list is loaded a change happened. History
 * is newest first; the first entry is the medicine's status now.
 */
import type { Status } from "@/lib/statuses";

export type SampleMedicine = {
  id: string;
  name: string;
  tier3Since: string;
  usedForCovid: boolean;
  history: { ago: number; status: Status; note: string }[];
};

export const sampleMedicines: SampleMedicine[] = [
  {
    id: "t3-sample-amoxicillin-liquid",
    name: "Sample Amoxicillin Liquid",
    tier3Since: "2026-02-20",
    usedForCovid: false,
    history: [{ ago: 18, status: "listed", note: "Added to the Tier 3 list." }],
  },
  {
    id: "t3-sample-salbutamol-inhaler",
    name: "Sample Salbutamol Inhaler",
    tier3Since: "2026-01-05",
    usedForCovid: true,
    history: [
      { ago: 2, status: "delisted", note: "Taken off the Tier 3 list." },
      { ago: 64, status: "listed", note: "Added to the Tier 3 list." },
    ],
  },
  {
    id: "t3-sample-methylphenidate",
    name: "Sample Methylphenidate Tablets",
    tier3Since: "2026-03-01",
    usedForCovid: false,
    history: [{ ago: 9, status: "listed", note: "Added to the Tier 3 list." }],
  },
  {
    id: "t3-sample-metformin",
    name: "Sample Metformin",
    tier3Since: "2025-11-12",
    usedForCovid: false,
    history: [{ ago: 118, status: "listed", note: "Added to the Tier 3 list." }],
  },
];
