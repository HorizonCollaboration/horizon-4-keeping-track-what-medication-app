/*
 * The updates this app can send by email: one entry for each kind of thing
 * that happens which someone might want to hear about. The app sends one
 * with notify() from @/lib/updates, and the people who manage updates
 * choose who gets each, on the Updates page. Add entries as the app grows;
 * never rename one, or the people who chose it stop getting it.
 *
 * Each has a label (what happened, as a heading) and a description (who
 * might want it). For example:
 *
 *   new_request: {
 *     label: "A new request",
 *     description: "When a food bank asks for something.",
 *   },
 */
export const updates = {
  medicine_changed: {
    label: "A tracked medicine changed",
    description: "When the government's shortage list changes for a medicine someone tracks.",
  },
} satisfies Record<string, { label: string; description: string }>;

export type UpdateKind = keyof typeof updates;
