import { Toaster, SonnerToaster as Sonner, TooltipProvider } from "@/components/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2 } from "lucide-react";
import { usePendingTicketSync } from "@/hooks/usePendingTicketSync";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import MyTickets from "./pages/MyTickets";
import ResaleMarket from "./pages/ResaleMarket";
import ResaleDetail from "./pages/ResaleDetail";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import CreateEvent from "./pages/CreateEvent";
import AdminPanel from "./pages/AdminPanel";
import AdminControlPanel from "./pages/AdminControlPanel";
import CheckIn from "./pages/CheckIn";
import NotFound from "./pages/NotFound";
import UserDashboard from "./pages/UserDashboard";
import ChatbotWidget from "@/components/ChatbotWidget";

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
 * Wraps routes that require admin role.
 */
const AdminProtectedLayout = () => {
  const { appUser } = useAuth();

  if (!appUser) return <Navigate to="/login" replace />;

  if (!appUser.roles.includes("admin")) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

/**
 * Internal router wrapper that enables ticket sync hook
 * Must be inside AuthProvider to access useAuth
 */
const AppRoutes = () => {
  const { appUser } = useAuth();
  
  // Enable periodic syncing of pending tickets
  usePendingTicketSync({
    ownerEmail: appUser?.email,
    checkInterval: 30000, // Check every 30 seconds
    showNotifications: true,
  });

  return (
    <Routes>
      {/* ── Public pages (no sidebar) ── */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/home" element={<Navigate to="/" replace />} />

      {/* ── Authenticated pages (sidebar + header) ── */}
      <Route element={<ProtectedLayout />}>
        {/* Organizer + Admin tools */}
        <Route path="/organizer" element={<OrganizerDashboard />} />
        <Route path="/organizer/create" element={<CreateEvent />} />
        <Route path="/organizer/edit/:id" element={<CreateEvent />} />
        <Route path="/check-in" element={<CheckIn />} />

        {/* Admin-only routes */}
        <Route element={<AdminProtectedLayout />}>
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/control" element={<AdminControlPanel />} />
        </Route>

        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/my-tickets" element={<MyTickets />} />
        <Route path="/resale" element={<ResaleMarket />} />
        <Route path="/resale/:tokenId" element={<ResaleDetail />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider>
            <Toaster />
            <Sonner />
            <AppRoutes />
            <ChatbotWidget />
          </WalletProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
