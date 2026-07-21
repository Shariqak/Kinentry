import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ProtectedRoute } from "./components/ProtectedRoute"
import Login from "./pages/Login"
import StaffLogin from "./pages/StaffLogin"
import Signup from "./pages/Signup"
import Dashboard from "./pages/Dashboard"
import Programs from "./pages/Programs"
import Profile from "./pages/Profile"
import MyEnrollments from "./pages/MyEnrollments"
import PatientAppointments from "./pages/PatientAppointments"
import Admin from "./pages/Admin"
import AdminPatients from "./pages/AdminPatients"
import AdminIntakeQueue from "./pages/AdminIntakeQueue"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Onboarding from "./pages/Onboarding"

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/staff-login" element={<StaffLogin />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>} />

          {/* Patient portal */}
          <Route path="/patient/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patient/programs" element={<ProtectedRoute><Programs /></ProtectedRoute>} />
          <Route path="/patient/my-enrollments" element={<ProtectedRoute><MyEnrollments /></ProtectedRoute>} />
          <Route path="/patient/appointments" element={<ProtectedRoute><PatientAppointments /></ProtectedRoute>} />
          <Route path="/patient/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Admin / clinic ops — role-gated at the route level, not just hidden in the UI */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requireRole={["staff", "admin"]}>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/patients"
            element={
              <ProtectedRoute requireRole={["staff", "admin"]}>
                <AdminPatients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/intake-queue"
            element={
              <ProtectedRoute requireRole={["staff", "admin"]}>
                <AdminIntakeQueue />
              </ProtectedRoute>
            }
          />

          {/* Backward-compatible redirects from the old flat URLs (bookmarks, etc.) */}
          <Route path="/dashboard" element={<Navigate to="/patient/dashboard" replace />} />
          <Route path="/programs" element={<Navigate to="/patient/programs" replace />} />
          <Route path="/my-enrollments" element={<Navigate to="/patient/my-enrollments" replace />} />
          <Route path="/profile" element={<Navigate to="/patient/profile" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

          <Route path="*" element={<Navigate to="/patient/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
