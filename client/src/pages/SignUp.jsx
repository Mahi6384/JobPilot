import React from "react";
import AuthForm from "../components/AuthForm";
function SignUp() {
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
