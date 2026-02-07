import React from "react";
import { Navigate } from "react-router-dom";

/**
 * ProtectedRoute component that handles authentication and onboarding checks
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The component to render if authorized
 * @param {boolean} props.requireAuth - Whether authentication is required (default: true)
 * @param {boolean} props.requireOnboarding - Whether completed onboarding is required (default: true)
 */
function ProtectedRoute({ children, requireAuth = true, requireOnboarding = true }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Check if user is authenticated
  if (requireAuth && !token) {
    return <Navigate to="/login" replace />;
  }

  // Check if onboarding is required and not completed
  if (requireAuth && requireOnboarding && user.onboardingStatus !== "completed") {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

export default ProtectedRoute;
