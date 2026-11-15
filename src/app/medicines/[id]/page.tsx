import { Pill, RefreshCw, Search } from "lucide-react";
import { AppShell, type TabId } from "@/components/AppShell";
import { StatusTag } from "@/components/StatusTag";
import { TrackButton } from "@/components/TrackButton";
import { db } from "@/db";
import { Button, Card, EmptyState, List, Row, ScreenHeader, Section, Tile } from "@/kit";
import { fullName, getMedicine, loadSampleMedicines } from "@/lib/data/medicines";
import { trackedIds } from "@/lib/data/tracking";
import { calendarDate, whenText } from "@/lib/dates";
import { currentUser } from "@/lib/session";

/** Where someone came from, so "back" takes them there. */
const cameFrom: Record<string, { tab: TabId; label: string; href: string }> = {
  mine: { tab: "mine", label: "My medicines", href: "/" },
  updates: { tab: "updates", label: "Updates", href: "/my-updates" },
  find: { tab: "find", label: "Find a medicine", href: "/find" },
};

/** One medicine in full: what it is, whether you can get it, when it's expected back, and what's changed. */
export default async function MedicinePage({ params, searchParams }: PageProps<"/medicines/[id]">) {
  const user = await currentUser();
  const { id } = await params;
  const from = (await searchParams).from;
  const back = (typeof from === "string" && cameFrom[from]) || cameFrom.find;
  // Updates is only there once signed in.
  const place = !user && back.tab === "updates" ? cameFrom.find : back;

  await loadSampleMedicines(db);

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
        description={`${item.form} · made by ${item.maker}`}
        action={<TrackButton medicineId={item.id} name={fullName(item)} tracking={tracking} signedIn={user !== null} place="header" />}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Right now" description={`Last changed ${whenText(item.lastChangedAt, now).toLowerCase()}`}>
          <div className="flex flex-col gap-2">
            <div>
              <StatusTag status={item.status} />
            </div>
            {item.reason && <p>{item.reason}</p>}
            {item.status === "available" && <p>Pharmacies should be able to get it as normal.</p>}
          </div>
        </Card>
        <Card title="Expected back" description={item.expectedBack ? "The maker's best guess, which can change." : "No date given."}>
          <p className="text-lg font-medium">
            {item.expectedBack
              ? `Around ${calendarDate(item.expectedBack)}`
              : item.status === "discontinued"
                ? "Not coming back"
                : item.status === "available"
                  ? "Already available"
                  : "Not known yet"}
          </p>
        </Card>
      </div>

      <Card title="About this medicine">
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">Strength</dt>
          <dd className="col-span-2">{item.strength}</dd>
          <dt className="text-muted-foreground">Form</dt>
          <dd className="col-span-2">{item.form}</dd>
          <dt className="text-muted-foreground">Maker</dt>
          <dd className="col-span-2">{item.maker}</dd>
        </dl>
      </Card>

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
    </AppShell>
  );
}
