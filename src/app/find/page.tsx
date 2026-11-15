import { CloudOff, LogIn, Pill, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceNote } from "@/components/SourceNote";
import { StatusTag } from "@/components/StatusTag";
import { TrackButton } from "@/components/TrackButton";
import { db } from "@/db";
import { Button, EmptyState, List, Row, ScreenHeader, Tag, Tile } from "@/kit";
import { fullName, lastChecked, loadMedicines, searchMedicines } from "@/lib/data/medicines";
import { trackedIds } from "@/lib/data/tracking";
import { calendarDate } from "@/lib/dates";
import { isStatus } from "@/lib/statuses";
import { currentUser } from "@/lib/session";
import { FindFilters } from "./FindFilters";

/** Find a medicine: search Health Canada's Tier 3 list by name and status. Anyone can, signed in or not. */
export default async function FindPage({ searchParams }: PageProps<"/find">) {
  const user = await currentUser();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const status = typeof params.status === "string" && isStatus(params.status) ? params.status : "all";

  await loadMedicines(db);

  const [results, tracking, checkedAt] = await Promise.all([searchMedicines(db, { query, status }), user ? trackedIds(db, user.id) : new Set<string>(), lastChecked(db)]);

  return (
    <AppShell current="find" user={user}>
      <ScreenHeader
        icon={Search}
        title="Find a medicine"
        description="Search Health Canada's Tier 3 list: the drug shortages it rates most serious. Track the ones you care about to hear when they join or leave it."
        action={
          user ? (
            <Button variant="primary" href="/">
              <Pill aria-hidden="true" />
              See my medicines ({tracking.size})
            </Button>
          ) : (
            <Button variant="primary" href="/sign-in">
              <LogIn aria-hidden="true" />
              Sign in to track medicines
            </Button>
          )
        }
      />

      {checkedAt === null ? (
        <EmptyState
          icon={CloudOff}
          title="We couldn't read Health Canada's list just now"
          description="Try again later. We only show what Health Canada's Tier 3 list says, so there's nothing to show until we've read it."
          action={<Button href="/find">Try again</Button>}
        />
      ) : (
        <>
          <FindFilters query={query} status={status} />

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {results.length === 1 ? "1 medicine" : `${results.length} medicines`}
          </p>

          {results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No medicines found"
              description={
                query.trim()
                  ? `Nothing matches "${query.trim()}". Only the shortages Health Canada rates most serious are listed, so a medicine that's hard to get may not be here.`
                  : "No medicines have this status right now. Try showing all medicines."
              }
              action={<Button href="/find">Show all medicines</Button>}
            />
          ) : (
            <List>
              {results.map((item) => (
                <Row
                  key={item.id}
                  href={`/medicines/${item.id}`}
                  media={<Tile icon={Pill} />}
                  title={fullName(item)}
                  description={item.tier3Since ? `Tier 3 since ${calendarDate(item.tier3Since)}` : undefined}
                  actions={<TrackButton medicineId={item.id} name={fullName(item)} tracking={tracking.has(item.id)} signedIn={user !== null} place="row" />}
                >
                  <StatusTag status={item.status} />
                  {item.usedForCovid && <Tag tone="info">Used for COVID-19</Tag>}
                </Row>
              ))}
            </List>
          )}
        </>
      )}

      <SourceNote />
    </AppShell>
  );
}
