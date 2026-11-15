import { Tag } from "@/kit";
import { statusLabel, statusTone } from "@/lib/statuses";

/** A medicine's status in words, with a dot for how urgent it is. */
export function StatusTag({ status }: { status: string }) {
  return <Tag tone={statusTone(status)}>{statusLabel(status)}</Tag>;
}
