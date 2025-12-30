import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";

function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard");
    }
  }, [navigate]);

  return (
    <div>
      <AuthForm
        heading={"Welcome Back"}
        btnText={"Login"}
        TextUnderHeading={"Enter your Account Details"}
        passwordDes={"Password"}
        existingUser
      />
    </div>
  );
}

export default Login;
