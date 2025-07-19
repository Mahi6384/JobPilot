import React from "react";
import AuthForm from "../components/AuthForm";

function Login() {
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
