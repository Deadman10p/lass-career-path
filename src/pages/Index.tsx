import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, GraduationCap, Sparkles, ArrowRight, Target, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && profile) {
      navigate(profile.role === "setter" ? "/setter/dashboard" : "/student/dashboard", { replace: true });
    }
  }, [user, profile, loading, navigate]);

  return (
    <div className="min-h-screen gradient-soft">
      <header className="container flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-glow">
            <Compass className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold">CareerPath</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
          <Button asChild size="sm" className="gradient-primary text-primary-foreground border-0 shadow-glow"><Link to="/register">Get started</Link></Button>
        </div>
      </header>

      <main className="container pb-24 pt-12 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Light Academy Career Inventory
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Discover the path that <span className="text-gradient-primary">fits who you are.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            A modern career inventory built for secondary students. Answer thoughtful questions, get a personalised career profile, and explore where your strengths can take you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gradient-primary text-primary-foreground border-0 shadow-glow group">
              <Link to="/register">
                Start your journey <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg"><Link to="/login">I already have an account</Link></Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mx-auto mt-16 grid max-w-4xl gap-4 sm:mt-24 sm:grid-cols-2"
        >
          <RoleCard
            to="/register?role=student"
            tone="student"
            icon={<GraduationCap className="h-6 w-6" />}
            title="I'm a Student"
            description="Take the inventory and unlock your personalised career profile, top clusters, and possible careers."
            accent="Student portal"
          />
          <RoleCard
            to="/register?role=setter"
            tone="setter"
            icon={<Target className="h-6 w-6" />}
            title="I'm a Teacher / Setter"
            description="Build questionnaires, design the scoring map, import questions, and analyse student responses."
            accent="Setter portal"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mx-auto mt-20 grid max-w-4xl gap-6 text-sm text-muted-foreground sm:grid-cols-3"
        >
          <Feature icon={<Sparkles className="h-4 w-4" />} title="Beautifully simple">One question at a time, smooth transitions, mobile-first.</Feature>
          <Feature icon={<BarChart3 className="h-4 w-4" />} title="Insightful results">Radar charts, ranked clusters, and tailored insights.</Feature>
          <Feature icon={<Target className="h-4 w-4" />} title="Built for educators">Custom questionnaires, weighted scoring, and AI-assisted editing.</Feature>
        </motion.div>
      </main>
    </div>
  );
};

function RoleCard({ to, tone, icon, title, description, accent }: { to: string; tone: "setter" | "student"; icon: React.ReactNode; title: string; description: string; accent: string; }) {
  const grad = tone === "setter" ? "gradient-setter" : "gradient-student";
  const fg = tone === "setter" ? "text-setter-foreground" : "text-student-foreground";
  return (
    <Link to={to} className="group">
      <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.25 }} className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-elevated">
        <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full ${grad} opacity-20 blur-2xl transition-opacity group-hover:opacity-40`} />
        <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${grad} ${fg}`}>{icon}</div>
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{accent}</div>
        <h3 className="mt-1 font-display text-2xl font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 inline-flex items-center text-sm font-medium text-primary">
          Continue <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </motion.div>
    </Link>
  );
}

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
