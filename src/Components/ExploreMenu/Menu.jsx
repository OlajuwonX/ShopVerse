import React, { useState } from "react";
import "./Menu.css";
import { menu_list } from "../../assets/assets";
import { motion } from "framer-motion";

const Menu = ({ category, setCategory }) => {
  return (
    <div className="menu" id="menu">
      <h1>Explore our menu</h1>
      <p className="menu-text">
        Choose from a diverse menu featuring a delectable array of dishes. Our
        mission is to satisfy your cravings and elevate your dining experience,
        one delicious meal at a time.
      </p>

      <div className="click-menu">
        <motion.h3
          animate={{
            scale: [1, 1.2, 1], // Makes it bounce between scale 1 and 1.2
          }}
          transition={{
            duration: 1, // Duration of each bounce
            repeat: Infinity, // Repeat indefinitely
            repeatType: "loop", // Loop the animation
            ease: "easeIn", // Smooth transition
          }}
          style={{
            fontSize: "22px",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          Click on a menu
        </motion.h3>
      </div>

      <div className="menu-list">
        {menu_list.map((item, index) => (
          <div
            onClick={() =>
              setCategory((prev) =>
                prev === item.menu_name ? "All" : item.menu_name
              )
            }
            className="menu-items"
            key={index}
          >
            <img
              src={item.menu_image}
              alt={item.menu_name}
              className={category === item.menu_name ? "active" : ""}
            />
            <p>{item.menu_name}</p>
          </div>
        ))}
      </div>
      <hr />
    </div>
  );
};

export default Menu;
