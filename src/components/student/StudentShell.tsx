import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Compass, ListChecks, User2, LogOut, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface Props { children: ReactNode }

const NAV = [
  { to: "/student/dashboard",      label: "Highlights",     icon: Sparkles },
  { to: "/student/questionnaires", label: "Questionnaires", icon: ListChecks },
  { to: "/student/overall",        label: "Overall profile", icon: User2 },
];

export default function StudentShell({ children }: Props) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => { await signOut(); navigate("/", { replace: true }); };

  const initial = (profile?.full_name?.trim()?.[0] ?? "S").toUpperCase();

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-3">
          <NavLink to="/student/dashboard" className="flex items-center gap-3">
            <Logo variant="compact" />
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline-block">· Student portal</span>
          </NavLink>
          <div className="flex items-center gap-2">
            {profile && (
              <div className="hidden text-right md:block">
                <div className="text-sm font-medium leading-tight">{profile.full_name}</div>
                {profile.class_name && (
                  <div className="text-xs text-muted-foreground">
                    {profile.class_name}{profile.stream ? ` · ${profile.stream}` : ""}
                  </div>
                )}
              </div>
            )}
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--brand-blue))] text-sm font-semibold text-white md:flex">{initial}</div>
            <Button onClick={handleSignOut} size="sm" variant="outline">
              <LogOut className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container grid gap-6 py-6 sm:py-10 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav className="space-y-1.5 rounded-2xl border border-border bg-card p-2 shadow-card">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) => [
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-[hsl(var(--brand-blue))] text-white shadow-sm"
                    : "text-foreground/75 hover:bg-secondary/70 hover:text-foreground",
                ].join(" ")}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 rounded-2xl border border-border bg-gradient-to-br from-[hsl(var(--brand-blue))]/8 to-[hsl(var(--brand-red))]/6 p-4 shadow-card">
            <Compass className="h-5 w-5 text-[hsl(var(--brand-blue))]" />
            <p className="mt-2 font-serif-display text-base leading-snug">Your profile grows with every inventory you complete.</p>
          </div>
        </aside>

        {/* Main */}
        <main>{children}</main>
      </div>
    </div>
  );
}
