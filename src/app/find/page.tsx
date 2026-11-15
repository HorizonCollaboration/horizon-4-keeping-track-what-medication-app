import { LogIn, Pill, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceNote } from "@/components/SourceNote";
import { StatusTag } from "@/components/StatusTag";
import { TrackButton } from "@/components/TrackButton";
import { db } from "@/db";
import { Button, EmptyState, List, Row, ScreenHeader, Tile } from "@/kit";
import { fullName, loadMedicines, searchMedicines } from "@/lib/data/medicines";
import { trackedIds } from "@/lib/data/tracking";
import { isStatus } from "@/lib/statuses";
import { currentUser } from "@/lib/session";
import { FindFilters } from "./FindFilters";

/** Find a medicine: search the whole list by name and status. Anyone can, signed in or not. */
export default async function FindPage({ searchParams }: PageProps<"/find">) {
  const user = await currentUser();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const status = typeof params.status === "string" && isStatus(params.status) ? params.status : "all";

  await loadMedicines(db);

  const [results, tracking] = await Promise.all([searchMedicines(db, { query, status }), user ? trackedIds(db, user.id) : new Set<string>()]);

  return (
    <AppShell current="find" user={user}>
      <ScreenHeader
        icon={Search}
        title="Find a medicine"
        description="Search the government's public list of medicine shortages, and track the ones you care about."
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
              ? `Nothing matches "${query.trim()}". Check the spelling, or try the name on the medicine's label.`
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
              description={`${item.form} · ${item.maker}`}
              actions={<TrackButton medicineId={item.id} name={fullName(item)} tracking={tracking.has(item.id)} signedIn={user !== null} place="row" />}
            >
              <StatusTag status={item.status} />
            </Row>
          ))}
        </List>
      )}

      <SourceNote />
    </AppShell>
  );
}
