import { Pill, RefreshCw, Search } from "lucide-react";
import { AppShell, type TabId } from "@/components/AppShell";
import { SourceNote } from "@/components/SourceNote";
import { StatusTag } from "@/components/StatusTag";
import { TrackButton } from "@/components/TrackButton";
import { db } from "@/db";
import { Button, Card, EmptyState, List, Row, ScreenHeader, Section, Tag, Tile } from "@/kit";
import { fullName, getMedicine, loadMedicines } from "@/lib/data/medicines";
import { trackedIds } from "@/lib/data/tracking";
import { calendarDate, whenText } from "@/lib/dates";
import { currentUser } from "@/lib/session";

/** Where someone came from, so "back" takes them there. */
const cameFrom: Record<string, { tab: TabId; label: string; href: string }> = {
  mine: { tab: "mine", label: "My medicines", href: "/" },
  updates: { tab: "updates", label: "Updates", href: "/my-updates" },
  find: { tab: "find", label: "Find a medicine", href: "/find" },
};

/** One medicine in full: whether it's on Health Canada's Tier 3 list, since when, and what's changed. */
export default async function MedicinePage({ params, searchParams }: PageProps<"/medicines/[id]">) {
  const user = await currentUser();
  const { id } = await params;
  const from = (await searchParams).from;
  const back = (typeof from === "string" && cameFrom[from]) || cameFrom.find;
  // Updates is only there once signed in.
  const place = !user && back.tab === "updates" ? cameFrom.find : back;

  await loadMedicines(db);

  const item = await getMedicine(db, id.slice(0, 100));

  if (!item) {
    return (
      <AppShell current={place.tab} user={user}>
        <ScreenHeader back={{ label: place.label, href: place.href }} icon={Pill} title="Medicine not found" />
        <EmptyState
          icon={Search}
          title="We couldn't find that medicine"
          description="It may have been taken off the list. Search for it by name instead."
          action={
            <Button variant="primary" href="/find">
              <Search aria-hidden="true" />
              Find a medicine
            </Button>
          }
        />
      </AppShell>
    );
  }

  const now = new Date();
  const tracking = user ? (await trackedIds(db, user.id)).has(item.id) : false;

  return (
    <AppShell current={place.tab} user={user}>
      <ScreenHeader
        back={{ label: place.label, href: place.href }}
        icon={Pill}
        title={fullName(item)}
        description={item.status === "listed" ? "On Health Canada's Tier 3 list of the most serious drug shortages." : "No longer on Health Canada's Tier 3 list."}
        action={<TrackButton medicineId={item.id} name={fullName(item)} tracking={tracking} signedIn={user !== null} place="header" />}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Right now" description={`Last changed ${whenText(item.lastChangedAt, now).toLowerCase()}`}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <StatusTag status={item.status} />
              {item.usedForCovid && <Tag tone="info">Used for COVID-19</Tag>}
            </div>
            <p>
              {item.status === "listed"
                ? "Health Canada rates this shortage among the most serious: it could have the greatest impact on Canada's drug supply and health care."
                : "Health Canada has taken it off its Tier 3 list. That doesn't always mean it's easy to get: ask your pharmacist."}
            </p>
          </div>
        </Card>
        <Card title="Tier 3 since" description="When Health Canada rated it a Tier 3 shortage.">
          <p className="text-lg font-medium">{item.tier3Since ? calendarDate(item.tier3Since) : "Not given"}</p>
        </Card>
      </div>

      <Section title="What's changed">
        <List>
          {item.history.map((change) => (
            <Row key={change.id} compact media={<Tile icon={RefreshCw} size="sm" />} title={whenText(change.changedAt, now)} description={change.note}>
              <StatusTag status={change.status} />
            </Row>
          ))}
        </List>
      </Section>

      <p className="text-sm text-muted-foreground">Always ask your pharmacist or doctor before changing or stopping any medicine.</p>
      <SourceNote />
    </AppShell>
  );
}
