import React from "react";
import "./Download.css";

import { assets } from "../../assets/assets";

const Download = () => {
  return (
    <div className="download" id="download">
      <p>
        For Better Experience Download The
        <br /> Xquis'Eat Mobile App.
      </p>
      <div className="download-platform">
        <img src={assets.play_store} alt="" />
        <img src={assets.app_store} alt="" />
      </div>
    </div>
  );
};

export default Download;
