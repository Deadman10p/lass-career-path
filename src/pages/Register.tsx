import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, Loader2, GraduationCap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AppRole } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export default function Register() {
  const [params] = useSearchParams();
  const initial = (params.get("role") as AppRole) || "student";
  const [role, setRole] = useState<AppRole>(initial);
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const valid = useMemo(() => {
    if (!fullName.trim() || !email.trim() || password.length < 6) return false;
    if (role === "student" && !className.trim()) return false;
    return true;
  }, [fullName, email, password, role, className]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, role, class_name: className || null },
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success("Account created! Welcome to CareerPath.");
    // If session exists immediately, redirect by role
    if (data.session) {
      navigate(role === "setter" ? "/setter/dashboard" : "/student/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center gradient-soft p-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-glow">
            <Compass className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold">CareerPath</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <h1 className="font-display text-2xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose your role to get the right experience.</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <RoleButton active={role === "student"} onClick={() => setRole("student")} icon={<GraduationCap className="h-4 w-4" />} label="Student" tone="student" />
            <RoleButton active={role === "setter"} onClick={() => setRole("setter")} icon={<Target className="h-4 w-4" />} label="Setter" tone="setter" />
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            </div>
            {role === "student" && (
              <div className="space-y-1.5">
                <Label htmlFor="class">Class / Stream</Label>
                <Input id="class" required value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Form 4B" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>
            <Button type="submit" disabled={loading || !valid} className="w-full gradient-primary text-primary-foreground border-0 shadow-glow">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function RoleButton({ active, onClick, icon, label, tone }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; tone: "setter" | "student" }) {
  const activeBg = tone === "setter" ? "border-setter bg-setter-soft text-setter" : "border-student bg-student-soft text-student";
  return (
    <button type="button" onClick={onClick} className={cn(
      "flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all",
      active ? activeBg : "border-border bg-secondary text-secondary-foreground hover:bg-accent"
    )}>
      {icon}{label}
    </button>
  );
}
