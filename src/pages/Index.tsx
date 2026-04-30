import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const COUNSELLOR_EMAIL = "counsellor@lightacademy.ac.ug";

const NAV = [
  { id: "about", label: "About" },
  { id: "how", label: "How it works" },
  { id: "school", label: "For the school" },
];

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (!loading && user) {
      const isCounsellor = user.email?.toLowerCase() === COUNSELLOR_EMAIL;
      const dest =
        profile?.role === "setter" || isCounsellor
          ? "/setter/dashboard"
          : "/student/dashboard";
      navigate(dest, { replace: true });
    }
  }, [user, profile, loading, navigate]);

  // Scroll-spy: highlight current section in the nav
  useEffect(() => {
    const ids = NAV.map((n) => n.id);
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-brand-blue via-brand-black to-brand-red" />

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="container flex items-center justify-between py-4">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={cn(
                  "nav-underline transition-colors hover:text-foreground",
                  activeId === n.id && "is-active text-foreground"
                )}
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="bg-brand-blue text-primary-foreground hover:bg-brand-blue/90">
              <Link to="/register">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-border">
          <div className="container grid gap-12 py-16 sm:py-24 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-7" y={32} duration={800}>
              <div className="mb-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <span className="h-px w-8 bg-brand-red" />
                Light Academy Secondary School
              </div>
              <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                A considered career inventory<br className="hidden sm:block" />
                <span className="text-brand-blue">for our students.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                LASS Career Path is the school's dedicated platform for guided self-reflection.
                Students complete structured questionnaires; counsellors review aggregated
                insights to support meaningful conversations about each student's direction.
              </p>
              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="bg-brand-blue text-primary-foreground hover:bg-brand-blue/90">
                  <Link to="/register">
                    Create student account <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="text-foreground hover:bg-secondary">
                  <Link to="/login">I already have an account</Link>
                </Button>
              </div>
            </Reveal>

            <Reveal className="lg:col-span-5" y={32} delay={150} duration={800}>
              <div className="rounded-sm border border-border bg-card">
                <div className="border-b border-border px-6 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-red">
                    Sample profile
                  </div>
                  <div className="mt-1 font-display text-lg font-semibold">Strongest categories</div>
                </div>
                <div className="space-y-4 p-6">
                  {SAMPLE.map((row, i) => (
                    <Reveal key={row.label} delay={300 + i * 90} y={12} duration={600}>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="font-medium text-foreground">{row.label}</span>
                        <span className="tabular-nums text-muted-foreground">{row.value}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-[width] duration-1000 ease-out"
                          style={{ width: `${row.value}%`, background: row.color }}
                        />
                      </div>
                    </Reveal>
                  ))}
                </div>
                <div className="border-t border-border bg-secondary/40 px-6 py-3 text-xs text-muted-foreground">
                  Indicative results — generated after completing a questionnaire.
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-b border-border bg-secondary/30 scroll-mt-20">
          <div className="container py-16 sm:py-20">
            <Reveal className="mb-10 flex items-end justify-between" y={20}>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-red">
                  Process
                </div>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  Three steps. Done with care.
                </h2>
              </div>
            </Reveal>

            <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 120} y={28} duration={700}>
                  <div className="h-full bg-card p-6 sm:p-8">
                    <div className="mb-4 font-display text-3xl font-semibold text-brand-blue/30 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="font-display text-lg font-semibold text-foreground">{s.title}</div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* For the school */}
        <section id="school" className="border-b border-border scroll-mt-20">
          <div className="container grid gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-20">
            <Reveal y={28}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-red">
                For the school
              </div>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Built around how counsellors actually work.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Every questionnaire is designed in-house by the counselling office. Results are
                organised by class and stream, and individual reports are available for one-to-one
                follow-up — no third-party data sharing, no advertising, no distractions.
              </p>
            </Reveal>
            <ul className="space-y-4">
              {FEATURES.map((f, i) => (
                <Reveal as="li" key={f} delay={i * 80} y={16} duration={600}>
                  <div className="flex gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
                    <span className="text-sm leading-relaxed text-foreground">{f}</span>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer id="about" className="scroll-mt-20 border-t-4 border-brand-red bg-brand-black text-white/80">
        <div className="container grid gap-8 py-12 sm:grid-cols-3">
          <Reveal y={20}>
            <div className="font-display text-base font-semibold text-white">LASS Career Path</div>
            <p className="mt-2 max-w-xs text-sm text-white/60">
              A career-guidance platform of Light Academy Secondary School.
            </p>
          </Reveal>
          <Reveal y={20} delay={100} className="text-sm">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Access
            </div>
            <ul className="space-y-1.5">
              <li><Link to="/register" className="hover:text-white">Create a student account</Link></li>
              <li><Link to="/login" className="hover:text-white">Sign in</Link></li>
            </ul>
          </Reveal>
          <Reveal y={20} delay={200} className="text-sm">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              School
            </div>
            <p className="text-white/70">Light Academy Secondary School</p>
            <p className="text-white/50">Counselling Office</p>
          </Reveal>
        </div>
        <div className="border-t border-white/10">
          <div className="container flex flex-col items-start justify-between gap-2 py-5 text-xs text-white/50 sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Light Academy Secondary School. All rights reserved.</span>
            <span>LASS Career Path</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const SAMPLE = [
  { label: "Investigative & Analytical", value: 86, color: "hsl(var(--brand-blue))" },
  { label: "Social & Helping", value: 72, color: "hsl(var(--brand-red))" },
  { label: "Creative & Expressive", value: 64, color: "hsl(var(--brand-black))" },
  { label: "Enterprising & Leading", value: 51, color: "hsl(var(--brand-blue) / 0.6)" },
];

const STEPS = [
  {
    title: "Register",
    body: "Students sign up with their school details — class and stream — so results can be reviewed in context.",
  },
  {
    title: "Reflect",
    body: "Complete the active questionnaire honestly. Each question is brief and considered; there are no right answers.",
  },
  {
    title: "Review",
    body: "Receive a personal report. Counsellors see aggregated school-wide patterns and individual reports for follow-up.",
  },
];

const FEATURES = [
  "Questionnaires authored and maintained by the school counselling office.",
  "Results filtered by class and stream for cohort-level review.",
  "Individual student reports for confidential one-to-one sessions.",
  "Custom scoring categories tailored to each questionnaire.",
  "Data stays within the school — no external sharing.",
];

export default Index;
