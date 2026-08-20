import { Clock } from "lucide-react";
import { Logo } from "./Logo";

export function AppHeader({
  timer,
}: {
  timer?: string;
}) {
  return (
    <header className="sticky top-0 z-20 bg-background">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-3 md:flex-1">
          <Logo size={32} />
          <span className="text-base font-semibold tracking-tight md:hidden">
            AI Chat Simulation
          </span>
        </div>
        <h1 className="hidden text-xl font-semibold tracking-tight md:block">
          AI Chat Simulation
        </h1>
        <div className="flex flex-1 items-center justify-end">
          {timer ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-timer/30 px-3 py-1.5 text-sm font-medium text-timer">
              <Clock className="size-4" />
              {timer}
            </span>
          ) : null}
        </div>
      </div>
      <div className="h-px w-full bg-border" />
    </header>
  );
}
