import React, { useContext } from "react";
import "./Cart.css";
import { StoreContext } from "../../Context/StoreContext";
import { useNavigate } from "react-router-dom";

const Cart = () => {
  const { cartItems, food_list, remFromCart, getTotalAmount } =
    useContext(StoreContext);

  const navigate = useNavigate();

  // Check if the cart is empty
  const isCartEmpty = Object.values(cartItems).every(
    (quantity) => quantity === 0
  );

  return (
    <div className={`cart ${isCartEmpty ? "cart-empty" : "cart-not-empty"}`}>
      {/* Display empty cart message when the cart is empty */}
      {isCartEmpty ? (
        <div className="cart-empty-message">
          <hr />
          <p>You are yet to place an order</p>
          <a href="/#menu" className="button">
            Place Order
          </a>
        </div>
      ) : (
        <div className="cartItems">
          {/* Display Cart items if the cart has products */}
          <div className="cartItems-title">
            <p>Items</p>
            <p>Title</p>
            <p>Price</p>
            <p>Quantity</p>
            <p>Total</p>
            <p>Remove</p>
          </div>
          <br />
          <hr />
          {food_list.map((item, index) => {
            if (cartItems[item._id] > 0)
              return (
                <div key={index}>
                  <div className="cartItems-title cartItems-item">
                    <img src={item.image} alt="" />
                    <p className="title">{item.name}</p>
                    <p className="price">₦ {item.price}</p>
                    <p className="quantity">{cartItems[item._id]}</p>
                    <p className="price">
                      ₦ {item.price * cartItems[item._id]}
                    </p>
                    <p className="cross" onClick={() => remFromCart(item._id)}>
                      x
                    </p>
                  </div>
                  <hr />
                </div>
              );
            return null;
          })}
        </div>
      )}

      {/* Cart bottom section (total, promo code, etc.) */}
      {!isCartEmpty && (
        <div className="cart-bottom">
          <div className="cart-total">
            <h2>Cart Total</h2>
            <div>
              <div className="total-details">
                <p>Subtotal</p>
                <p>₦ {getTotalAmount()}</p>
              </div>
              <hr />
              <div className="total-details">
                <p>Delivery Fee</p>
                <p>₦ {getTotalAmount() === 0 ? 0 : 2000}</p>
              </div>
              <hr />
              <div className="total-details">
                <b>Total</b>
                <b>₦ {getTotalAmount() === 0 ? 0 : getTotalAmount() + 2000}</b>
              </div>
            </div>
            <button onClick={() => navigate("/order")}>Checkout</button>
          </div>
          <div className="cart-promo">
            <div>
              <p>
                If you have a promo code, <span> Enter it here </span>{" "}
              </p>
              <div className="promo-input">
                <input type="text" placeholder="18645700" />
                <button>Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
