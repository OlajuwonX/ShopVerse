import React, { useState } from "react";
import "./Home.css";
import Header from "../../Components/Header/Header";
import Menu from "../../Components/ExploreMenu/Menu";
import FoodDisplay from "../../Components/FoodDisplay/FoodDisplay";
import Download from "../../Components/AppDownload/Download";

const Home = () => {
  const [category, setCategory] = useState("All");

  return (
    <div>
      <Header />
      <Menu category={category} setCategory={setCategory} />
      <FoodDisplay category={category} />
      <Download />
    </div>
  );
};

export default Home;
