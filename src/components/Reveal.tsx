import { ReactNode, CSSProperties } from "react";
import { useReveal } from "@/hooks/useReveal";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** translate-y distance in px while hidden */
  y?: number;
  /** delay in ms */
  delay?: number;
  /** duration in ms */
  duration?: number;
  as?: "div" | "section" | "li" | "ul" | "header" | "footer" | "article";
}

export function Reveal({
  children,
  className,
  y = 24,
  delay = 0,
  duration = 700,
  as: Tag = "div",
}: RevealProps) {
  const { ref, inView } = useReveal<HTMLDivElement>();
  const style: CSSProperties = {
    transitionProperty: "opacity, transform",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    transitionDelay: `${delay}ms`,
    transform: inView ? "translate3d(0,0,0)" : `translate3d(0, ${y}px, 0)`,
    opacity: inView ? 1 : 0,
    willChange: "opacity, transform",
  };
  // @ts-expect-error - dynamic tag typing
  return (
    <Tag ref={ref as any} style={style} className={cn(className)}>
      {children}
    </Tag>
  );
}
