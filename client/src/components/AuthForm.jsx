import React, { useState } from "react";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { useToast } from "./ui/Toast";
import Button from "./ui/Button";
import Input from "./ui/Input";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://jobpilot-production-3ba1.up.railway.app");

function AuthForm({ btnText, newUser, passwordDes }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (newUser && !formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Enter a valid email";
    if (!formData.password) newErrors.password = "Password is required";
    else if (newUser && formData.password.length < 6)
      newErrors.password = "Must be at least 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const endpoint = newUser ? "/api/auth/signup" : "/api/auth/login";
      const response = await axios.post(`${API_BASE}${endpoint}`, {
        email: formData.email,
        password: formData.password,
        ...(newUser && { name: formData.name }),
      });

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      window.dispatchEvent(new Event("authChange"));
      toast.success(newUser ? "Account created!" : "Welcome back!");
      navigate("/onboarding");
    } catch (error) {
      toast.error(error.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuthSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/auth/google`, {
        credential: credentialResponse.credential,
      });

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      window.dispatchEvent(new Event("authChange"));
      toast.success("Signed in with Google!");
      navigate("/onboarding");
    } catch (error) {
      toast.error(error.response?.data?.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuthError = () => {
    toast.error("Google sign-in failed. Please try again.");
  };

  return (
    <div className="min-h-screen w-full  bg-surface-primary flex ">
      <div className="bg-mesh" flex justify-center items-center />

      {/* Left: Branding panel (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-end py-12 pl-12 pr-6">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-500/10 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent-500/8 rounded-full blur-[80px] animate-float animate-delay-300" />

        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-2xl font-bold text-gradient">JobPilot</span>
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-6">
            Sit back and
            <br />
            <span className="text-gradient">apply smart</span>
          </h1>

          <p className="text-gray-400 leading-relaxed mb-8">
            Stop spending hours on job applications. JobPilot matches you with
            the best opportunities and auto-applies across platforms. You focus
            on interviews, we handle the hunt.
          </p>

          <div className="space-y-5">
            {[
              {
                title: "AI-powered job matching",
                desc: "Get roles tailored to your skills and goals",
              },
              {
                title: "One-click multi-platform apply",
                desc: "Apply across LinkedIn, Naukri, and more instantly",
              },
              {
                title: "Real-time application tracking",
                desc: "Track every application in one clean dashboard",
              },
            ].map((feature) => (
              <div key={feature.title} className="flex gap-3">
                <span className="text-gray-300 leading-none mt-0.5">•</span>
                <div>
                  <div className="text-sm text-gray-300">{feature.title}</div>
                  <div className="text-sm text-gray-500">{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-start p-6 lg:py-12 lg:pl-6 lg:pr-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <span className="text-xl font-bold text-gradient">JobPilot</span>
          </div>

          {/* <h2 className="text-2xl font-bold text-white mb-2">
            {newUser ? "Create your account" : "Welcome back"}
          </h2> */}
          {/* <p className="text-gray-400 text-sm mb-8">
            {newUser
              ? "Start automating your job search today"
              : "Sign in to continue your job search"}
          </p> */}

          <form onSubmit={handleSubmit} className="space-y-4">
            {newUser && (
              <Input
                id="name"
                name="name"
                type="text"
                label="Full Name"
                placeholder="Your full name"
                icon={User}
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
              />
            )}

            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              icon={Mail}
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
            />

            <Input
              id="passwd"
              name="password"
              type="password"
              label={passwordDes || "Password"}
              placeholder="••••••••"
              icon={Lock}
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              required
            />

            {!newUser && (
              <div className="text-right">
                <a
                  href="#"
                  className="text-xs text-gray-400 hover:text-brand-400 transition-colors"
                >
                  Forgot password?
                </a>
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
              iconRight={ArrowRight}
            >
              {btnText}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500">or continue with</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleAuthSuccess}
              onError={handleGoogleAuthError}
              useOneTap
              theme="filled_black"
              shape="pill"
              size="large"
              width="100%"
            />
          </div>

          {/* Switch link */}
          <p className="text-center text-sm text-gray-400 mt-8">
            {newUser ? (
              <>
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to JobPilot?{" "}
                <Link
                  to="/signup"
                  className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
                >
                  Create an account
                </Link>
              </>
            )}
          </p>

          {/* Guide link */}
          <p className="text-center mt-4">
            <Link
              to="/guide"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              How does JobPilot work? →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthForm;
