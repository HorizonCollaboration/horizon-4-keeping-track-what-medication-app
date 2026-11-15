import { db } from "@/db";
import { lastChecked } from "@/lib/data/medicines";
import { tier3Page } from "@/lib/data/tier3";
import { fullDayText, timeText } from "@/lib/dates";

/**
 * Where the list comes from, as canada.ca's terms ask: the material's full
 * title, that this is a copy of the version on canada.ca, and when it was read.
 */
export async function SourceNote() {
  const checkedAt = await lastChecked(db);

  return (
    <p className="text-sm text-muted-foreground">
      From Health Canada&apos;s{" "}
      <a className="font-medium text-foreground underline underline-offset-2" href={tier3Page}>
        &lsquo;Tier 3 drug shortages&rsquo;
      </a>
      , a copy of the version at canada.ca
      {checkedAt ? `, as read on ${fullDayText(checkedAt)} at ${timeText(checkedAt)}.` : ". It hasn't been read yet."} It lists only the shortages Health Canada rates
      most serious, not every shortage. Ask a pharmacist before acting on it.
    </p>
  );
}
