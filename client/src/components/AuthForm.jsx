import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import googleIcon from "../assets/googleIcon.svg";

function AuthForm({
  heading,
  btnText,
  newUser,
  TextUnderHeading,
  passwordDes,
}) {
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
        ...(newUser && { name: formData.name }),
      });

      // Store token
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Dispatch event to notify Navbar
      window.dispatchEvent(new Event("authChange"));

      // Redirect to onboarding after successful auth
      navigate("/onboarding");
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
      const response = await axios.post(
        `http://localhost:5000/api/auth/google`,
        {
          credential: credentialResponse.credential,
        },
      );

      // Store token
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Dispatch event to notify Navbar
      window.dispatchEvent(new Event("authChange"));

      // Redirect to onboarding after successful auth
      navigate("/onboarding");
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
    <div className="font-montserrat min-h-screen w-full bg-gray-950 flex flex-col justify-center">
      <div className="h-[calc(100vh-5rem)] w-full flex items-center justify-center overflow-hidden">
        <div className="w-[85%] max-w-5xl text-white flex h-[85%] max-h-[650px] rounded-3xl bg-stone-800/20 shadow-blue-900 shadow-[0_4px_40px_0px_rgba(0,0,0,0.1)]">
          <section className="flex flex-col flex-1 min-w-[320px] p-8 md:p-10 justify-center">
            {/* <h1 className="text-3xl font-bold leading-tight mt-2 select-none">
              {heading}
            </h1>
            <p className="text-sm font-light opacity-85 mb-8 select-none">
              {TextUnderHeading}
            </p> */}

            <form className="w-full" onSubmit={handleSubmit}>
              {newUser && (
                <div className="flex flex-col mb-4">
                  <label
                    htmlFor="name"
                    className="text-sm font-normal mb-1 select-none"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Mahi Jain"
                    className="rounded-md px-4 py-1.5 text-black placeholder-gray-500 shadow-inner focus:shadow-[inset_0_0_10px_#131a25]"
                  />
                </div>
              )}
              <div className="flex flex-col mb-4">
                <label
                  htmlFor="email"
                  className="text-sm font-normal mb-1 select-none"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ypuram@gmail.com"
                  required
                  className="rounded-md px-4 py-1.5 text-black placeholder-gray-500 shadow-inner focus:shadow-[inset_0_0_10px_#131a25]"
                />
              </div>
              <div className="flex flex-col mb-4">
                <label
                  htmlFor="passwd"
                  className="text-sm font-normal mb-1 select-none"
                >
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
                  className="rounded-md px-4 py-1.5 text-black placeholder-gray-500 shadow-inner focus:shadow-[inset_0_0_10px_#131a25]"
                />
                {!newUser && (
                  <a
                    href="#"
                    className="text-xs text-white underline mt-1 self-end select-none"
                  >
                    Forgot Password
                  </a>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-blue-900 py-2.5 rounded-md font-medium text-base shadow-md w-full transition-colors duration-300 disabled:bg-gray-600 mt-2"
              >
                {loading ? "Processing..." : btnText}
              </button>
            </form>

            <div className="flex justify-center gap-7 my-5">
              <GoogleLogin
                onSuccess={handleGoogleAuthSuccess}
                onError={handleGoogleAuthError}
                useOneTap
                theme="filled_black"
                shape="circle"
              />
            </div>

            {newUser ? (
              <a
                href="/login"
                className="text-center text-xs underline opacity-60 hover:opacity-90 select-none"
              >
                Already an user? Login
              </a>
            ) : (
              <a
                href="/signup"
                className="text-center text-xs underline opacity-60 hover:opacity-90 select-none"
              >
                New user? Create an account
              </a>
            )}
          </section>
          <section className="flex flex-col justify-center flex-1 min-w-[350px] bg-[#131a25]/10 p-8 md:p-10 text-white rounded-tr-xl rounded-br-xl relative">
            <a
              href="/guide"
              className="absolute top-8 right-8 text-sm underline opacity-60 hover:opacity-100 transition-opacity select-none"
            >
              how to use JobPilot?
            </a>
            <div>
              <h2 className="text-3xl font-bold mb-6 select-none leading-tight">
                Sit back and
                <br />
                Apply smart with{" "}
                <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                  JobPilot
                </span>
              </h2>
              <blockquote>
                <p className="text-sm font-light opacity-85 leading-relaxed mb-4 select-none">
                  Tired of spending hours filling out job applications? Let
                  JobPilot do the heavy lifting. Our AI agent applies to
                  top-matching jobs every day — no more repeating the same
                  details or missing deadlines. You focus on interviews, we'll
                  handle the hunt. Sit back. Apply smart. Land faster.
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
