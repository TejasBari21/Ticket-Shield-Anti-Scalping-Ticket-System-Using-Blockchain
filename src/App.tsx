import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import MyTickets from "./pages/MyTickets";
import Resale from "./pages/Resale";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import CreateEvent from "./pages/CreateEvent";
import AdminPanel from "./pages/AdminPanel";
import CheckIn from "./pages/CheckIn";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <WalletProvider>
          <Toaster />
          <Sonner />
          <AppLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/my-tickets" element={<MyTickets />} />
              <Route path="/resale" element={<Resale />} />
              <Route path="/organizer" element={<OrganizerDashboard />} />
              <Route path="/organizer/create" element={<CreateEvent />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/check-in" element={<CheckIn />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </WalletProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
