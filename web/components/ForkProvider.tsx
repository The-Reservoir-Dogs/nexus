"use client";
import * as React from "react";
import type { ForkContext, Draft } from "@/lib/api";

type ForkState = {
  context: ForkContext | null;
  setContext: (c: ForkContext) => void;
  whatIf: string;
  setWhatIf: (s: string) => void;
  drivingReviewId: string | null;
  setDrivingReviewId: (id: string | null) => void;
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  reset: () => void;
};

const Ctx = React.createContext<ForkState | null>(null);

export function ForkProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = React.useState<ForkContext | null>(null);
  const [whatIf, setWhatIf] = React.useState("");
  const [drivingReviewId, setDrivingReviewId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);

  const reset = React.useCallback(() => {
    setContext(null);
    setWhatIf("");
    setDrivingReviewId(null);
    setDraft(null);
  }, []);

  return (
    <Ctx.Provider
      value={{
        context,
        setContext,
        whatIf,
        setWhatIf,
        drivingReviewId,
        setDrivingReviewId,
        draft,
        setDraft,
        reset,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useFork() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useFork must be used within ForkProvider");
  return ctx;
}
