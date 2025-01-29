import React, { useState, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import Nav from "./Components/Nav/Nav";
import Home from "./Pages/Home/Home";
import PlaceOrder from "./Pages/PlaceOrder/PlaceOrder";
import Cart from "./Pages/Cart/Cart";
import Footer from "./Components/Footer/Footer";
import LogIn from "./Components/LogInPopUp/LogIn";

import { menu_list } from "./assets/assets";

import { CiLight } from "react-icons/ci";
import { MdDarkMode } from "react-icons/md";

import "./App.css";

const App = () => {
  const [showLogIn, setShowLogIn] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [product, setProduct] = useState(menu_list);

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

  // Search Functionality
  const searchBtn = (searchQuery) => {
    const filteredProduct = menu_list.filter((menu_item) =>
      menu_item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setProduct(filteredProduct);

    if (filteredProduct.length === 0) {
      console.log("No products found");
    }
  };

  return (
    <div className={darkMode ? "dark-mode" : "light-mode"}>
      {/* Dark Mode Toggle */}
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

      {/* Log In Popup */}
      {showLogIn && <LogIn setShowLogIn={setShowLogIn} />}

      {/* Main Content */}
      <div className="app">
        <Nav setShowLogIn={setShowLogIn} searchBtn={searchBtn} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/order" element={<PlaceOrder />} />
        </Routes>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
