"use client";

import { Mail } from "lucide-react";
import { useActionState } from "react";
import { Button, FormMessage, Select } from "@/kit";
import type { AlertOften } from "@/lib/data/alerts";
import { saveEmailAlertAction, type AlertState } from "./actions";

const initial: AlertState = { error: null, message: null };

/** Choose how often to be emailed, and turn alerts on (or save a change). */
export function AlertForm({ on, often }: { on: boolean; often: AlertOften }) {
  const [state, action, pending] = useActionState(saveEmailAlertAction, initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Select
        label="When to email me"
        name="often"
        defaultValue={often}
        required
        className="md:w-full"
        options={[
          { value: "changes", label: "Only when something changes" },
          { value: "weekly", label: "When something changes, plus a weekly 'no update' note" },
        ]}
      />
      <FormMessage error={state.error} message={state.message} />
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          <Mail aria-hidden="true" />
          {on ? "Save email alerts" : "Turn on email alerts"}
        </Button>
      </div>
    </form>
  );
}
