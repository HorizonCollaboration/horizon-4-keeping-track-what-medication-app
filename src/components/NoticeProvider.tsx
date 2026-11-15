"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Notice } from "@/kit";

type Said = { message: string; tone: "good" | "problem" } | null;

const SayContext = createContext<(message: string, tone?: "good" | "problem") => void>(() => {});

/** One place on every screen to say what a button just did, such as "Now tracking Amoxicillin." */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [said, setSaid] = useState<Said>(null);

  // A message fades after a few seconds; the close button clears it sooner.
  useEffect(() => {
    if (!said) {
      return undefined;
    }

    const timer = setTimeout(() => setSaid(null), 5000);

    return () => clearTimeout(timer);
  }, [said]);

  return (
    <SayContext.Provider value={(message, tone = "good") => setSaid({ message, tone })}>
      {children}
      <Notice message={said?.message} tone={said?.tone} onClose={() => setSaid(null)} />
    </SayContext.Provider>
  );
}

/** Says something on the screen, from any button inside NoticeProvider. */
export function useSay() {
  return useContext(SayContext);
}
