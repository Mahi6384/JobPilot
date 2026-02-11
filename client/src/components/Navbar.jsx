import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const Navbar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const checkAuth = () => {
    const token = localStorage.getItem("token");
    const userData = JSON.parse(localStorage.getItem("user"));
    if (token && userData) {
      setIsLoggedIn(true);
      setUser(userData);
    } else {
      setIsLoggedIn(false);
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
    window.addEventListener("authChange", checkAuth);
    window.addEventListener("storage", checkAuth);
    return () => {
      window.removeEventListener("authChange", checkAuth);
      window.removeEventListener("storage", checkAuth);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("authChange"));
    navigate("/login");
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-gray-950/80 backdrop-blur-md border-b border-white/5 font-montserrat">
      <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center text-white">
        <Link
          to="/"
          className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
        >
          JobPilot
        </Link>

        <div className="flex items-center gap-8">
          <ul className="hidden md:flex items-center gap-6 text-sm font-medium opacity-80">
            <li>
              <Link to="/" className="hover:text-blue-400 transition-colors">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/jobs" className="hover:text-blue-400 transition-colors">
                Jobs
              </Link>
            </li>
          </ul>

          <div className="flex items-center gap-4 pl-6 border-l border-white/10">
            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <Link 
                  to="/profile" 
                  className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-blue-500/50 bg-blue-500/10 text-blue-400 font-bold text-lg select-none transition-transform hover:scale-110 hover:border-blue-400"
                  title="View Profile"
                >
                  {user?.fullName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-white px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border border-white/10"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-5 py-2 rounded-full text-sm font-semibold hover:bg-white/5 transition-all"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
