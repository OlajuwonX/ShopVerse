import React, { useState } from "react";
import "./LogIn.css";
import { assets } from "../../assets/assets";

const LogIn = ({ setShowLogIn }) => {
  const [currState, setCurrState] = useState("Sign Up");

  return (
    <div className="login">
      <form className="login-container">
        <div className="login-title">
          <h2>{currState}</h2>
          <img
            onClick={() => setShowLogIn(false)}
            src={assets.cross_icon}
            alt="cancel"
          />
        </div>
        <div className="login-input">
          {currState === "Login" ? (
            <></>
          ) : (
            <input type="text" placeholder="Your Name" required />
          )}
          <input type="email" placeholder="Your Email" required />
          <input type="password" placeholder="Password" required />
        </div>
        <button>{currState === "Sign Up" ? "Create account" : "Login"}</button>
        <div className="login-condition">
          <input type="checkbox" required />
          <p>By continuing, I agree to the terms of use & policy</p>
        </div>
        {currState === "Login" ? (
          <p>
            Create a new account?{" "}
            <span className="span" onClick={() => setCurrState("Sign up")}>Click here</span>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <span className="span" onClick={() => setCurrState("Login")}>Login here</span>
          </p>
        )}
      </form>
    </div>
  );
};

export default LogIn;
