"use client";

import { useActionState } from "react";
import { useSay } from "@/components/NoticeProvider";
import { Button } from "@/kit";
import { turnOffEmailAlertAction, type AlertState } from "./actions";

const initial: AlertState = { error: null, message: null };

/** Turns email alerts off, and says so. */
export function TurnOffButton() {
  const say = useSay();
  const [, action, pending] = useActionState(async () => {
    const result = await turnOffEmailAlertAction();
    say(result.error ?? result.message ?? "", result.error ? "problem" : "good");

    return result;
  }, initial);

  return (
    <form action={action}>
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Turn off alerts
      </Button>
    </form>
  );
}
