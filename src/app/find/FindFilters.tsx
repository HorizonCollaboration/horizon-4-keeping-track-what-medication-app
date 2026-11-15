"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Field, Select } from "@/kit";
import { statusKeys, statuses } from "@/lib/statuses";

const options = [{ value: "all", label: "All medicines" }, ...statusKeys.map((key) => ({ value: key, label: statuses[key].label }))];

type Filters = { query: string; status: string };

/**
 * The search box and status filter. The results update as people type
 * (shortly after they pause) or choose a status, and the search is kept in
 * the address, so it can be shared or reloaded.
 */
export function FindFilters({ query, status }: Filters) {
  const router = useRouter();
  const [text, setText] = useState(query);
  const [show, setShow] = useState(status);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // What the page was last showing, and what this asked for last: when the page changes for any other reason (such as "Show all medicines"), the fields follow it.
  const [seen, setSeen] = useState<Filters>({ query, status });
  const [asked, setAsked] = useState<Filters>({ query, status });

  if (seen.query !== query || seen.status !== status) {
    setSeen({ query, status });

    if (asked.query.trim() !== query.trim() || asked.status !== status) {
      setText(query);
      setShow(status);
      setAsked({ query, status });
    }
  }

  const search = (next: Filters) => {
    clearTimeout(timer.current);
    setAsked(next);
    const params = new URLSearchParams();

    if (next.query.trim()) {
      params.set("q", next.query.trim());
    }

    if (next.status !== "all") {
      params.set("status", next.status);
    }

    const address = params.size > 0 ? `/find?${params}` : "/find";
    router.replace(address, { scroll: false });
  };

  return (
    // Without JavaScript the form still searches, by sending q and status in the address.
    <form
      role="search"
      action="/find"
      className="flex flex-col gap-3 md:flex-row md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        search({ query: text, status: show });
      }}
    >
      <div className="flex-1">
        <Field
          label="Medicine name"
          name="q"
          type="search"
          maxLength={100}
          autoComplete="off"
          value={text}
          placeholder="For example, amoxicillin"
          onChange={(value) => {
            setText(value);

            clearTimeout(timer.current);
            timer.current = setTimeout(() => search({ query: value, status: show }), 350);
          }}
        />
      </div>
      <Select
        label="Show"
        name="status"
        value={show}
        options={options}
        onChange={(value) => {
          setShow(value);
          search({ query: text, status: value });
        }}
      />
    </form>
  );
}
