import React, { createContext, useState, useEffect, useContext } from "react";
import { CiLight } from "react-icons/ci";
import { MdDarkMode } from "react-icons/md";
import "./ThemeToggle.css";

export const ThemeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {},
});

const ThemeToggleProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);

  // Persist Dark Mode Preference
  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode") === "true";
    setDarkMode(savedMode);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prevMode) => {
      const newMode = !prevMode;
      localStorage.setItem("darkMode", newMode);
      return newMode;
    });
  };

  const themeValue = {
    darkMode,
    toggleDarkMode,
  };

  /* Dark Mode Toggle */
  return (
    <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
  );
};

export const ThemeToggle = () => {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);

  return (
    <div className="tablet-toggle">
      <div
        onClick={toggleDarkMode}
        className={`toggle-btn ${darkMode ? "active" : ""}`}
      >
        <div className="toggle-circle">
          {darkMode ? (
            <MdDarkMode className="icon" />
          ) : (
            <CiLight className="icon" />
          )}
        </div>
      </div>
    </div>
  );
};

export default ThemeToggleProvider;
