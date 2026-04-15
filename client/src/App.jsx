import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Jobs from "./pages/Jobs";
import Applications from "./pages/Applications";
import NotFound from "./pages/NotFound";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Guide from "./pages/Guide";
import AppLayout from "./components/layout/AppLayout";

const publicPaths = ["/login", "/signup", "/guide", "/onboarding"];

function AppContent() {
  const location = useLocation();
  const isPublicPage = publicPaths.some((p) => location.pathname === p);
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  if (isPublicPage) {
    return (
      <>
        {!isAuthPage && <Navbar />}
        <div className={!isAuthPage ? "pt-16" : ""}>
          <Routes>
            <Route path="/signup" element={<SignUp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/guide" element={<Guide />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute requireOnboarding={false}>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </>
    );
  }

  return (
    <AppLayout>
      <Routes>
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
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
