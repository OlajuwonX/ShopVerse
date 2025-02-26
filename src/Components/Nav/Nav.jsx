import React, { useContext, useState } from "react";
import { Link } from "react-router-dom";

import { StoreContext } from "../../Context/StoreContext";
import { assets } from "../../assets/assets";
import "./Nav.css";
import HamburgerMenu from "../HamburgerMenu/HamburgerMenu";

const Nav = ({ setShowLogIn }) => {
  const [searchVisible, setSearchVisible] = useState(false);
  const { getTotalAmount } = useContext(StoreContext);
  return (
    <>
      <HamburgerMenu />

      {/* Large Navigation (Desktop) */}
      <nav className="Nav">
        {/* Logo Section */}
        <Link to="/" className="navlogo">
          <img className="logoimg" src="Xquis'Eat.svg" alt="Xquis'Eat Logo" />
          <h2>Xquis'Eat.</h2>
        </Link>

        {/* Navigation Menu */}
        <ul className="nav-menu">
          <Link to="/" id="link">
            Home
          </Link>
          <a href="/#menu" id="link">
            Menu
          </a>
          <a href="/#download" id="link">
            Mobile App
          </a>
          <a href="/#footer" id="link">
            Contact Us
          </a>
        </ul>

        {/* Right Section */}
        <div className="nav-right">
          {/* Search Bar */}
          {searchVisible ? (
            <div className="search-bar">
              <form>
                <input type="text" placeholder="Explore our varieties" />
                <button type="submit">
                  <img src="Xquis'Eat.svg" alt="Search Icon" />
                </button>
              </form>
            </div>
          ) : (
            <img
              onClick={() => setSearchVisible(true)}
              src={assets.search_icon}
              alt="Search Icon"
              className="main-search"
            />
          )}

          {/* Cart Icon */}
          <div className="nav-search">
            <Link to="/cart" className="basket">
              <img src={assets.basket_icon} alt="Basket Icon" />
            </Link>
            {getTotalAmount() > 0 && <div className="dot"></div>}
          </div>

          {/* Sign In Button */}
          <button onClick={() => setShowLogIn(true)} className="button">
            Sign In
          </button>
        </div>
      </nav>
    </>
  );
};

export default Nav;
