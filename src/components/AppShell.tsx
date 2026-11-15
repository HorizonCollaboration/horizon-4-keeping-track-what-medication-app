import { Bell, LogIn, LogOut, Mail, Pill, Search } from "lucide-react";
import type { ReactNode } from "react";
import { signOut } from "@/app/sign-in/actions";
import { db } from "@/db";
import horizon from "@/horizon.json";
import { AppShell as KitAppShell, Button, type ShellTab } from "@/kit";
import { changesToTracked, listTracked } from "@/lib/data/tracking";
import { daysAgo, daysBefore } from "@/lib/dates";
import type { SignedInUser } from "@/lib/session";
import { NoticeProvider } from "./NoticeProvider";

export type TabId = "mine" | "find" | "updates" | "alerts";

/**
 * Medicine Watch's frame around every screen: its tabs, and signing in or
 * out. Anyone can find medicines; Updates and Email alerts only show once
 * someone has signed in.
 */
export async function AppShell({ current, user, children }: { current: TabId; user: SignedInUser | null; children: ReactNode }) {
  const tabs: ShellTab[] = [
    { id: "mine", label: "My medicines", href: "/", icon: Pill },
    { id: "find", label: "Find", href: "/find", icon: Search },
  ];

  if (user) {
    const now = new Date();
    const [tracked, changes] = await Promise.all([listTracked(db, user.id), changesToTracked(db, user.id, daysBefore(now, 7))]);

    tabs[0].count = tracked.filter((item) => item.status === "listed").length;
    tabs[0].countTone = "urgent";
    tabs.push(
      { id: "updates", label: "Updates", href: "/my-updates", icon: Bell, count: changes.filter((change) => daysAgo(change.changedAt, now) < 7).length },
      { id: "alerts", label: "Emails", href: "/alerts", icon: Mail },
    );
  }

  return (
    <KitAppShell
      name={horizon.name}
      icon={Pill}
      current={current}
      tabs={tabs}
      account={
        user ? (
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="md:w-full md:justify-start">
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </form>
        ) : (
          <Button href="/sign-in" variant="secondary" size="sm" className="md:w-full">
            <LogIn aria-hidden="true" />
            Sign in
          </Button>
        )
      }
    >
      <NoticeProvider>{children}</NoticeProvider>
    </KitAppShell>
  );
}
