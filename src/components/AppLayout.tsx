import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, BookOpen, BarChart3, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";

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

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const home = tone === "setter" ? "/setter/dashboard" : "/student/dashboard";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link to={home} className="flex items-center gap-3">
          <Logo variant="compact" />
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline-block">
            · {title}
          </span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {tone === "setter" && (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link to="/setter/dashboard"><LayoutDashboard className="mr-1.5 h-4 w-4" /> Dashboard</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link to="/setter/results"><BarChart3 className="mr-1.5 h-4 w-4" /> Results</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link to="/setter/manual"><BookOpen className="mr-1.5 h-4 w-4" /> Manual</Link>
              </Button>
            </>
          )}
          {profile && (
            <div className="hidden text-right md:block">
              <div className="text-sm font-medium leading-tight">{profile.full_name}</div>
              {profile.class_name && (
                <div className="text-xs text-muted-foreground">
                  {profile.class_name}
                  {profile.stream ? ` · ${profile.stream}` : ""}
                </div>
              )}
            </div>
          )}
          <Button onClick={handleSignOut} size="sm" variant="outline">
            <LogOut className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Sign out</span>
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
