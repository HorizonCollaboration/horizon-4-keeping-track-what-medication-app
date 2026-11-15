"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { alertOptions, saveEmailAlert, turnOffEmailAlert } from "@/lib/data/alerts";
import { requireUser } from "@/lib/session";

export type AlertState = { error: string | null; message: string | null };

const input = z.object({ often: z.enum(alertOptions) });

export async function saveEmailAlertAction(_state: AlertState, form: FormData): Promise<AlertState> {
  const user = await requireUser();
  const parsed = input.safeParse({ often: form.get("often") });

  if (!parsed.success) {
    return { error: "Choose when you'd like to be emailed.", message: null };
  }

  await saveEmailAlert(db, user.id, parsed.data.often);
  revalidatePath("/alerts");

  return { error: null, message: `Email alerts saved for ${user.email}.` };
}

export async function turnOffEmailAlertAction(): Promise<AlertState> {
  const user = await requireUser();

  await turnOffEmailAlert(db, user.id);
  revalidatePath("/alerts");

  return { error: null, message: "Email alerts turned off." };
}
