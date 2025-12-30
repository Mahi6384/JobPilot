import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";

function SignUp() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard");
    }
  }, [navigate]);

  return (
    <>
      <AuthForm
        // className="pt-32  "
        // heading={"Welcome in JobPilot"}
        btnText={"Sign Up"}
        // TextUnderHeading={"Create an Account"}
        passwordDes={"Create a password"}
        newUser
      />
    </>
  );
}

export default SignUp;
