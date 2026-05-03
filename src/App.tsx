import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import SubjectPage from "./pages/SubjectPage";
import LessonPlayer from "./pages/LessonPlayer";
import Admin from "./pages/Admin";
import PendingEnrollment from "./pages/PendingEnrollment";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse font-heading text-xl text-foreground">Loading…</div>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, isAdmin, loading } = useAuth();
  if (loading) return <Loader />;
  if (!session) return <Navigate to="/auth" replace />;
  if (profile && !profile.is_active && !isAdmin) return <Navigate to="/auth" replace />;
  if (profile && !isAdmin &&
    (profile.enrollment_status === "pending" || profile.enrollment_status === "removed")) {
    return <Navigate to="/pending" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, isAdmin, loading } = useAuth();
  if (loading) return <Loader />;
  if (!session) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, isAdmin, loading } = useAuth();
  if (loading) return <Loader />;
  if (session) {
    if (profile && !isAdmin &&
      (profile.enrollment_status === "pending" || profile.enrollment_status === "removed")) {
      return <Navigate to="/pending" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function PendingRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, isAdmin, loading } = useAuth();
  if (loading) return <Loader />;
  if (!session) return <Navigate to="/auth" replace />;
  if (isAdmin || (profile && profile.enrollment_status === "enrolled")) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner richColors closeButton />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/pending" element={<PendingRoute><PendingEnrollment /></PendingRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/subject/:subject" element={<ProtectedRoute><SubjectPage /></ProtectedRoute>} />
            <Route path="/lesson/:lessonId" element={<ProtectedRoute><LessonPlayer /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
