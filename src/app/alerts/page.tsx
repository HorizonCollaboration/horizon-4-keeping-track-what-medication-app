import { Mail, Pill, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { Button, Card, EmptyState, ScreenHeader, Tag } from "@/kit";
import { getEmailAlert } from "@/lib/data/alerts";
import { listTracked } from "@/lib/data/tracking";
import { requireUser } from "@/lib/session";
import { AlertForm } from "./AlertForm";
import { TurnOffButton } from "./TurnOffButton";

/** Email alerts: whether, and how often, someone is emailed about the medicines they track. */
export default async function AlertsPage() {
  const user = await requireUser();
  const [alert, tracked] = await Promise.all([getEmailAlert(db, user.id), listTracked(db, user.id)]);
  const count = tracked.length === 1 ? "1 medicine" : `${tracked.length} medicines`;

  return (
    <AppShell current="alerts" user={user}>
      <ScreenHeader icon={Mail} title="Email alerts" description="Choose whether we email you when one of the medicines you track changes." />

      <Card
        title={alert.on ? "Email alerts are on" : "Email alerts are off"}
        description={
          alert.on
            ? `We'll email ${user.email} about the ${count} you track${alert.often === "weekly" ? ", with a note each week if nothing has changed" : ", only when something changes"}.`
            : "Turn them on below to hear about changes without opening the app."
        }
        action={alert.on ? <TurnOffButton /> : undefined}
      >
        <Tag tone={alert.on ? "good" : "neutral"} dot>
          {alert.on ? "On" : "Off"}
        </Tag>
      </Card>

      {tracked.length === 0 && (
        <EmptyState
          icon={Pill}
          title="Track a medicine first"
          description="Emails only cover the medicines you choose, so pick at least one."
          action={
            <Button href="/find">
              <Search aria-hidden="true" />
              Find a medicine
            </Button>
          }
        />
      )}

      <Card title={alert.on ? "Change your email alerts" : "Turn on email alerts"} description={`We'll use ${user.email}, the address you signed in with, and only for these alerts.`}>
        <AlertForm on={alert.on} often={alert.often} />
      </Card>

      <p className="text-sm text-muted-foreground">
        Emails aren&apos;t being sent yet. Your choice is saved, ready for when they start.
      </p>
    </AppShell>
  );
}
