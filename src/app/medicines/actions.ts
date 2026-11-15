"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { stopTracking, trackMedicine } from "@/lib/data/tracking";
import { requireUser } from "@/lib/session";

export type TrackState = { error: string | null; message: string | null };

const input = z.object({
  medicineId: z.string().trim().min(1).max(100),
  // What the button said when it was pressed, so a double press can't undo itself.
  track: z.enum(["yes", "no"]),
});

export async function setTrackingAction(_state: TrackState, form: FormData): Promise<TrackState> {
  const user = await requireUser();
  const parsed = input.safeParse({ medicineId: form.get("medicineId"), track: form.get("track") });

  if (!parsed.success) {
    return { error: "That medicine couldn't be found. Please search for it again.", message: null };
  }

  const { medicineId, track } = parsed.data;
  const found = track === "yes" ? await trackMedicine(db, user.id, medicineId) : await stopTracking(db, user.id, medicineId);

  if (!found) {
    return { error: "That medicine couldn't be found. Please search for it again.", message: null };
  }

  revalidatePath("/", "layout");

  return {
    error: null,
    message: track === "yes" ? `Now tracking ${found.name}. You'll see its changes in Updates.` : `Stopped tracking ${found.name}.`,
  };
}
