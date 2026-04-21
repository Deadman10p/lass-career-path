import { cn } from "@/lib/utils";
import logo from "@/assets/lass-logo.png";

interface Props {
  variant?: "horizontal" | "compact";
  className?: string;
}

export function Logo({ variant = "horizontal", className }: Props) {
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <img src={logo} alt="Light Academy Secondary School" className="h-9 w-auto" />
        <span className="font-display text-base font-bold tracking-tight">
          <span className="text-brand-red">LASS</span>{" "}
          <span className="text-brand-blue">CAREER PATH</span>
        </span>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img src={logo} alt="Light Academy Secondary School" className="h-12 w-auto sm:h-14" />
      <div className="leading-tight">
        <div className="font-display text-lg font-bold tracking-tight sm:text-xl">
          <span className="text-brand-red">LASS</span>{" "}
          <span className="text-brand-blue">CAREER PATH</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px]">
          Light Academy · Career Inventory
        </div>
      </div>
    </div>
  );
}
