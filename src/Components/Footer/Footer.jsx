import React from "react";
import "./Footer.css";

import { FaXTwitter } from "react-icons/fa6";
import { BsInstagram } from "react-icons/bs";
import { FaGithub, FaWhatsapp } from "react-icons/fa";
import { IoMdMail } from "react-icons/io";

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behaviour: "smooth",
    });
  };

  return (
    <div className="footer" id="footer">
      <button onClick={scrollToTop}>Back to Top ⬆︎</button>
      <div className="footer-content">
        <div className="footer-left">
          <div className="footer-logo">
            <img className="logoimg" src="Xquis'Eat.svg" alt="" />
            <h2>Xquis'Eat.</h2>
          </div>
          <p>
            Xquis'Eat is a premier food company that specializes in nationwide
            delivery of mouthwatering dishes. We pride ourselves on exceptional
            service and ensuring every meal is a delightful experience.
          </p>
          <div className="social-icons">
            <a href="https://x.com/yung_in01">
              <FaXTwitter />
            </a>
            <a href="https://www.instagram.com/yung_in">
              <BsInstagram />
            </a>
            <a href="https://github.com/OlajuwonX">
              <FaGithub />
            </a>
            <a href="mailto:olasimboolajuwon@gmail.com">
              <IoMdMail />
            </a>
            <a href="Https://wa.me//+2348123806786">
              <FaWhatsapp />
            </a>
          </div>
        </div>
        <div className="footer-center">
          <h2>COMPANY</h2>
          <ul>
            <li>Home</li>
            <li>About us</li>
            <li>Delivery</li>
            <li>Privacy policy</li>
          </ul>
        </div>
        <div className="footer-right">
          <h2>GET IN TOUCH</h2>
          <ul>
            <li>+234-903-097-1826</li>
            <li>+234-812-380-6786</li>
          </ul>
        </div>
      </div>

      {/* for smaller screens*/}
      <div className="footer-small">
        <div className="footer-center">
          <h2>COMPANY</h2>
          <ul>
            <li>Home</li>
            <li>About us</li>
            <li>Delivery</li>
            <li>Privacy policy</li>
          </ul>
        </div>
        <div className="footer-right">
          <h2>GET IN TOUCH</h2>
          <ul>
            <li>+234-903-097-1826</li>
            <li>+234-812-380-6786</li>
          </ul>
        </div>
      </div>
      <hr />
      <p className="footer-copyright">
        Copyright 2025 Ⓒ Xquis'Eat.com - All Right Reserved.
      </p>
    </div>
  );
};

export default Footer;
