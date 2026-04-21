import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Target, BarChart3, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const COUNSELLOR_EMAIL = "counsellor@lightacademy.ac.ug";

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen gradient-soft">
      <header className="container flex items-center justify-between py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="gradient-primary text-primary-foreground border-0 shadow-glow">
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="container pb-24 pt-12 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-brand-red" /> Light Academy Secondary School · Career Inventory
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Discover the path that{" "}
            <span className="bg-gradient-to-r from-brand-blue via-brand-black to-brand-red bg-clip-text text-transparent">
              fits who you are.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            A modern career inventory built for LASS students. Answer thoughtful questions, get a personalised career profile,
            and explore where your strengths can take you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gradient-primary text-primary-foreground border-0 shadow-glow group">
              <Link to="/register">
                Start your journey <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mx-auto mt-16 grid max-w-3xl gap-4 sm:mt-20"
        >
          <Link to="/register" className="group">
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-elevated"
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full gradient-student opacity-20 blur-2xl transition-opacity group-hover:opacity-40" />
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl gradient-student text-student-foreground">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Student portal</div>
              <h3 className="mt-1 font-display text-2xl font-semibold">Take the inventory</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a free account, answer the questions at your own pace, and unlock your personalised career profile.
              </p>
              <div className="mt-4 inline-flex items-center text-sm font-medium text-brand-blue">
                Get started <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </motion.div>
          </Link>

          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium text-foreground">School counsellor?</div>
                <div className="mt-0.5">
                  Sign in with your school-issued counsellor credentials to manage the inventory and view all student results.
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mx-auto mt-16 grid max-w-4xl gap-6 text-sm text-muted-foreground sm:grid-cols-3"
        >
          <Feature icon={<Sparkles className="h-4 w-4" />} title="Beautifully simple">
            One question at a time, smooth transitions, mobile-first.
          </Feature>
          <Feature icon={<BarChart3 className="h-4 w-4" />} title="Insightful results">
            Radar charts, ranked clusters, and tailored insights.
          </Feature>
          <Feature icon={<Target className="h-4 w-4" />} title="Built for educators">
            Cluster scoring, class & stream filters, and AI-assisted editing.
          </Feature>
        </motion.div>
      </main>
    </div>
  );
};

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">{icon}</div>
      <div className="font-medium text-foreground">{title}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default Index;
