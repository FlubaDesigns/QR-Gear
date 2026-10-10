import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = true }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, isAdmin, error, retry } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const searchParams = new URLSearchParams(window.location.search);
    const tempPacketId = searchParams.get('tempPacketId');
    if (tempPacketId) {
      localStorage.setItem('pending_temp_packet_id', tempPacketId);
    }
    const returnPath = window.location.pathname + window.location.search;
    if (returnPath !== '/') {
      localStorage.setItem('login_return_path', returnPath);
    }
    return <Redirect to="/login" />;
  }

  if (error) {
    return <div className="row py-8" role="alert">
      <p>{error.message}</p>
      <button className="min-h-12 rounded border px-4" onClick={() => void retry()}>Retry sign-in check</button>
    </div>;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
