"use client";

import { CircleCheck, Plus } from "lucide-react";
import { useActionState } from "react";
import { setTrackingAction, type TrackState } from "@/app/medicines/actions";
import { Button } from "@/kit";
import { useSay } from "./NoticeProvider";

type TrackButtonProps = {
  medicineId: string;
  /** The medicine's full name, for screen readers. */
  name: string;
  tracking: boolean;
  signedIn: boolean;
  /** "row" for a small button in a list, "header" for the main action on a medicine's own screen. */
  place: "row" | "header";
};

const initial: TrackState = { error: null, message: null };

/** Track a medicine, or stop tracking it. Anyone signed out is asked to sign in first. */
export function TrackButton({ medicineId, name, tracking, signedIn, place }: TrackButtonProps) {
  const say = useSay();
  const [, action, pending] = useActionState(async (state: TrackState, form: FormData) => {
    const result = await setTrackingAction(state, form);
    say(result.error ?? result.message ?? "", result.error ? "problem" : "good");

    return result;
  }, initial);

  if (!signedIn) {
    return place === "row" ? (
      <Button href="/sign-in" size="sm" aria-label={`Sign in to track ${name}`}>
        <Plus aria-hidden="true" />
        Track
      </Button>
    ) : (
      <Button href="/sign-in" variant="primary">
        <Plus aria-hidden="true" />
        Sign in to track it
      </Button>
    );
  }

  const button =
    place === "row" ? (
      <Button
        type="submit"
        size="sm"
        variant={tracking ? "secondary" : "outline"}
        disabled={pending}
        aria-label={tracking ? `Tracking ${name}. Press to stop tracking` : `Track ${name}`}
      >
        {tracking ? <CircleCheck aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {tracking ? "Tracking" : "Track"}
      </Button>
    ) : tracking ? (
      <Button type="submit" disabled={pending}>
        Stop tracking
      </Button>
    ) : (
      <Button type="submit" variant="primary" disabled={pending}>
        <Plus aria-hidden="true" />
        Track this medicine
      </Button>
    );

  return (
    <form action={action}>
      <input type="hidden" name="medicineId" value={medicineId} />
      <input type="hidden" name="track" value={tracking ? "no" : "yes"} />
      {button}
    </form>
  );
}
