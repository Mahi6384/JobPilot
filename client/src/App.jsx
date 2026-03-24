import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Jobs from "./pages/Jobs";
import Applications from "./pages/Applications";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Guide from "./pages/Guide";

function AppContent() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <>
      {!isAuthPage && <Navbar />}
      <div className={!isAuthPage ? "pt-20" : ""}>
        <Routes>
          {/* Public routes */}
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/guide" element={<Guide />} />
          
          {/* Onboarding - requires auth but not completed onboarding */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute requireOnboarding={false}>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          
          {/* Protected routes - require both auth and completed onboarding */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <Jobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applications"
            element={
              <ProtectedRoute>
                <Applications />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
