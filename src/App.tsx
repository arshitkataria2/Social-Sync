import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import FriendsPage from "./pages/FriendsPage";
import ChatPage from "./pages/ChatPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileSetupPage from "./pages/ProfileSetupPage";
import UserProfilePage from "./pages/UserProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

import { useLocation } from "react-router-dom";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/auth" replace />;

  if (!user.profileSetupComplete && location.pathname !== "/profile-setup") {
    return <Navigate to="/profile-setup" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function SetupRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  if (user.profileSetupComplete) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user) {
    if (!user.profileSetupComplete) return <Navigate to="/profile-setup" replace />;
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
    <Route path="/profile-setup" element={<SetupRoute><ProfileSetupPage /></SetupRoute>} />
    <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
    <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
    <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="/user/:userId" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;