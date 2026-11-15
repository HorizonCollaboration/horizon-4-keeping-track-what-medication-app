import { db } from "@/db";
import { hasRealMedicines } from "@/lib/data/shortages";

/** Where the list comes from: the real shortage list once its medicines are in, otherwise that they're made up. */
export async function SourceNote() {
  return (
    <p className="text-sm text-muted-foreground">
      {(await hasRealMedicines(db)) ? (
        <>
          Shortage information from Health Canada&apos;s{" "}
          <a className="font-medium text-foreground underline underline-offset-2" href="https://www.healthproductshortages.ca">
            Health Product Shortages Canada
          </a>
          , reported by the companies that make each medicine. Ask a pharmacist before acting on it.
        </>
      ) : (
        "These are made-up sample medicines, not real shortages."
      )}
    </p>
  );
}
