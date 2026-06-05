import { useId, type ReactNode } from "react";
import type { ReportStyle } from "@/lib/types";

/**
 * Wraps a report / profile surface and applies the questionnaire's `report_style`
 * via scoped CSS variables + optional raw CSS. All overrides are scoped to
 * `.lass-report-skin[data-skin="<id>"]` so multiple reports never clash.
 */
export function ReportSkin({
  style,
  dominantColor,
  children,
  className = "",
}: {
  style?: ReportStyle | null;
  dominantColor?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const id = useId().replace(/[:]/g, "");
  const s = style ?? {};
  const skinSelector = `.lass-report-skin[data-skin="${id}"]`;
  const safeCustomCss = sanitizeReportCss(s.customCss, skinSelector);

  const vars: Record<string, string> = {};
  vars["--lass-cluster-dominant-color"] = normalizeHex(dominantColor) ?? "#1B3A6B";
  if (s.accent) vars["--report-accent"] = s.accent;
  if (s.heroBg) vars["--report-hero-bg"] = s.heroBg;
  if (s.heroTextColor) vars["--report-hero-text"] = s.heroTextColor;
  if (s.fontDisplay) vars["--report-font-display"] = s.fontDisplay;
  if (s.fontBody) vars["--report-font-body"] = s.fontBody;
  if (s.cardRadius) vars["--report-card-radius"] = s.cardRadius;
  if (s.heroRadius) vars["--report-hero-radius"] = s.heroRadius;

  const scoped = `
    ${skinSelector} { ${Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(" ")} }
    ${skinSelector} .font-serif-display { ${s.fontDisplay ? `font-family: var(--report-font-display);` : ""} }
    ${skinSelector} { ${s.fontBody ? `font-family: var(--report-font-body);` : ""} }
    ${skinSelector} .lass-hero-navy { ${s.heroBg ? `background: var(--report-hero-bg) !important;` : ""} ${s.heroTextColor ? `color: var(--report-hero-text) !important;` : ""} ${s.heroRadius ? `border-radius: var(--report-hero-radius);` : ""} }
    ${skinSelector} .lass-bar-fill { ${s.accent ? `background: var(--report-accent) !important;` : ""} }
    ${skinSelector} .lass-glow-badge { ${s.accent ? `box-shadow: 0 0 0 1px ${s.accent}33, 0 12px 32px -10px ${s.accent}55;` : ""} }
    ${skinSelector} [class*="rounded-2xl"] { ${s.cardRadius ? `border-radius: var(--report-card-radius);` : ""} }
    ${safeCustomCss}
    ${skinSelector} [data-pdf-section] { display: block; visibility: visible; min-height: 0; }
    ${skinSelector} [data-pdf-section]:not(.lass-hero-navy) h1,
    ${skinSelector} [data-pdf-section]:not(.lass-hero-navy) h2,
    ${skinSelector} [data-pdf-section]:not(.lass-hero-navy) h3 { color: hsl(var(--foreground)); }
  `;

  return (
    <div className={`lass-report-skin ${className}`} data-skin={id}>
      <style dangerouslySetInnerHTML={{ __html: scoped }} />
      {children}
    </div>
  );
}

export default ReportSkin;

function normalizeHex(value?: string | null) {
  const v = String(value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v}`;
  return null;
}

function sanitizeReportCss(css: string | undefined, skinSelector: string) {
  if (!css) return "";
  const elementRule = /\.lass-report-skin\s+(h[1-6]|p|div|section|span|body|html)\s*\{[^}]*\}/gi;
  return css
    .replace(/<\/?style[^>]*>/gi, "")
    .replace(/@import[^;]+;/gi, "")
    .replace(/url\(\s*['"]?javascript:[^)]+\)/gi, "none")
    .replace(elementRule, "")
    .replace(/(^|})\s*(h[1-6]|p|div|section|span|html|body)\s*\{[^}]*\}/gi, "$1")
    .replace(/--(background|foreground|card|card-foreground|popover|popover-foreground|primary|primary-foreground|secondary|secondary-foreground|muted|muted-foreground|accent|accent-foreground|border|input|ring|destructive|destructive-foreground|success|warning|student|student-foreground|setter|setter-foreground|brand-red|brand-blue|brand-black)\s*:[^;]+;/gi, "")
    .replace(/(^|})\s*(html|body)\s*\{[^}]*\}/gi, "$1")
    .replace(/:root\s*\{/gi, `${skinSelector} {`)
    .replace(/\.lass-report-skin(?!\[data-skin=)/g, skinSelector);
}
