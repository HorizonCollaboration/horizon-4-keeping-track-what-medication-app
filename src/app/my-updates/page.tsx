import { Bell, CircleCheck, Mail, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SourceNote } from "@/components/SourceNote";
import { StatusTag } from "@/components/StatusTag";
import { db } from "@/db";
import { Button, Card, EmptyState, List, Row, ScreenHeader, Section, Tile } from "@/kit";
import { fullName, lastChecked, loadMedicines } from "@/lib/data/medicines";
import { changesToTracked, listTracked, type TrackedChange } from "@/lib/data/tracking";
import { dayKey, dayLabel, daysAgo, daysBefore, lastDays, timeText } from "@/lib/dates";
import { requireUser } from "@/lib/session";

/** Every day of the last week is shown, even with no change; before that, only days with a change, back this far. */
const week = 7;
const earliest = 90;

function ChangeRow({ change }: { change: TrackedChange }) {
  return (
    <Row href={`/medicines/${change.medicineId}?from=updates`} media={<Tile icon={RefreshCw} />} title={fullName(change)} description={change.note}>
      <StatusTag status={change.status} />
    </Row>
  );
}

/** Updates: every change to the medicines someone tracks, newest first, grouped by day. */
export default async function UpdatesPage() {
  const user = await requireUser();

  await loadMedicines(db);

  const now = new Date();
  const [tracked, changes, checkedAt] = await Promise.all([listTracked(db, user.id), changesToTracked(db, user.id, daysBefore(now, earliest + 1)), lastChecked(db)]);

  // Each of the last 7 days, then each earlier day something changed, newest first.
  const lastWeek = lastDays(now, week);
  const earlierDays = [...new Map(changes.filter((change) => daysAgo(change.changedAt, now) >= week).map((change) => [dayKey(change.changedAt), change.changedAt])).values()];
  const onDay = (date: Date) => changes.filter((change) => dayKey(change.changedAt) === dayKey(date));
  const yours = tracked.length === 1 ? "your medicine" : "your medicines";

  return (
    <AppShell current="updates" user={user}>
      <ScreenHeader
        icon={Bell}
        title="Updates"
        description="When a medicine you track joins or leaves Health Canada's Tier 3 list. On days with no change we still say so, so you know it's working."
        action={
          tracked.length > 0 && (
            <Button variant="primary" href="/alerts">
              <Mail aria-hidden="true" />
              Get these by email
            </Button>
          )
        }
      />

      {tracked.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No updates yet"
          description="Track a medicine and its changes will show here."
          action={
            <Button variant="primary" href="/find">
              <Search aria-hidden="true" />
              Find a medicine
            </Button>
          }
        />
      ) : (
        <>
          <Card
            title={checkedAt ? `Health Canada's list last read ${dayLabel(checkedAt, now).toLowerCase()} at ${timeText(checkedAt)}` : "We couldn't read Health Canada's list just now. Try again later."}
            description={`Showing changes to the ${tracked.length === 1 ? "1 medicine" : `${tracked.length} medicines`} you track.`}
          />

          {lastWeek.map((date) => {
            const dayChanges = onDay(date);

            return (
              <Section key={dayKey(date)} title={dayLabel(date, now)}>
                <List>
                  {dayChanges.length > 0 ? (
                    dayChanges.map((change) => <ChangeRow key={change.id} change={change} />)
                  ) : (
                    <Row compact media={<Tile icon={CircleCheck} size="sm" />} title="No update available" description={`Nothing changed for ${yours}.`} />
                  )}
                </List>
              </Section>
            );
          })}

          {earlierDays.map((date) => (
            <Section key={dayKey(date)} title={dayLabel(date, now)}>
              <List>
                {onDay(date).map((change) => (
                  <ChangeRow key={change.id} change={change} />
                ))}
              </List>
            </Section>
          ))}

          <SourceNote />
        </>
      )}
    </AppShell>
  );
}
