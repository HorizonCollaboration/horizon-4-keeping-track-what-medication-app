import type { TagTone } from "@/kit";

/** How easy a medicine is to get, in words. The order is how urgent each is, most urgent first. */
export const statuses = {
  shortage: { label: "Short supply", tone: "urgent" },
  expected: { label: "Shortage expected", tone: "warning" },
  discontinued: { label: "No longer made", tone: "neutral" },
  available: { label: "Available", tone: "good" },
} satisfies Record<string, { label: string; tone: TagTone }>;

export type Status = keyof typeof statuses;

export const statusKeys = Object.keys(statuses) as Status[];

export function isStatus(value: string): value is Status {
  return value in statuses;
}

/** Its place in the urgency order, for sorting. Anything unknown goes last. */
export function urgency(status: string): number {
  const place = statusKeys.indexOf(status as Status);

  return place === -1 ? statusKeys.length : place;
}

export function statusLabel(status: string): string {
  return isStatus(status) ? statuses[status].label : "Not known";
}

export function statusTone(status: string): TagTone {
  return isStatus(status) ? statuses[status].tone : "neutral";
}
