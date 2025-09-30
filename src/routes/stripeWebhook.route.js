// routes/stripeWebhook.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/order.model");

router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // important: raw body
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;
          console.log("PaymentIntent succeeded:", paymentIntent.id);

          await Order.findOneAndUpdate(
            { paymentIntentId: paymentIntent.id },
            { paymentStatus: "paid" },
            { new: true }
          );
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object;
          console.log("PaymentIntent failed:", paymentIntent.id);

          await Order.findOneAndUpdate(
            { paymentIntentId: paymentIntent.id },
            { paymentStatus: "failed" },
            { new: true }
          );
          break;
        }

        // optionally handle other events you care about
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).send();
    }
  }
);

module.exports = router;
