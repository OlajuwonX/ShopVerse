import React, { useState, useContext } from "react";
import { Route, Routes } from "react-router-dom";
import Nav from "./Components/Nav/Nav";
import Home from "./Pages/Home/Home";
import PlaceOrder from "./Pages/PlaceOrder/PlaceOrder";
import Cart from "./Pages/Cart/Cart";
import Footer from "./Components/Footer/Footer";
import LogIn from "./Components/LogInPopUp/LogIn";
import { menu_list } from "./assets/assets";
import ThemeToggleProvider, {
  ThemeToggle,
} from "./Components/ThemeToggle/ThemeToggle";
import { ThemeContext } from "./Components/ThemeToggle/ThemeToggle";
import "./App.css";

const App = () => {
  const [showLogIn, setShowLogIn] = useState(false);
  const [product, setProduct] = useState(menu_list);

  // Search Functionality
  const searchBtn = (searchQuery) => {
    const filteredProduct = menu_list.filter((menu_item) =>
      menu_item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setProduct(filteredProduct);
  };

  return (
    <ThemeToggleProvider>
      <AppContent
        showLogIn={showLogIn}
        setShowLogIn={setShowLogIn}
        searchBtn={searchBtn}
        product={product}
      />
    </ThemeToggleProvider>
  );
};

// Separate component to use the context
const AppContent = ({ showLogIn, setShowLogIn, searchBtn, product }) => {
  const { darkMode } = useContext(ThemeContext);
  
  return (
    <div className={darkMode ? "dark-mode" : "light-mode"}>
      {/* Toggle Button */}
      <ThemeToggle />

      {/* Log In Popup */}
      {showLogIn && <LogIn setShowLogIn={setShowLogIn} />}

      {/* Main Content */}
      <div className="app">
        <Nav setShowLogIn={setShowLogIn} searchBtn={searchBtn} />
        <Routes>
          <Route path="/" element={<Home product={product} />} />
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
