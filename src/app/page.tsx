import { Bell, LogIn, Pill, Plus, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceNote } from "@/components/SourceNote";
import { StatusTag } from "@/components/StatusTag";
import { db } from "@/db";
import { Button, Card, EmptyState, List, Row, ScreenHeader, Stat, Tag, Tile } from "@/kit";
import { fullName, lastChecked, loadMedicines } from "@/lib/data/medicines";
import { changesToTracked, listTracked } from "@/lib/data/tracking";
import { dayLabel, daysAgo, daysBefore, timeText, whenText } from "@/lib/dates";
import { currentUser } from "@/lib/session";

/** My medicines: the medicines someone tracks, and whether each is on Health Canada's Tier 3 list of the most serious shortages. */
export default async function MyMedicinesPage() {
  const user = await currentUser();
  const addButton = (
    <Button variant="primary" href="/find">
      <Plus aria-hidden="true" />
      Add a medicine
    </Button>
  );

  if (!user) {
    return (
      <AppShell current="mine" user={null}>
        <ScreenHeader icon={Pill} title="My medicines" description="Keep a list of the medicines you care about, and see whether Health Canada rates any of them among the most serious drug shortages." />
        <EmptyState
          icon={LogIn}
          title="Sign in to keep your own list"
          description="We'll email you a link to sign in. No password, and we only ask for your email. You can look up any medicine without signing in."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" href="/sign-in">
                <LogIn aria-hidden="true" />
                Sign in
              </Button>
              <Button href="/find">
                <Search aria-hidden="true" />
                Find a medicine
              </Button>
            </div>
          }
        />
      </AppShell>
    );
  }

  await loadMedicines(db);

  const now = new Date();
  const [tracked, recent, checkedAt] = await Promise.all([listTracked(db, user.id), changesToTracked(db, user.id, daysBefore(now, 7)), lastChecked(db)]);
  const thisWeek = recent.filter((change) => daysAgo(change.changedAt, now) < 7);
  const changedToday = new Set(thisWeek.filter((change) => daysAgo(change.changedAt, now) === 0).map((change) => change.medicineId)).size;

  return (
    <AppShell current="mine" user={user}>
      <ScreenHeader icon={Pill} title="My medicines" description="The medicines you track, and whether each is on Health Canada's Tier 3 list of the most serious drug shortages." action={addButton} />

      {tracked.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="You're not tracking any medicines yet"
          description="Find the medicines you take or give out, and we'll show you when they join or leave Health Canada's Tier 3 list of the most serious shortages."
          action={
            <Button href="/find">
              <Search aria-hidden="true" />
              Find a medicine
            </Button>
          }
        />
      ) : (
        <>
          <Card
            title={checkedAt ? `Health Canada's list read ${dayLabel(checkedAt, now).toLowerCase()} at ${timeText(checkedAt)}` : "We couldn't read Health Canada's list just now. Try again later."}
            description={
              changedToday > 0
                ? `${changedToday === 1 ? "1 medicine" : `${changedToday} medicines`} you track changed today.`
                : "No update today. Nothing has changed for your medicines."
            }
            action={
              <Button variant="ghost" size="sm" href="/my-updates">
                See updates
              </Button>
            }
          />

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Tracking" value={tracked.length} icon={Pill} />
            <Stat label="On Tier 3 list" value={tracked.filter((item) => item.status === "listed").length} icon={Bell} />
            <Stat label="Changed this week" value={thisWeek.length} icon={RefreshCw} />
          </div>

          <List>
            {tracked.map((item) => (
              <Row
                key={item.id}
                href={`/medicines/${item.id}?from=mine`}
                media={<Tile icon={Pill} />}
                title={fullName(item)}
                description={`Changed ${whenText(item.lastChangedAt, now).toLowerCase()}`}
              >
                <StatusTag status={item.status} />
                {daysAgo(item.lastChangedAt, now) < 3 && <Tag tone="info">New change</Tag>}
              </Row>
            ))}
          </List>

          <SourceNote />
        </>
      )}
    </AppShell>
  );
}
