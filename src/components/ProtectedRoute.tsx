import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  requireRole?: AppRole;
}

export function ProtectedRoute({ children, requireRole }: Props) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireRole && profile && profile.role !== requireRole) {
    const dest = profile.role === "setter" ? "/setter/dashboard" : "/student/dashboard";
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}
