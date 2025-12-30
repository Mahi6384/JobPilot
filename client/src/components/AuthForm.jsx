import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import googleIcon from "../assets/googleIcon.svg";

function AuthForm({ heading, btnText, newUser, TextUnderHeading, passwordDes }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = newUser ? "/api/auth/signup" : "/api/auth/login";
      const response = await axios.post(`http://localhost:5000${endpoint}`, {
        email: formData.email,
        password: formData.password,
      });

      // Store token
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Dispatch event to notify Navbar
      window.dispatchEvent(new Event("authChange"));

      // Redirect based on onboarding status
      if (response.data.user.onboardingStatus === "initial") {
        navigate("/onboarding");
      } else if (response.data.user.onboardingStatus === "profile_completed") {
        navigate("/connect-naukri");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Auth error:", error);
      alert(error.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuthSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const response = await axios.post(`http://localhost:5000/api/auth/google`, {
        credential: credentialResponse.credential,
      });

      // Store token
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Dispatch event to notify Navbar
      window.dispatchEvent(new Event("authChange"));

      // Redirect based on onboarding status
      if (response.data.user.onboardingStatus === "initial") {
        navigate("/onboarding");
      } else if (response.data.user.onboardingStatus === "profile_completed") {
        navigate("/connect-naukri");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Google Auth error:", error);
      alert(error.response?.data?.message || "Google Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuthError = () => {
    console.error("Google Login Failed");
    alert("Login Failed. Please try again.");
  };

  return (
    <div className="font-montserrat">
      <div className="min-h-screen w-full h-screen flex items-center justify-center bg-gray-950">
        <div className="w-[80%] max-w-6xl text-white flex h-5/6 rounded-3xl bg-stone-800/20 shadow-blue-900 shadow-[0_4px_40px_0px_rgba(0,0,0,0.1)]">
          <section className="flex flex-col flex-1 min-w-[350px] p-12 justify-center">
            <h1 className="text-3xl font-bold leading-tight mt-2 select-none">{heading}</h1>
            <p className="text-sm font-light opacity-85 mb-8 select-none">{TextUnderHeading}</p>

            <form className="w-full" onSubmit={handleSubmit}>
              {newUser && (
                <div className="flex flex-col mb-6">
                  <label htmlFor="name" className="text-sm font-normal mb-1 select-none">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Mahi Jain"
                    className="rounded-md px-4 py-2 text-black placeholder-gray-500 shadow-inner focus:shadow-[inset_0_0_10px_#131a25]"
                  />
                </div>
              )}
              <div className="flex flex-col mb-6">
                <label htmlFor="email" className="text-sm font-normal mb-1 select-none">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="abc@gmail.com"
                  required
                  className="rounded-md px-4 py-2 text-black placeholder-gray-500 shadow-inner focus:shadow-[inset_0_0_10px_#131a25]"
                />
              </div>
              <div className="flex flex-col mb-6">
                <label htmlFor="passwd" className="text-sm font-normal mb-1 select-none">
                  {passwordDes}
                </label>
                <input
                  id="passwd"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password"
                  required
                  className="rounded-md px-4 py-2 text-black placeholder-gray-500 shadow-inner focus:shadow-[inset_0_0_10px_#131a25]"
                />
                {!newUser && (
                  <a href="#" className="text-xs text-white underline mt-1 self-end select-none">
                    Forgot Password
                  </a>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-blue-900 py-3 rounded-md font-medium text-lg shadow-md w-full transition-colors duration-300 disabled:bg-gray-600"
              >
                {loading ? "Processing..." : btnText}
              </button>
            </form>

            <div className="flex justify-center gap-7 my-8">
              <GoogleLogin
                onSuccess={handleGoogleAuthSuccess}
                onError={handleGoogleAuthError}
                useOneTap
                theme="filled_black"
                shape="circle"
              />
            </div>

            {newUser && (
              <a
                href="/login"
                className="text-center text-xs underline opacity-60 hover:opacity-90 select-none"
              >
                Already an user? Login
              </a>
            )}
          </section>
          <section className="flex flex-col justify-center flex-1 min-w-[400px] bg-#131a25/10 p-12 text-white rounded-tr-xl rounded-br-xl relative">
            <div>
              <h2 className="text-4xl font-bold mb-6 select-none">
                Sit back,
                <br />
                Apply smart
              </h2>
              <blockquote>
                <p className="text-sm font-light opacity-85 leading-relaxed mb-4 select-none">
                  "Tired of spending hours filling out job applications? Let JobPilot do the heavy
                  lifting. Our AI agent applies to top-matching jobs every day — no more repeating
                  the same details or missing deadlines. You focus on interviews, we'll handle the
                  hunt. Sit back. Apply smart. Land faster."
                </p>
              </blockquote>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default AuthForm;
