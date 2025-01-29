import React, { useContext } from "react";
import "./FoodItem.css";
import { assets } from "../../assets/assets";
import { StoreContext } from "../../Context/StoreContext";

const FoodItem = ({ id, name, price, description, image }) => {
  const { cartItems, addToCart, remFromCart } = useContext(StoreContext);

  return (
    <div className="food-item">
      <div className="img-container">
        <img className="item-img" src={image} alt="" />
      </div>
      <div className="item-info">
        <div className="item-name-rating">
          <p>{name}</p>
          <img src={assets.rating_starts} alt="rating" />
        </div>
        <p className="item-desc">{description}</p>
        <p className="item-price">₦{price}</p>
        {!cartItems[id] ? (
          <button className="add" onClick={() => addToCart(id)}>
            Place Order
          </button>
        ) : (
          <div className="item-counter">
            <img
              onClick={() => remFromCart(id)}
              src={assets.remove_icon_red}
              alt="icon-red"
            />
            <p>{cartItems[id]}</p>
            <img
              onClick={() => addToCart(id)}
              src={assets.add_icon_green}
              alt="icon-green"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodItem;
