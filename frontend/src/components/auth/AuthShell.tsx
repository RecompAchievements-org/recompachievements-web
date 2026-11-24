import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

// The narrow, centered layout of every account page: a heading, a short intro, and one card.
export function AuthShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6 sm:py-20">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight wrap-anywhere sm:text-4xl">{title}</h1>
        {intro && <p className="text-muted">{intro}</p>}
      </div>
      <Card className="flex flex-col gap-6 p-5 sm:p-6">{children}</Card>
    </div>
  );
}
