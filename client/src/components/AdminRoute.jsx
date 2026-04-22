import React from "react";
import { Navigate } from "react-router-dom";

function AdminRoute({ children }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user?.isAdmin !== true) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;

