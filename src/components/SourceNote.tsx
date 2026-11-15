import { isRealList } from "@/lib/data/medicines";

/** Where the list comes from: the real shortage list when it's in use, otherwise that it's made up. */
export function SourceNote() {
  return (
    <p className="text-sm text-muted-foreground">
      {isRealList() ? (
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
