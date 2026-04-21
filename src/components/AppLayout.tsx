import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass, LogOut, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Props {
  tone: "setter" | "student";
  title: string;
  children: ReactNode;
  rightSlot?: ReactNode;
  showManualLink?: boolean;
}

export function AppHeader({ tone, title }: { tone: "setter" | "student"; title: string }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const accent = tone === "setter" ? "gradient-setter" : "gradient-student";

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link to={tone === "setter" ? "/setter/dashboard" : "/student/dashboard"} className="flex items-center gap-2.5">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl shadow-glow", accent)}>
            <Compass className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">CareerPath</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {tone === "setter" && (
            <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
              <Link to="/setter/manual"><BookOpen className="mr-1.5 h-4 w-4" /> Manual</Link>
            </Button>
          )}
          {profile && (
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{profile.full_name}</div>
              {profile.class_name && <div className="text-xs text-muted-foreground">{profile.class_name}</div>}
            </div>
          )}
          <Button onClick={handleSignOut} size="sm" variant="outline">
            <LogOut className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function PageShell({ tone, title, children }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader tone={tone} title={title} />
      <main className="container py-6 sm:py-10">{children}</main>
    </div>
  );
}
