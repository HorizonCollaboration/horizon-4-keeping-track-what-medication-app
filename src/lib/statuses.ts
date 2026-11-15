import type { TagTone } from "@/kit";

/**
 * Where a medicine stands on Health Canada's list of Tier 3 drug shortages:
 * the shortages it rates most serious. The order is how urgent each is,
 * most urgent first.
 */
export const statuses = {
  listed: { label: "On the Tier 3 list", tone: "urgent" },
  delisted: { label: "No longer on the Tier 3 list", tone: "neutral" },
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
