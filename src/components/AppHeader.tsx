import { Clock } from "lucide-react";
import { Logo } from "./Logo";

export function AppHeader({
  timer,
}: {
  timer?: string;
}) {
  return (
    <header className="sticky top-0 z-20 bg-background">
      <div className="relative flex items-center justify-between px-4 py-3.5 md:px-8 md:py-4">
        <div className="flex items-center gap-2">
          <Logo size={28} />
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <span className="text-sm font-semibold tracking-tight sm:text-base md:text-lg text-foreground">
            AI Chat Simulation
          </span>
        </div>
        <div className="flex items-center justify-end">
          {timer ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-timer/30 px-3 py-1.5 text-xs font-medium text-timer sm:text-sm">
              <Clock className="size-4" />
              {timer}
            </span>
          ) : null}
        </div>
      </div>
      <div className="h-px w-full bg-border/60" />
    </header>
  );
}
