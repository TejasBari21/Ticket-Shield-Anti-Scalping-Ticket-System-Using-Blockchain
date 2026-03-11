import { Toaster, SonnerToaster as Sonner, TooltipProvider } from "@/components/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2 } from "lucide-react";
import { getKYCStatusForUser } from "@/hooks/useKYC";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import MyTickets from "./pages/MyTickets";
import Resale from "./pages/Resale";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import CreateEvent from "./pages/CreateEvent";
import AdminPanel from "./pages/AdminPanel";
import AdminControlPanel from "./pages/AdminControlPanel";
import CheckIn from "./pages/CheckIn";
import KYCVerification from "./pages/KYCVerification";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Wraps authenticated routes: shows a spinner while session loads, then redirects to /login when no session exists. */
const ProtectedLayout = () => {
  const { appUser, sessionLoading } = useAuth();

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!appUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

/**
 * Wraps routes that additionally require KYC approval.
 * Admins bypass KYC. Unverified/pending users are sent to /kyc.
 */
const KYCProtectedLayout = () => {
  const { appUser } = useAuth();

  // appUser is guaranteed non-null here (parent ProtectedLayout already checked)
  if (!appUser) return <Navigate to="/login" replace />;

  // Admins are always trusted — no KYC required
  if (appUser.roles.includes("admin")) return <Outlet />;

  const kycStatus = getKYCStatusForUser(appUser.id);
  if (kycStatus !== "approved") {
    return <Navigate to="/kyc" replace />;
  }

  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* ── Public pages (no sidebar) ── */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/home" element={<Navigate to="/" replace />} />

            {/* ── Authenticated pages (sidebar + header) ── */}
            <Route element={<ProtectedLayout />}>
              {/* KYC page — accessible before verification */}
              <Route path="/kyc" element={<KYCVerification />} />

              {/* Organizer + Admin tools — no KYC required */}
              <Route path="/organizer" element={<OrganizerDashboard />} />
              <Route path="/organizer/create" element={<CreateEvent />} />
              <Route path="/organizer/edit/:id" element={<CreateEvent />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/admin/control" element={<AdminControlPanel />} />
              <Route path="/check-in" element={<CheckIn />} />

              {/* Pages that require KYC approval */}
              <Route element={<KYCProtectedLayout />}>
                <Route path="/events" element={<Events />} />
                <Route path="/events/:id" element={<EventDetail />} />
                <Route path="/my-tickets" element={<MyTickets />} />
                <Route path="/resale" element={<Resale />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </WalletProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
