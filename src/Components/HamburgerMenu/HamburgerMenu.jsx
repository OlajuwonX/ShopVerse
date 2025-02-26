import React, { useState, useContext } from "react";
import { Link } from "react-router-dom";
import { StoreContext } from "../../Context/StoreContext";
import { assets } from "../../assets/assets";
import OutsideClickHandler from "react-outside-click-handler";
import { IoClose } from "react-icons/io5";
import {
  MdOutlineRestaurantMenu,
  MdInstallMobile,
  MdOutlineWifiCalling3,
} from "react-icons/md";
import { GiHamburgerMenu } from "react-icons/gi";
import { FaHome } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion"; // Import AnimatePresence

import "./HamburgerMenu.css";

const HamburgerMenu = ({ setShowLogIn }) => {
  const [menuOpened, setMenuOpened] = useState(false);
  const { getTotalAmount } = useContext(StoreContext);
  const toggleMenu = () => setMenuOpened((prev) => !prev);
  const closeMenu = () => setMenuOpened(false);
  return (
    <>
      {/* Small Navigation (Mobile) */}
      <div className="small-nav">
        <div className="dash-logo">
          <OutsideClickHandler onOutsideClick={closeMenu}>
            {/* Hamburger Button */}
            {!menuOpened && (
              <button onClick={toggleMenu} className="hamburger-button">
                <GiHamburgerMenu />
              </button>
            )}

            {/* Dashboard Menu */}
            <AnimatePresence>
              {menuOpened && (
                <motion.div
                  key="dash-menu" // Key is required for AnimatePresence
                  initial={{ x: "-100%", opacity: 0 }} // Initial state (offscreen and invisible)
                  animate={{ x: 0, opacity: 1 }} // Animate to visible state
                  exit={{ x: "-100%", opacity: 0 }} // Animate to exit state
                  transition={{ duration: 0.5, ease: "easeInOut" }} // Smooth transition
                  className="dash-menu"
                >
                  <div className="dash-close">
                    <p>DASHBOARD</p>
                    <button>
                      <IoClose onClick={closeMenu} />
                    </button>
                  </div>

                  {/* Navigation Menu */}
                  <ul className="nav-menu">
                    <Link to="/" id="link" onClick={closeMenu}>
                      <FaHome /> <p>Home</p>
                    </Link>
                    <a href="/#menu" id="link" onClick={closeMenu}>
                      <MdOutlineRestaurantMenu /> <p>Menu</p>
                    </a>
                    <a href="/#download" id="link" onClick={closeMenu}>
                      <MdInstallMobile /> <p>Mobile App</p>
                    </a>
                    <a href="/#footer" id="link" onClick={closeMenu}>
                      <MdOutlineWifiCalling3 /> <p>Contact Us</p>
                    </a>
                  </ul>

                  {/* Search Bar */}
                  <div className="search-bar">
                    <form>
                      <input type="text" placeholder="Explore our varieties" />
                      <button type="submit">
                        <img
                          src="Xquis'Eat.svg"
                          alt="Search Icon"
                          className="search-icon"
                        />
                      </button>
                    </form>
                  </div>

                  {/* Sign In Button */}
                  <button
                    onClick={() => {
                      setShowLogIn(true);
                      closeMenu();
                    }}
                    className="button"
                  >
                    Sign In
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </OutsideClickHandler>

          {/* Logo */}
          <Link to="/" className="navlogo">
            <img className="logoimg" src="Xquis'Eat.svg" alt="Xquis'Eat Logo" />
            <h2>Xquis'Eat.</h2>
          </Link>
        </div>

        {/* Cart Icon */}
        <div className="cart">
          <Link to="/cart" className="small-basket">
            <img src={assets.basket_icon} alt="Basket Icon" />
          </Link>
          {getTotalAmount() > 0 && <div className="dot"></div>}
        </div>
      </div>
    </>
  );
};

export default HamburgerMenu;
