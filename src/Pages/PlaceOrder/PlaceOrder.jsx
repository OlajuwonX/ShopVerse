import React, { useContext } from "react";
import "./PlaceOrder.css";
import { StoreContext } from "../../Context/StoreContext";

const PlaceOrder = () => {
  const { getTotalAmount } = useContext(StoreContext);

  return (
    <form className="place-order">
      <div className="place-left">
        <p className="place-title">Delivery Information</p>
        <p className="place-fill">Fill in your details below</p>
        <div className="multi-fields">
          <p>Name*</p>
          <input type="text" placeholder="Phantom X" required />
        </div>
        <div className="email">
          <p>Email*</p>
          <input type="email" placeholder="johndoe@gmail.com" required />
        </div>
        <div className="street">
          <p>Street*</p>
          <input type="text" placeholder="Alpha grace str" required />
        </div>
        <div className="multi-fields">
          <p>City:</p>
          <input type="text" placeholder="Ibadan" required />
        </div>
        <div className="multi-fields">
          <p>Zip Code:</p>
          <input type="text" placeholder="Zip Code" required />
        </div>
        <div className="number">
          <p>Phone*</p>
          <input type="text" placeholder="+234906361****" required />
        </div>
      </div>
      <div className="place-right">
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

          <button>Proceed</button>
        </div>
      </div>
    </form>
  );
};

export default PlaceOrder;
