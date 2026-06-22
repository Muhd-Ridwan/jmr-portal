import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Parents from "./pages/Parents";
import ParentDetail from "./pages/ParentDetail";
import Services from "./pages/Services";
import Payments from "./pages/Payments";
import Profile from "./pages/Profile";
import Users from "./pages/Users";
import MyChildren from "./pages/MyChildren";
import MyPayments from "./pages/MyPayments";
import MyReports from "./pages/MyReports";
import Reports from "./pages/Reports";
import Donations from "./pages/Donations";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<ResetPassword />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/parents" element={<Parents />} />
        <Route path="/parents/:id" element={<ParentDetail />} />
        <Route path="/services" element={<Services />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/users" element={<Users />} />
        <Route path="/my-children" element={<MyChildren />} />
        <Route path="/my-payments" element={<MyPayments />} />
        <Route path="/my-reports" element={<MyReports />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/donations" element={<Donations />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
