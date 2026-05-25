import { useId, type ReactNode } from "react";
import type { ReportStyle } from "@/lib/types";

/**
 * Wraps a report / profile surface and applies the questionnaire's `report_style`
 * via scoped CSS variables + optional raw CSS. All overrides are scoped to
 * `.lass-report-skin[data-skin="<id>"]` so multiple reports never clash.
 */
export function ReportSkin({ style, children, className = "" }: { style?: ReportStyle | null; children: ReactNode; className?: string }) {
  const id = useId().replace(/[:]/g, "");
  const s = style ?? {};

  const vars: Record<string, string> = {};
  if (s.accent) vars["--report-accent"] = s.accent;
  if (s.heroBg) vars["--report-hero-bg"] = s.heroBg;
  if (s.heroTextColor) vars["--report-hero-text"] = s.heroTextColor;
  if (s.fontDisplay) vars["--report-font-display"] = s.fontDisplay;
  if (s.fontBody) vars["--report-font-body"] = s.fontBody;
  if (s.cardRadius) vars["--report-card-radius"] = s.cardRadius;
  if (s.heroRadius) vars["--report-hero-radius"] = s.heroRadius;

  const scoped = `
    .lass-report-skin[data-skin="${id}"] { ${Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(" ")} }
    .lass-report-skin[data-skin="${id}"] .font-serif-display { ${s.fontDisplay ? `font-family: var(--report-font-display);` : ""} }
    .lass-report-skin[data-skin="${id}"] { ${s.fontBody ? `font-family: var(--report-font-body);` : ""} }
    .lass-report-skin[data-skin="${id}"] .lass-hero-navy { ${s.heroBg ? `background: var(--report-hero-bg) !important;` : ""} ${s.heroTextColor ? `color: var(--report-hero-text) !important;` : ""} ${s.heroRadius ? `border-radius: var(--report-hero-radius);` : ""} }
    .lass-report-skin[data-skin="${id}"] .lass-bar-fill { ${s.accent ? `background: var(--report-accent) !important;` : ""} }
    .lass-report-skin[data-skin="${id}"] .lass-glow-badge { ${s.accent ? `box-shadow: 0 0 0 1px ${s.accent}33, 0 12px 32px -10px ${s.accent}55;` : ""} }
    .lass-report-skin[data-skin="${id}"] [class*="rounded-2xl"] { ${s.cardRadius ? `border-radius: var(--report-card-radius);` : ""} }
    ${s.customCss ?? ""}
  `;

  return (
    <div className={`lass-report-skin ${className}`} data-skin={id}>
      {Object.keys(vars).length > 0 || s.customCss ? <style dangerouslySetInnerHTML={{ __html: scoped }} /> : null}
      {children}
    </div>
  );
}

export default ReportSkin;
